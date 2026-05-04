"""
ContentOrchestrator
End-to-end pipeline: raw assets → platform-ready content + case study.

Output structure:
  output/<EventName>/
    ├── linkedin_collage.jpg
    ├── linkedin_caption.txt
    ├── instagram_carousel_1.jpg  …  _N.jpg
    ├── instagram_caption.txt
    ├── instagram_reel.mp4          (if video assets present)
    ├── instagram_reel_caption.txt
    ├── instagram_story_1.jpg  …  _4.jpg
    ├── story_captions.txt
    ├── case_study.md
    └── selection_report.json

Usage:
    from content_engine.orchestrator import ContentOrchestrator

    orch = ContentOrchestrator("Tech Summit 2024")
    output_dir = orch.run("path/to/assets/")
"""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from content_engine.pipeline import ContentEngine
from content_engine.layout_assembler import LayoutAssembler
from content_engine.copy_generator import CopyGenerator
from content_engine.case_study_generator import generate_case_study
from content_engine.data_types import AssetMetadata, SelectionResult

try:
    from api.logger import get_logger
    _log = get_logger("content_engine.orchestrator")
except Exception:
    import logging
    _log = logging.getLogger("content_engine.orchestrator")


# Supported file extensions
_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}
_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
_ALL_EXTS   = _IMAGE_EXTS | _VIDEO_EXTS


def _safe_dirname(name: str) -> str:
    """Convert event name to a safe directory name."""
    return re.sub(r"[^\w\-]", "_", name).strip("_")


def _discover_assets(folder: str) -> List[str]:
    """Recursively find all supported image/video files."""
    assets = []
    for ext in _ALL_EXTS:
        assets.extend(str(p) for p in Path(folder).rglob(f"*{ext}"))
    return sorted(set(assets))


class ContentOrchestrator:
    """
    Ties together all pipeline stages:
      1. ML selection  (ContentEngine)
      2. Layout        (LayoutAssembler)
      3. Copy          (CopyGenerator)
      4. Case study    (generate_case_study)

    Models are loaded once and reused across calls.
    """

    def __init__(
        self,
        event_name: str,
        event_description: str = "",
        use_llm: bool = False,
        event_concepts: Optional[List[str]] = None,
    ):
        self.event_name        = event_name
        self.event_description = event_description or event_name


        _log.info('orchestrator_start', event_name=event_name)


        _log.info('models_loading')
        self._ml      = ContentEngine(
            event_description=self.event_description,
            event_concepts=event_concepts,
        )
        self._layout  = LayoutAssembler()
        self._copy    = CopyGenerator(use_llm=use_llm)
        _log.info("models_ready")

    # ── Main entry point ──────────────────────────────────────────────────────

    def run(
        self,
        asset_folder: str,
        output_root: str = "output",
        event_date: str = "",
    ) -> Path:
        """
        Process an entire asset folder and write all outputs.

        Args:
            asset_folder: Path to folder containing images/videos.
            output_root:  Root directory for outputs (default: ./output).
            event_date:   Optional date string for the case study.

        Returns:
            Path to the output directory.
        """
        # ── Discover assets ───────────────────────────────────────────────────
        assets = _discover_assets(asset_folder)
        n_img  = sum(1 for a in assets if Path(a).suffix.lower() in _IMAGE_EXTS)
        n_vid  = sum(1 for a in assets if Path(a).suffix.lower() in _VIDEO_EXTS)

        _log.info('assets_discovered', total=len(assets), images=n_img, videos=n_vid)

        if not assets:
            _log.warning("no_assets_found")
            return Path(output_root)

        # ── Output directory ──────────────────────────────────────────────────
        out_dir = Path(output_root) / _safe_dirname(self.event_name)
        out_dir.mkdir(parents=True, exist_ok=True)

        # ── Step 1: ML selection ──────────────────────────────────────────────
        _log.info('ml_selection_start')
        selections = self._ml.select_assets(assets)

        if not selections:
            _log.warning("no_assets_passed_filtering")
            return out_dir

        collage_assets    = [s.asset for s in selections if s.intended_use == "collage"]
        reel_selections   = [s      for s in selections if s.intended_use == "reel"]
        story_assets      = [s.asset for s in selections if s.intended_use == "story"]

        _log.info("assets_selected",
                  collage=len(collage_assets),
                  reel=len(reel_selections),
                  stories=len(story_assets))

        # Save selection report immediately
        self._save_selection_report(selections, out_dir)

        # ── Step 2: Layout assembly ───────────────────────────────────────────
        _log.info('layout_assembly_start')

        # LinkedIn collage
        if collage_assets:
            try:
                collage = self._layout.create_linkedin_collage(
                    [a.path for a in collage_assets]
                )
                collage.save(out_dir / "linkedin_collage.jpg", quality=95)
                _log.info('linkedin_collage_done', images=len(collage_assets))
            except Exception as e:
                _log.error('linkedin_collage_failed', error=str(e))

        # Instagram carousel
        if collage_assets:
            try:
                slides = self._layout.create_instagram_carousel(
                    [a.path for a in collage_assets]
                )
                for i, slide in enumerate(slides, 1):
                    slide.save(out_dir / f"instagram_carousel_{i}.jpg", quality=95)
                _log.info('carousel_done', slides=len(slides))
            except Exception as e:
                _log.error('carousel_failed', error=str(e))

        # Instagram stories
        if story_assets:
            try:
                story_frames = self._layout.create_instagram_stories(
                    [a.path for a in story_assets]
                )
                for i, frame in enumerate(story_frames, 1):
                    frame.save(out_dir / f"instagram_story_{i}.jpg", quality=95)
                _log.info('stories_done', frames=len(story_frames))
            except Exception as e:
                _log.error('stories_failed', error=str(e))

        # Instagram reel
        if reel_selections:
            reel_asset = reel_selections[0].asset
            if reel_asset.highlight_clips:
                try:
                    reel_path = str(out_dir / "instagram_reel.mp4")
                    ok = self._layout.create_reel(
                        reel_asset.path,
                        reel_asset.highlight_clips,
                        reel_path,
                    )
                    if ok:
                        total_s = sum(
                            c["end"] - c["start"]
                            for c in reel_asset.highlight_clips
                        )
                        _log.info('reel_done', duration_s=round(total_s), clips=len(reel_asset.highlight_clips))
                    else:
                        _log.warning('reel_failed', reason='ffmpeg_unavailable')
                except Exception as e:
                    _log.error('reel_failed', error=str(e))
            else:
                _log.info('reel_skipped', reason='no_highlight_clips')

        # ── Step 3: Copy generation ───────────────────────────────────────────
        _log.info('copy_generation_start')

        all_selected_assets = [s.asset for s in selections]

        captions = {
            "linkedin_caption.txt": self._copy.generate_linkedin_caption(
                self.event_name, collage_assets or all_selected_assets
            ),
            "instagram_caption.txt": self._copy.generate_instagram_caption(
                self.event_name, collage_assets or all_selected_assets
            ),
            "instagram_reel_caption.txt": self._copy.generate_reel_caption(
                self.event_name, all_selected_assets
            ),
        }

        for filename, text in captions.items():
            (out_dir / filename).write_text(text, encoding="utf-8")

        story_caps = self._copy.generate_story_captions(
            self.event_name, len(story_assets)
        )
        story_text = "\n".join(
            f"Story {i}: {cap}" for i, cap in enumerate(story_caps, 1)
        )
        (out_dir / "story_captions.txt").write_text(story_text, encoding="utf-8")

        _log.info('captions_written', count=4)

        # ── Step 4: Case study ────────────────────────────────────────────────
        _log.info('case_study_start')
        case_study_md = generate_case_study(
            selections=selections,
            event_name=self.event_name,
            event_date=event_date or datetime.now().strftime("%B %d, %Y"),
            total_assets_processed=len(assets),
        )
        (out_dir / "case_study.md").write_text(case_study_md, encoding="utf-8")
        _log.info("case_study_done")

        # ── Final summary ─────────────────────────────────────────────────────
        self._print_summary(selections, out_dir)
        return out_dir

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _save_selection_report(
        self,
        selections: List[SelectionResult],
        out_dir: Path,
    ) -> None:
        report = []
        for s in selections:
            report.append({
                "file":             Path(s.asset.path).name,
                "asset_type":       s.asset.asset_type,
                "intended_use":     s.intended_use,
                "confidence":       round(s.confidence, 4),
                "low_confidence":   s.confidence < 0.5,
                "selection_reason": s.selection_reason,
                "scores": {
                    "quality":   round(s.asset.quality_score,   4),
                    "aesthetic": round(s.asset.aesthetic_score, 4),
                    "final":     round(s.asset.final_score,     4),
                },
                "face_count":      s.asset.face_count,
                "scene_concepts":  s.asset.scene_concepts[:8],
                "highlight_clips": s.asset.highlight_clips or [],
            })
        (out_dir / "selection_report.json").write_text(
            json.dumps(report, indent=2), encoding="utf-8"
        )

    def _print_summary(
        self,
        selections: List[SelectionResult],
        out_dir: Path,
    ) -> None:
        low_conf = [s for s in selections if s.confidence < 0.5]


        _log.info('generation_complete')

        _log.info('output_dir', path=str(out_dir.resolve()))
        

        files = sorted(out_dir.iterdir())
        for f in files:
            size = f.stat().st_size
            size_str = f"{size/1024:.0f} KB" if size > 1024 else f"{size} B"
            

        if low_conf:
            _log.warning('low_confidence_selections', count=len(low_conf))
            for s in low_conf:
                _log.warning('low_confidence_asset', asset=Path(s.asset.path).name, confidence=f'{s.confidence:.0%}', use=s.intended_use)


