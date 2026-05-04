"""
Celery tasks — long-running ML jobs offloaded from the API.

Each task:
  - Updates its own Celery state so the frontend can poll for progress
  - Uses retry with exponential backoff for transient failures
  - Cleans up temp files in a finally block
  - Returns a fully serialisable dict (no Python objects)

Task names are stable strings (not auto-generated) so they survive refactors.
"""

import shutil
import tempfile
import traceback
from pathlib import Path
from typing import List, Dict, Any

from celery.exceptions import SoftTimeLimitExceeded

from api.worker import celery_app
from api.logger import get_logger

logger = get_logger(__name__)


# ── Progress helper ───────────────────────────────────────────────────────────

def _update(task, step: str, pct: int) -> None:
    """
    Push a PROGRESS state update to the Celery result backend.
    Safe to call at any point — swallows all exceptions.
    """
    try:
        task.update_state(
            state="PROGRESS",
            meta={"step": step, "pct": pct},
        )
    except Exception:
        pass


# ── Task 1: Full pipeline (ML selection only) ─────────────────────────────────

@celery_app.task(
    bind=True,
    name="api.tasks.run_pipeline_task",
    max_retries=0,          # ML failures are deterministic — don't retry
    acks_late=True,
    reject_on_worker_lost=True,
)
def run_pipeline_task(
    self,
    asset_paths: List[str],
    event_description: str = "Event",
) -> Dict[str, Any]:
    """
    Run ML selection pipeline on a list of already-saved asset paths.

    Args:
        asset_paths:       Absolute paths to uploaded files.
        event_description: Human-readable event description for concept matching.

    Returns:
        Serialisable dict with selection results.
    """
    _update(self, "loading_models", 5)
    logger.info("pipeline_task_start", job_id=self.request.id, assets=len(asset_paths))

    try:
        from content_engine import ContentEngine

        _update(self, "processing_assets", 20)
        engine = ContentEngine(event_description=event_description)
        selections = engine.select_assets(asset_paths)

        _update(self, "serialising", 90)

        results = []
        for s in selections:
            file_name = Path(s.asset.path).name
            results.append({
                "filename":         file_name,
                "file_url":         f"/uploads/{file_name}",
                "intended_use":     s.intended_use,
                "confidence":       round(s.confidence, 4),
                "low_confidence":   s.confidence < 0.5,
                "selection_reason": s.selection_reason,
                "scores": {
                    "quality":   round(s.asset.quality_score, 4),
                    "aesthetic": round(s.asset.aesthetic_score, 4),
                    "final":     round(s.asset.final_score, 4),
                },
                "face_count":      s.asset.face_count,
                "bboxes":          [],
                "scene_concepts":  s.asset.scene_concepts[:8],
                "asset_type":      s.asset.asset_type,
                "duration":        s.asset.duration,
                "highlight_clips": s.asset.highlight_clips or [],
            })

        logger.info("pipeline_task_done", job_id=self.request.id, selected=len(results))
        return {
            "status":     "completed",
            "event":      event_description,
            "total":      len(results),
            "selections": results,
        }

    except SoftTimeLimitExceeded:
        logger.error("pipeline_task_timeout", job_id=self.request.id)
        raise

    except Exception as exc:
        logger.error(
            "pipeline_task_failed",
            job_id=self.request.id,
            error=str(exc),
            traceback=traceback.format_exc(),
        )
        raise  # Celery marks task as FAILURE


# ── Task 2: Full generation (pipeline + layout + copy + case study) ───────────

@celery_app.task(
    bind=True,
    name="api.tasks.run_generate_task",
    max_retries=0,
    acks_late=True,
    reject_on_worker_lost=True,
)
def run_generate_task(
    self,
    asset_paths: List[str],
    event_name: str = "Event",
    event_description: str = "Event",
) -> Dict[str, Any]:
    """
    Run the complete content generation pipeline.

    Args:
        asset_paths:       Absolute paths to uploaded files.
        event_name:        Display name for the event (used in filenames).
        event_description: Longer description for ML concept matching.

    Returns:
        Serialisable dict with web-accessible URLs for all generated files.
    """
    _update(self, "loading_models", 5)
    logger.info("generate_task_start", job_id=self.request.id, assets=len(asset_paths))

    tmp_dir = Path(tempfile.mkdtemp(prefix="ce_gen_"))
    try:
        # Copy assets to temp dir so orchestrator can work on them
        for p in asset_paths:
            shutil.copy(p, tmp_dir / Path(p).name)

        _update(self, "ml_selection", 20)

        from content_engine.orchestrator import ContentOrchestrator
        from config import settings

        orch = ContentOrchestrator(
            event_name=event_name,
            event_description=event_description,
        )

        _update(self, "layout_assembly", 50)
        out_dir = orch.run(str(tmp_dir), output_root=str(settings.output_dir))

        _update(self, "finalising", 90)

        # Build web-accessible URLs for every output file
        event_slug   = out_dir.name   # e.g. "Tech_Summit_2024"
        output_files: Dict[str, str] = {}
        captions:     Dict[str, str] = {}

        for f in sorted(out_dir.iterdir()):
            if not f.is_file():
                continue
            web_url = f"/output/{event_slug}/{f.name}"
            output_files[f.name] = web_url

            # Inline text content so the frontend doesn't need a second request
            if f.suffix in (".txt", ".md"):
                try:
                    captions[f.stem] = f.read_text(encoding="utf-8").strip()
                except Exception:
                    pass

        logger.info("generate_task_done", job_id=self.request.id, files=len(output_files))
        return {
            "status":     "completed",
            "event":      event_name,
            "output_dir": str(out_dir.resolve()),
            "files":      output_files,
            "captions":   captions,
        }

    except SoftTimeLimitExceeded:
        logger.error("generate_task_timeout", job_id=self.request.id)
        raise

    except Exception as exc:
        logger.error(
            "generate_task_failed",
            job_id=self.request.id,
            error=str(exc),
            traceback=traceback.format_exc(),
        )
        raise

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
