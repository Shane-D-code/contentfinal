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
        Find scene change timestamps using PySceneDetect (v0.6+ modern API).
        Returns list of scene start times in seconds.

        Uses open_video + SceneManager instead of the deprecated VideoManager.
        Falls back to interval-based segmentation if scene detection fails.
        """
        try:
            from scenedetect import open_video, SceneManager, ContentDetector

            video = open_video(video_path)
            scene_manager = SceneManager()
            scene_manager.add_detector(ContentDetector(threshold=30.0))
            scene_manager.detect_scenes(video=video)
            scenes = scene_manager.get_scene_list()
            return [scene[0].get_seconds() for scene in scenes]

        except Exception as e:
            # Graceful fallback: interval-based segmentation every 3 seconds
            try:
                from api.logger import get_logger
                _log = get_logger(__name__)
                _log.warning("scene_detection_failed", error=str(e), fallback="interval_3s")
            except Exception:
                import logging
                logging.getLogger(__name__).warning(
                    "scene_detection_failed — falling back to interval segmentation: %s", e
                )
            return self._interval_scenes(video_path, interval=3.0)

    def _interval_scenes(self, video_path: str, interval: float = 3.0) -> List[float]:
        """
        Fallback: return scene start times at fixed intervals.
        Used when PySceneDetect fails (corrupt file, unsupported codec, etc.).
        """
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()
        if total_frames <= 0 or fps <= 0:
            return []
        duration = total_frames / fps
        return [round(t, 2) for t in np.arange(0.0, duration, interval).tolist()]

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

        # Build candidate clips for narrative sequencing (beginning/middle/end)
        clip_candidates: List[Dict] = []
        video_duration = (total_frames / fps) if fps > 0 else 0.0
        for timestamp, score in scene_scores:
            next_times = [s for s in scenes if s > timestamp]
            next_time = next_times[0] if next_times else min(video_duration, timestamp + 5.0)
            clip_duration = max(0.0, next_time - timestamp)
            if clip_duration >= min_clip_duration:
                clip_candidates.append({
                    "start": float(timestamp),
                    "end": float(timestamp + clip_duration),
                    "score": float(score),
                })

        if not clip_candidates:
            return []

        thirds = [video_duration / 3.0, 2.0 * video_duration / 3.0]
        def _phase(ts: float) -> str:
            if ts < thirds[0]:
                return "beginning"
            if ts < thirds[1]:
                return "middle"
            return "end"

        for c in clip_candidates:
            c["phase"] = _phase(c["start"])

        # Pick strongest from each phase first, then backfill by score.
        highlights: List[Dict] = []
        used = set()
        total_time = 0.0
        for phase in ("beginning", "middle", "end"):
            phase_clips = [c for c in clip_candidates if c["phase"] == phase]
            if not phase_clips:
                continue
            best = max(phase_clips, key=lambda c: c["score"])
            dur = min(best["end"] - best["start"], target_duration - total_time)
            if dur >= min_clip_duration and total_time + dur <= target_duration:
                key = (best["start"], best["end"])
                used.add(key)
                highlights.append({
                    "start": round(best["start"], 2),
                    "end": round(best["start"] + dur, 2),
                    "score": round(best["score"], 4),
                    "phase": phase,
                    "pace_hint": "establish" if phase == "beginning" else ("build" if phase == "middle" else "payoff"),
                })
                total_time += dur

        remaining = sorted(clip_candidates, key=lambda c: c["score"], reverse=True)
        for c in remaining:
            if total_time + min_clip_duration > target_duration:
                break
            key = (c["start"], c["end"])
            if key in used:
                continue
            dur = min(c["end"] - c["start"], target_duration - total_time)
            if dur >= min_clip_duration:
                highlights.append({
                    "start": round(c["start"], 2),
                    "end": round(c["start"] + dur, 2),
                    "score": round(c["score"], 4),
                    "phase": c["phase"],
                    "pace_hint": "bridge",
                })
                total_time += dur

        # Ensure at least one clip (take from highest scored scene)
        if not highlights and clip_candidates:
            best = max(clip_candidates, key=lambda c: c["score"])
            highlights.append({
                "start": round(best["start"], 2),
                "end": round(best["start"] + min(target_duration, 5.0), 2),
                "score": round(best["score"], 4),
                "phase": best["phase"],
                "pace_hint": "single_peak",
            })

        # Sort by start time for narrative order (beginning → end)
        highlights.sort(key=lambda h: h["start"])

        return highlights
