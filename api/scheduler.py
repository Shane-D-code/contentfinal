"""
api/scheduler.py — In-memory async job store using APScheduler.

This is the fallback when Celery + Redis are not available.
Jobs run in a background thread pool managed by APScheduler.
Results are stored in memory (lost on restart — acceptable for dev/demo).

For production with persistence, the Celery path in api/tasks.py is preferred.
The API automatically uses whichever is available:
  - Redis reachable → Celery tasks (persistent, distributed)
  - Redis unavailable → this module (in-process, ephemeral)

Job lifecycle:
  pending → running → completed | failed
"""

import uuid
import traceback
from datetime import datetime
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor

from apscheduler.schedulers.background import BackgroundScheduler
from api.logger import get_logger

logger = get_logger(__name__)

# ── In-memory store ───────────────────────────────────────────────────────────
# {job_id: {status, type, result, error, created_at, updated_at, progress}}
_jobs: Dict[str, Dict[str, Any]] = {}

# Thread pool — concurrency=1 keeps ML memory usage bounded
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ce_job")

# APScheduler instance (also used for cleanup scheduling in main.py)
_scheduler = BackgroundScheduler(daemon=True)
_scheduler.start()


# ── Public API ────────────────────────────────────────────────────────────────

def submit_pipeline_job(asset_paths: list, event_description: str = "Event") -> str:
    """
    Submit an ML selection pipeline job.
    Returns job_id immediately; job runs in background thread.
    """
    job_id = _new_job("pipeline")
    _executor.submit(_run_pipeline, job_id, asset_paths, event_description)
    logger.info("job_submitted", job_id=job_id, type="pipeline", assets=len(asset_paths))
    return job_id


def submit_generate_job(
    asset_paths: list,
    event_name: str = "Event",
    event_description: str = "Event",
) -> str:
    """
    Submit a full content generation job.
    Returns job_id immediately; job runs in background thread.
    """
    job_id = _new_job("generate")
    _executor.submit(_run_generate, job_id, asset_paths, event_name, event_description)
    logger.info("job_submitted", job_id=job_id, type="generate", assets=len(asset_paths))
    return job_id


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Return job dict or None if not found."""
    return _jobs.get(job_id)


def get_scheduler() -> BackgroundScheduler:
    """Return the shared APScheduler instance (used by main.py for cleanup)."""
    return _scheduler


# ── Internal helpers ──────────────────────────────────────────────────────────

def _new_job(job_type: str) -> str:
    job_id = uuid.uuid4().hex
    _jobs[job_id] = {
        "job_id":     job_id,
        "type":       job_type,
        "status":     "pending",
        "progress":   {"step": "queued", "pct": 0},
        "result":     None,
        "error":      None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    return job_id


def _update(job_id: str, **kwargs) -> None:
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)
        _jobs[job_id]["updated_at"] = datetime.utcnow().isoformat()


def _run_pipeline(job_id: str, asset_paths: list, event_description: str) -> None:
    """Background thread: run ML selection pipeline."""
    try:
        _update(job_id, status="running", progress={"step": "loading_models", "pct": 10})

        from content_engine import ContentEngine
        engine = ContentEngine(event_description=event_description)

        _update(job_id, progress={"step": "processing_assets", "pct": 30})
        selections = engine.select_assets(asset_paths)

        _update(job_id, progress={"step": "serialising", "pct": 90})

        from pathlib import Path
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

        _update(
            job_id,
            status="completed",
            progress={"step": "done", "pct": 100},
            result={
                "status":     "completed",
                "event":      event_description,
                "total":      len(results),
                "selections": results,
            },
        )
        logger.info("job_completed", job_id=job_id, type="pipeline", selected=len(results))

    except Exception as exc:
        _update(job_id, status="failed", error=str(exc))
        logger.error("job_failed", job_id=job_id, type="pipeline", error=str(exc),
                     traceback=traceback.format_exc())


def _run_generate(
    job_id: str,
    asset_paths: list,
    event_name: str,
    event_description: str,
) -> None:
    """Background thread: run full content generation."""
    import shutil
    import tempfile
    from pathlib import Path

    tmp_dir = Path(tempfile.mkdtemp(prefix="ce_gen_"))
    try:
        _update(job_id, status="running", progress={"step": "loading_models", "pct": 5})

        for p in asset_paths:
            shutil.copy(p, tmp_dir / Path(p).name)

        _update(job_id, progress={"step": "ml_selection", "pct": 20})

        from content_engine.orchestrator import ContentOrchestrator
        from config import settings

        orch = ContentOrchestrator(
            event_name=event_name,
            event_description=event_description,
        )

        _update(job_id, progress={"step": "layout_assembly", "pct": 50})
        out_dir = orch.run(str(tmp_dir), output_root=str(settings.output_dir))

        _update(job_id, progress={"step": "finalising", "pct": 90})

        event_slug = out_dir.name  # e.g. "Tech_Summit_2024"
        output_files = {}
        captions = {}

        for f in sorted(out_dir.iterdir()):
            if not f.is_file():
                continue
            web_url = f"/output/{event_slug}/{f.name}"
            output_files[f.name] = web_url

            # Read text files so frontend gets captions without disk access
            if f.suffix in (".txt", ".md"):
                try:
                    key = f.stem  # e.g. "linkedin_caption", "case_study"
                    captions[key] = f.read_text(encoding="utf-8").strip()
                except Exception:
                    pass

        _update(
            job_id,
            status="completed",
            progress={"step": "done", "pct": 100},
            result={
                "status":     "completed",
                "event":      event_name,
                "output_dir": str(out_dir.resolve()),
                "files":      output_files,
                "captions":   captions,
            },
        )
        logger.info("job_completed", job_id=job_id, type="generate", files=len(output_files))

    except Exception as exc:
        _update(job_id, status="failed", error=str(exc))
        logger.error("job_failed", job_id=job_id, type="generate", error=str(exc),
                     traceback=traceback.format_exc())
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
