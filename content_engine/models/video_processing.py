"""
Video Processor — Scene Detection + Audio Energy + Highlight Extraction

Item 14: Video content scoring
  - Scene detection via PySceneDetect (ContentDetector, threshold 30)
  - Frame scoring via CLIP similarity to "exciting event" prompts
  - Audio energy via librosa RMS (captures applause, cheering, music)
  - Combined score: 0.7 × frame_score + 0.3 × audio_energy
  - Highlight extraction: greedy selection of clips up to target_duration

Returns:
  - extract_highlights(video_path, target_duration=45) → List[Dict]
    Each dict: {start, end, score} in seconds
"""

import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Optional


class VideoProcessor:
    """
    Processes videos to extract highlight clips.
    Combines visual (CLIP frame scoring) and audio (librosa RMS energy) signals.
    """

    def __init__(self):
        self._clip_model = None

    # ── CLIP lazy-load ──────────────────────────────────────────────────────────

    @property
    def clip_model(self):
        if self._clip_model is None:
            from sentence_transformers import SentenceTransformer
            from content_engine.utils.mps_safe import MPS_DEVICE
            self._clip_model = SentenceTransformer("clip-ViT-B-32", device=MPS_DEVICE)
        return self._clip_model

    # ── Scene detection ──────────────────────────────────────────────────────────

    def extract_scenes(self, video_path: str) -> List[float]:
        """
        Find scene change timestamps using PySceneDetect.
        Returns list of scene start times in seconds.
        """
        from scenedetect import VideoManager, SceneManager
        from scenedetect.detectors import ContentDetector

        video_manager = VideoManager([video_path])
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=30.0))

        try:
            video_manager.start()
            scene_manager.detect_scenes(frame_source=video_manager)
            scenes = scene_manager.get_scene_list()
        finally:
            video_manager.release()

        return [scene[0].get_seconds() for scene in scenes]

    # ── Audio energy extraction ─────────────────────────────────────────────────

    def compute_audio_energy(self, video_path: str) -> List[float]:
        """
        Extract RMS audio energy per 0.5s segment.
        Higher energy segments capture applause, cheering, music.

        Returns:
            List of energy values (0–1 normalised) per segment
        """
        import tempfile
        import subprocess
        import librosa

        audio_path = Path(tempfile.mktemp(suffix=".wav"))
        try:
            # Convert video to mono 16kHz WAV (ffmpeg must be installed)
            result = subprocess.run(
                [
                    "ffmpeg", "-i", video_path,
                    "-ac", "1", "-ar", "16000",
                    str(audio_path),
                    "-y", "-loglevel", "quiet",
                ],
                capture_output=True,
                check=False,
            )
            if result.returncode != 0:
                return []

            # Load and analyse
            y, sr = librosa.load(str(audio_path), sr=16000)
            hop_length = sr // 2  # 0.5 second chunks
            energy = librosa.feature.rms(y=y, hop_length=hop_length)[0]

            # Normalise to 0–1 range
            energy_min, energy_max = energy.min(), energy.max()
            if energy_max > energy_min:
                energy_norm = (energy - energy_min) / (energy_max - energy_min)
            else:
                energy_norm = energy

            return energy_norm.tolist()
        except Exception:
            return []
        finally:
            audio_path.unlink(missing_ok=True)

    # ── Frame quality scoring ───────────────────────────────────────────────────

    def score_frame(self, frame: np.ndarray) -> float:
        """
        CLIP similarity to "exciting event" prompt set.
        Returns 0–1 score for highlight potential.
        """
        from PIL import Image

        pil_frame = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        frame_emb = self.clip_model.encode(pil_frame)

        # Exciting event prompts
        exciting_embs = self.clip_model.encode([
            "action scene", "crowd cheering", "applause",
            "excitement", "speaking passionately", "award being handed",
            "stage lighting", "dynamic event", "peak moment",
        ]).mean(axis=0)

        import torch
        from content_engine.utils.mps_safe import empty_cache
        similarity = torch.cosine_similarity(
            torch.tensor(frame_emb), torch.tensor(exciting_embs), dim=0
        ).item()
        empty_cache()
        return float((similarity + 1.0) / 2.0)  # Normalise to 0–1

    # ── Highlight extraction ────────────────────────────────────────────────────

    def extract_highlights(
        self,
        video_path: str,
        target_duration: float = 45.0,
        min_clip_duration: float = 2.0,
    ) -> List[Dict]:
        """
        Extract top highlight clips from a video.

        Algorithm:
          1. Find scene boundaries (PySceneDetect)
          2. Score each scene's first frame with CLIP
          3. Factor in audio energy for each segment
          4. Greedy selection: pick highest-scoring clips up to target_duration
          5. Return ordered list: beginning → middle → end (narrative arc)

        Returns:
            List of {start, end, score} dicts (in seconds)
        """
        # Get scene boundaries
        scenes = self.extract_scenes(video_path)
        if not scenes:
            # Fallback: single scene covering the whole video
            cap = cv2.VideoCapture(video_path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            cap.release()
            if total_frames > 0:
                scenes = [0.0, total_frames / fps]
            else:
                return []

        # Read frames at scene starts and score them
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        scene_scores: List[tuple] = []  # (start_time, score)

        for scene_start in scenes:
            idx = int(scene_start * fps)
            if idx >= total_frames:
                continue
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                continue
            score = self.score_frame(frame)
            scene_scores.append((scene_start, score))

        cap.release()

        if not scene_scores:
            return []

        # Factor in audio energy
        audio_energy = self.compute_audio_energy(video_path)
        if audio_energy:
            # Align: 0.5s per energy bucket, align with scene timestamps
            for i, (timestamp, score) in enumerate(scene_scores):
                energy_idx = int(timestamp / 0.5)
                if energy_idx < len(audio_energy):
                    # Boost by audio energy: score = 0.7*frame + 0.3*audio
                    audio_boost = audio_energy[energy_idx]
                    scene_scores[i] = (timestamp, score * (0.7 + 0.3 * audio_boost))

        # Sort by score descending
        scene_scores.sort(key=lambda x: x[1], reverse=True)

        # Greedy selection to build highlights list
        highlights: List[Dict] = []
        total_time = 0.0

        for timestamp, score in scene_scores:
            if total_time + min_clip_duration > target_duration:
                break

            # Find next scene boundary
            next_times = [s for s in scenes if s > timestamp]
            next_time = next_times[0] if next_times else timestamp + 5.0
            clip_duration = min(next_time - timestamp, target_duration - total_time)

            if clip_duration >= min_clip_duration:
                highlights.append({
                    "start": round(timestamp, 2),
                    "end":   round(timestamp + clip_duration, 2),
                    "score": round(score, 4),
                })
                total_time += clip_duration

        # Ensure at least one clip (take from highest scored scene)
        if not highlights and scene_scores:
            ts, score = scene_scores[0]
            highlights.append({
                "start": round(ts, 2),
                "end":   round(ts + min(target_duration, 5.0), 2),
                "score": round(score, 4),
            })

        # Sort by start time for narrative order (beginning → end)
        highlights.sort(key=lambda h: h["start"])

        return highlights