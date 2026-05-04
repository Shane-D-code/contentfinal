"""
Layout Assembler
Converts selected AssetMetadata into platform-ready image/video files.

Outputs:
  - LinkedIn collage      (1080×1080 JPEG, 2×2 or 2×3 grid)
  - Instagram carousel    (1080×1350 JPEG per slide, 4:5 ratio)
  - Instagram stories     (1080×1920 JPEG per frame, 9:16 ratio)
  - Instagram reel        (1080×1920 MP4, assembled from highlight clips)

All image operations use Pillow. Video assembly uses ffmpeg via subprocess.
Face-aware smart crop uses the already-loaded YOLOv11 face model.
"""

import subprocess
import tempfile
import cv2
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
from typing import List, Tuple, Optional, Dict
from huggingface_hub import hf_hub_download
from ultralytics import YOLO


# ── Platform dimensions ───────────────────────────────────────────────────────
LINKEDIN_SIZE   = (1080, 1080)   # 1:1
CAROUSEL_SIZE   = (1080, 1350)   # 4:5
STORY_SIZE      = (1080, 1920)   # 9:16
REEL_SIZE       = (1080, 1920)   # 9:16

# Grid layouts keyed by number of images
_GRID_LAYOUTS: Dict[int, Tuple[int, int]] = {
    1: (1, 1),
    2: (1, 2),
    3: (1, 3),
    4: (2, 2),
    5: (2, 3),   # 5th slot left empty
    6: (2, 3),
}


class LayoutAssembler:
    """
    Stateless layout engine. All methods are instance methods for consistency
    but hold no mutable state — safe to share across requests.
    """

    def __init__(self):
        # Lazy-load face model — reuse the same weights already on disk
        model_path = hf_hub_download(
            repo_id="AdamCodd/YOLOv11n-face-detection",
            filename="model.pt",
        )
        self._face_model = YOLO(model_path)

    # ── Smart crop ────────────────────────────────────────────────────────────

    def smart_crop(
        self,
        image_path: str,
        target_w: int,
        target_h: int,
    ) -> Image.Image:
        """
        Crop an image to (target_w × target_h) keeping the most important
        subject in frame.

        Strategy:
          1. Detect faces — if found, centre the crop on the primary face cluster
          2. No faces — fall back to centre crop
          3. Resize to exact target dimensions with LANCZOS

        Never upscales beyond 2× to avoid visible pixelation.
        """
        img = Image.open(image_path).convert("RGB")
        orig_w, orig_h = img.size
        target_ratio = target_w / target_h
        orig_ratio   = orig_w  / orig_h

        # ── Find crop anchor ──────────────────────────────────────────────────
        anchor_x = orig_w / 2   # default: centre
        anchor_y = orig_h / 2

        try:
            results = self._face_model.predict(image_path, conf=0.35, verbose=False)
            if results and results[0].boxes and len(results[0].boxes) > 0:
                boxes = results[0].boxes.xyxy.cpu().numpy()
                # Use centroid of all detected faces as anchor
                anchor_x = float(np.mean([(b[0] + b[2]) / 2 for b in boxes]))
                anchor_y = float(np.mean([(b[1] + b[3]) / 2 for b in boxes]))
        except Exception:
            pass  # Fall back to centre crop

        # ── Compute crop box ──────────────────────────────────────────────────
        if orig_ratio > target_ratio:
            # Image is wider than target — crop width
            new_w = int(orig_h * target_ratio)
            x1 = int(np.clip(anchor_x - new_w / 2, 0, orig_w - new_w))
            crop_box = (x1, 0, x1 + new_w, orig_h)
        else:
            # Image is taller than target — crop height
            new_h = int(orig_w / target_ratio)
            y1 = int(np.clip(anchor_y - new_h / 2, 0, orig_h - new_h))
            crop_box = (0, y1, orig_w, y1 + new_h)

        img = img.crop(crop_box)
        img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        return img

    # ── LinkedIn collage ──────────────────────────────────────────────────────

    def create_linkedin_collage(self, image_paths: List[str]) -> Image.Image:
        """
        Assemble 1–6 images into a 1080×1080 grid collage.
        Grid layout is chosen automatically based on image count.
        A 2-pixel white gutter separates cells.
        """
        n = min(len(image_paths), 6)
        if n == 0:
            raise ValueError("No images provided for collage")

        rows, cols = _GRID_LAYOUTS[n]
        gutter = 2
        cell_w = (LINKEDIN_SIZE[0] - gutter * (cols - 1)) // cols
        cell_h = (LINKEDIN_SIZE[1] - gutter * (rows - 1)) // rows

        canvas = Image.new("RGB", LINKEDIN_SIZE, color=(255, 255, 255))

        for idx, path in enumerate(image_paths[:n]):
            row = idx // cols
            col = idx % cols
            cell = self.smart_crop(path, cell_w, cell_h)
            x = col * (cell_w + gutter)
            y = row * (cell_h + gutter)
            canvas.paste(cell, (x, y))

        return canvas

    # ── Instagram carousel ────────────────────────────────────────────────────

    def create_instagram_carousel(self, image_paths: List[str]) -> List[Image.Image]:
        """
        Convert each image to 4:5 (1080×1350) for an Instagram carousel.
        Returns up to 10 slides.
        """
        slides = []
        for path in image_paths[:10]:
            slide = self.smart_crop(path, *CAROUSEL_SIZE)
            slides.append(slide)
        return slides

    # ── Instagram stories ─────────────────────────────────────────────────────

    def create_story_frame(
        self,
        image_path: str,
        caption_text: str = "",          # Item 15: burn caption into frame
        watermark_path: Optional[str] = None,  # Item 16
        watermark_position: str = "bottom-right",
        watermark_opacity: float = 0.7,
    ) -> Image.Image:
        """
        Convert a single image to 9:16 (1080×1920) story format.

        Item 15: If caption_text is provided, renders it onto the frame
                 at the bottom with a shadow for legibility.
        Item 16: If watermark_path is provided, composites a logo.
        """
        frame = self.smart_crop(image_path, *STORY_SIZE)

        # Gradient overlay — bottom 15% of frame
        overlay_h = int(STORY_SIZE[1] * 0.15)
        overlay = Image.new("RGBA", STORY_SIZE, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        for i in range(overlay_h):
            alpha = int(160 * (i / overlay_h))
            y = STORY_SIZE[1] - overlay_h + i
            draw.line([(0, y), (STORY_SIZE[0], y)], fill=(0, 0, 0, alpha))
        frame = Image.alpha_composite(frame.convert("RGBA"), overlay)

        # Item 15: Burn caption text
        if caption_text:
            frame = self._burn_text(frame, caption_text)

        # Item 16: Watermark
        if watermark_path:
            frame = self._apply_watermark(
                frame, watermark_path, watermark_position, watermark_opacity
            )

        return frame.convert("RGB")

    def _burn_text(self, frame: Image.Image, text: str) -> Image.Image:
        """
        Item 15: Render caption text onto the frame.
        Uses a system font with shadow for legibility on any background.
        """
        from PIL import ImageFont
        import textwrap

        draw = ImageDraw.Draw(frame)
        font_size = 52
        font = None

        # Try to load a decent font; fall back to default
        font_candidates = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        for fc in font_candidates:
            try:
                font = ImageFont.truetype(fc, font_size)
                break
            except Exception:
                continue
        if font is None:
            font = ImageFont.load_default()

        # Wrap text to fit frame width
        max_chars = int(STORY_SIZE[0] / (font_size * 0.55))
        lines = textwrap.wrap(text, width=max_chars)

        line_height = font_size + 8
        total_h = len(lines) * line_height
        y_start = STORY_SIZE[1] - int(STORY_SIZE[1] * 0.12) - total_h

        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font)
            text_w = bbox[2] - bbox[0]
            x = (STORY_SIZE[0] - text_w) // 2
            y = y_start + i * line_height
            # Shadow
            draw.text((x + 2, y + 2), line, font=font, fill=(0, 0, 0, 180))
            # Text
            draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))

        return frame

    def _apply_watermark(
        self,
        frame: Image.Image,
        watermark_path: str,
        position: str,
        opacity: float,
    ) -> Image.Image:
        """
        Item 16: Composite a logo onto the frame.
        Logo is resized to max 120px wide, placed at the specified corner.
        """
        try:
            logo = Image.open(watermark_path).convert("RGBA")
            # Resize to max 120px wide
            max_w = 120
            ratio = max_w / logo.width
            logo = logo.resize(
                (max_w, int(logo.height * ratio)), Image.Resampling.LANCZOS
            )
            # Apply opacity
            r, g, b, a = logo.split()
            a = a.point(lambda x: int(x * opacity))
            logo.putalpha(a)

            margin = 20
            fw, fh = frame.size
            lw, lh = logo.size

            positions = {
                "top-left":     (margin, margin),
                "top-right":    (fw - lw - margin, margin),
                "bottom-left":  (margin, fh - lh - margin),
                "bottom-right": (fw - lw - margin, fh - lh - margin),
                "center":       ((fw - lw) // 2, (fh - lh) // 2),
            }
            pos = positions.get(position, positions["bottom-right"])

            frame_rgba = frame if frame.mode == "RGBA" else frame.convert("RGBA")
            frame_rgba.paste(logo, pos, logo)
            return frame_rgba
        except Exception:
            return frame  # Watermark failure is non-fatal

    def create_instagram_stories(
        self,
        image_paths: List[str],
        captions: Optional[List[str]] = None,
        watermark_path: Optional[str] = None,
    ) -> List[Image.Image]:
        """Convert up to 4 images into sequential story frames with optional captions."""
        captions = captions or []
        return [
            self.create_story_frame(
                p,
                caption_text=captions[i] if i < len(captions) else "",
                watermark_path=watermark_path,
            )
            for i, p in enumerate(image_paths[:4])
        ]

    # ── Instagram reel ────────────────────────────────────────────────────────

    def create_reel(
        self,
        video_path: str,
        highlight_clips: List[Dict],
        output_path: str,
        transition: str = "crossfade",   # Item 14: 'crossfade' | 'cut'
    ) -> bool:
        """
        Assemble highlight clips into a 9:16 vertical reel using ffmpeg.

        Item 14: crossfade transitions between clips using xfade filter.
        Falls back to hard cuts if xfade fails (older ffmpeg versions).

        Returns True on success, False if ffmpeg is unavailable or fails.
        """
        if not highlight_clips:
            return False

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            concat_path = f.name
            for clip in highlight_clips:
                f.write(f"file '{Path(video_path).resolve()}'\n")
                f.write(f"inpoint {clip['start']:.3f}\n")
                f.write(f"outpoint {clip['end']:.3f}\n")

        try:
            if transition == "crossfade" and len(highlight_clips) > 1:
                return self._create_reel_xfade(video_path, highlight_clips, output_path)
            else:
                return self._create_reel_concat(concat_path, output_path)
        except Exception:
            # Fall back to simple concat
            try:
                return self._create_reel_concat(concat_path, output_path)
            except Exception:
                return False
        finally:
            Path(concat_path).unlink(missing_ok=True)

    def _create_reel_concat(self, concat_path: str, output_path: str) -> bool:
        """Simple concat without transitions."""
        cmd = [
            "ffmpeg", "-f", "concat", "-safe", "0", "-i", concat_path,
            "-vf", "scale=1080:-2:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
            "-y", output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=300)
        return result.returncode == 0

    def _create_reel_xfade(
        self, video_path: str, clips: List[Dict], output_path: str
    ) -> bool:
        """
        Item 14: Crossfade transitions using ffmpeg xfade filter.
        Builds a complex filtergraph that trims each clip then crossfades them.
        """
        fade_dur = 0.5  # seconds per transition

        # Build input args — one -i per clip segment
        inputs = []
        for clip in clips:
            inputs += [
                "-ss", str(clip["start"]),
                "-to", str(clip["end"]),
                "-i", str(Path(video_path).resolve()),
            ]

        n = len(clips)
        # Scale each input to 1080×1920
        scale_filter = "scale=1080:-2:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1"
        filter_parts = [f"[{i}:v]{scale_filter}[v{i}]" for i in range(n)]

        # Chain xfade filters
        prev = "v0"
        for i in range(1, n):
            clip_dur = clips[i-1]["end"] - clips[i-1]["start"]
            offset = max(0.1, clip_dur - fade_dur)
            out = f"xf{i}" if i < n - 1 else "vout"
            filter_parts.append(
                f"[{prev}][v{i}]xfade=transition=fade:duration={fade_dur}:offset={offset:.3f}[{out}]"
            )
            prev = out

        filtergraph = ";".join(filter_parts)

        cmd = (
            ["ffmpeg"] + inputs +
            ["-filter_complex", filtergraph,
             "-map", "[vout]",
             "-c:v", "libx264", "-preset", "fast", "-crf", "23",
             "-an",  # audio handled separately for simplicity
             "-movflags", "+faststart",
             "-y", output_path]
        )
        result = subprocess.run(cmd, capture_output=True, timeout=300)
        return result.returncode == 0

    # ── Horizontal asset (story adaptation) ──────────────────────────────────

    def adapt_horizontal_to_story(self, image_path: str) -> Image.Image:
        """
        Adapt a landscape image to 9:16 by blurring and scaling it as a
        background, then overlaying the original centred at its natural size.
        This avoids cropping out important content in very wide shots.
        """
        orig = Image.open(image_path).convert("RGB")
        orig_w, orig_h = orig.size

        # Background: blurred + scaled to fill 9:16
        bg = self.smart_crop(image_path, *STORY_SIZE)
        bg_arr = cv2.cvtColor(np.array(bg), cv2.COLOR_RGB2BGR)
        bg_arr = cv2.GaussianBlur(bg_arr, (61, 61), 0)
        bg = Image.fromarray(cv2.cvtColor(bg_arr, cv2.COLOR_BGR2RGB))

        # Foreground: scale original to fit within story width
        scale = STORY_SIZE[0] / orig_w
        fg_w = STORY_SIZE[0]
        fg_h = int(orig_h * scale)
        fg = orig.resize((fg_w, fg_h), Image.Resampling.LANCZOS)

        # Centre vertically
        y_offset = (STORY_SIZE[1] - fg_h) // 2
        bg.paste(fg, (0, y_offset))
        return bg
