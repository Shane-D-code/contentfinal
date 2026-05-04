"""
Celery tasks — long-running ML jobs offloaded from the API.

Each task updates its own state so the frontend can poll for progress.
"""

import shutil
import tempfile
import traceback
from pathlib import Path
from typing import List, Dict, Any

from api.worker import celery_app
from api.logger import get_logger

logger = get_logger(__name__)


# ── Helper: progress update ───────────────────────────────────────────────────

def _update(task, state: str, meta: Dict[str, Any]) -> None:
    """Update task state without raising — safe to call from any point."""
    try:
        task.update_state(state=state, meta=meta)
    except Exception:
        pass


# ── Task 1: Full pipeline (selection only) ────────────────────────────────────

@celery_app.task(bind=True, name="api.tasks.run_pipeline_task")
def run_pipeline_task(
    self,
    asset_paths: List[str],
    event_description: str = "Event",
) -> Dict[str, Any]:
    """
    Run ML selection pipeline on a list of already-saved asset paths.
    Returns serialisable selection results.
    """
    _update(self, "PROGRESS", {"step": "loading_models", "pct": 5})

    try:
        from content_engine import ContentEngine

        _update(self, "PROGRESS", {"step": "processing_assets", "pct": 20})
        engine = ContentEngine(event_description=event_description)
        selections = engine.select_assets(asset_paths)

        _update(self, "PROGRESS", {"step": "serialising", "pct": 90})

        results = []
        for s in selections:
            file_name = Path(s.asset.path).name
            results.append({
                "filename": file_name,
                "file_url": f"/uploads/{file_name}",
                "intended_use": s.intended_use,
                "confidence": round(s.confidence, 4),
                "low_confidence": s.confidence < 0.5,
                "selection_reason": s.selection_reason,
                "scores": {
                    "quality": round(s.asset.quality_score, 4),
                    "aesthetic": round(s.asset.aesthetic_score, 4),
                    "final": round(s.asset.final_score, 4),
                },
                "face_count": s.asset.face_count,
                "bboxes": [],          # populated by face endpoint, not pipeline
                "scene_concepts": s.asset.scene_concepts[:8],
                "asset_type": s.asset.asset_type,
                "duration": s.asset.duration,
                "highlight_clips": s.asset.highlight_clips or [],
            })

        return {
            "status": "completed",
            "event": event_description,
            "total": len(results),
            "selections": results,
        }

    except Exception as exc:
        logger.error(f"Pipeline task failed: {exc}\n{traceback.format_exc()}")
        raise self.retry(exc=exc, max_retries=0)  # Don't retry ML failures


# ── Task 2: Full generation (pipeline + layout + copy + case study) ───────────

@celery_app.task(bind=True, name="api.tasks.run_generate_task")
def run_generate_task(
    self,
    asset_paths: List[str],
    event_name: str = "Event",
    event_description: str = "Event",
) -> Dict[str, Any]:
    """
    Run the complete content generation pipeline.
    Returns paths to all generated output files.
    """
    _update(self, "PROGRESS", {"step": "loading_models", "pct": 5})

    tmp_dir = Path(tempfile.mkdtemp(prefix="ce_gen_"))
    try:
        # Copy assets to temp dir for orchestrator
        for p in asset_paths:
            shutil.copy(p, tmp_dir / Path(p).name)

        _update(self, "PROGRESS", {"step": "ml_selection", "pct": 20})

        from content_engine.orchestrator import ContentOrchestrator
        orch = ContentOrchestrator(
            event_name=event_name,
            event_description=event_description,
        )

        _update(self, "PROGRESS", {"step": "layout_assembly", "pct": 50})
        out_dir = orch.run(str(tmp_dir), output_root="output")

        _update(self, "PROGRESS", {"step": "finalising", "pct": 90})

        output_files = {
            f.name: str(f.resolve())
            for f in sorted(out_dir.iterdir())
            if f.is_file()
        }

        return {
            "status": "completed",
            "event": event_name,
            "output_dir": str(out_dir.resolve()),
            "files": output_files,
        }

    except Exception as exc:
        logger.error(f"Generate task failed: {exc}\n{traceback.format_exc()}")
        raise self.retry(exc=exc, max_retries=0)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
