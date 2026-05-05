"""
FastAPI backend — Content & Design Engine
All configuration read from .env via config.py

Async job processing:
  - Redis available → Celery (persistent, distributed, retryable)
  - Redis unavailable → APScheduler in-process (dev/demo fallback)

Both backends expose the same /api/jobs/{id}/status and /api/jobs/{id}/result
endpoints, so the frontend doesn't need to know which backend is active.
"""

import uuid
import shutil
import time
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncio
import uvicorn

from config import settings
from api.logger import get_logger, request_id_var, setup_logging

# Initialise structured logging before any logger.* calls
setup_logging(
    log_level=settings.log_level,
    json_output=(settings.log_level.upper() != "DEBUG"),
)

logger = get_logger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Content & Design Engine",
    version="2.0.0",
    description="AI-powered social media content generator from event photos/videos",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    """
    On startup:
    1. Schedule daily cleanup via APScheduler (no cron/Docker needed)
    2. Log which job backend is active
    """
    # Daily cleanup at 03:00 UTC
    try:
        from api.scheduler import get_scheduler
        from cleanup import run_cleanup

        sched = get_scheduler()
        sched.add_job(
            lambda: run_cleanup(
                upload_days=settings.upload_retention_days,
                output_days=settings.output_retention_days,
            ),
            trigger="cron",
            hour=3, minute=0,
            id="daily_cleanup",
            replace_existing=True,
        )
        logger.info("cleanup_scheduler_started", schedule="daily at 03:00 UTC")
    except Exception as e:
        logger.warning("cleanup_scheduler_failed", error=str(e))

    # Log active job backend
    try:
        import redis as redis_lib
        r = redis_lib.from_url(settings.redis_url, socket_connect_timeout=1)
        r.ping()
        logger.info("job_backend", backend="celery+redis", url=settings.redis_url)
    except Exception:
        logger.info(
            "job_backend",
            backend="apscheduler_in_memory",
            note="Redis unavailable — async jobs run in-process (dev mode)",
        )

# ── Request ID + timing middleware ────────────────────────────────────────────

@app.middleware("http")
async def request_middleware(request: Request, call_next):
    rid = str(uuid.uuid4())[:8]
    request_id_var.set(rid)
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - start) * 1000)
    logger.info(f"[{rid}] {request.method} {request.url.path} → {response.status_code} ({elapsed}ms)")
    response.headers["X-Request-ID"] = rid
    return response

# ── Static files ──────────────────────────────────────────────────────────────

import os
os.makedirs(str(settings.output_dir), exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")
app.mount("/output",  StaticFiles(directory=str(settings.output_dir)), name="output")

# ── Lazy model singletons ─────────────────────────────────────────────────────

_quality_assessor    = None
_face_detector       = None
_content_understander = None
_video_processor     = None
_engine              = None


def get_quality_assessor():
    global _quality_assessor
    if _quality_assessor is None:
        from content_engine.models.quality import QualityAssessor
        _quality_assessor = QualityAssessor()
    return _quality_assessor


def get_face_detector():
    global _face_detector
    if _face_detector is None:
        from content_engine.models.face_detection import FaceDetector
        _face_detector = FaceDetector()
    return _face_detector


def get_content_understander():
    global _content_understander
    if _content_understander is None:
        from content_engine.models.content_understanding import ContentUnderstander
        _content_understander = ContentUnderstander()
    return _content_understander


def get_video_processor():
    global _video_processor
    if _video_processor is None:
        from content_engine.models.video_processing import VideoProcessor
        _video_processor = VideoProcessor()
    return _video_processor


# ── File validation ───────────────────────────────────────────────────────────

async def validate_upload(file: UploadFile) -> Path:
    """
    Validate MIME type (via python-magic, not spoofable Content-Type header)
    and file size, then save to uploads/ with a UUID filename.
    Raises HTTP 413 for oversized files, HTTP 400 for invalid MIME types.
    """
    data = await file.read()

    # Size check
    if len(data) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File '{file.filename}' is {len(data) // (1024*1024)}MB. "
                f"Maximum allowed: {settings.max_file_size_mb}MB."
            ),
        )

    # Real MIME type from file bytes
    try:
        import magic as libmagic
        detected_mime = libmagic.from_buffer(data[:2048], mime=True)
    except Exception:
        detected_mime = file.content_type or "application/octet-stream"

    if detected_mime not in settings.allowed_mime_types:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File '{file.filename}' has unsupported type '{detected_mime}'. "
                f"Allowed: {', '.join(settings.allowed_mime_types)}"
            ),
        )

    ext  = Path(file.filename or "upload").suffix.lower() or ".bin"
    dest = settings.upload_dir / f"{uuid.uuid4().hex}{ext}"
    dest.write_bytes(data)

    logger.info(
        "upload_saved",
        filename=file.filename,
        dest=dest.name,
        size_kb=len(data) // 1024,
        mime=detected_mime,
    )
    return dest


async def validate_uploads(files: List[UploadFile]) -> List[Path]:
    return [await validate_upload(f) for f in files]


# ── Health & status ───────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Health check — also reports Redis/Celery availability."""
    redis_ok = False
    try:
        import redis as redis_lib
        redis_lib.from_url(settings.redis_url, socket_connect_timeout=1).ping()
        redis_ok = True
    except Exception:
        pass

    return {
        "status":  "ok",
        "version": "2.0.0",
        "redis":   redis_ok,
        "backend": "celery" if redis_ok else "apscheduler",
    }


@app.get("/api/model-status")
def model_status():
    """Check which ML packages are installed."""
    status = {}
    for pkg in ["torch", "transformers", "ultralytics", "sentence_transformers",
                "cv2", "librosa", "scenedetect", "celery", "redis", "flower", "groq"]:
        try:
            __import__(pkg)
            status[pkg] = "available"
        except ImportError:
            status[pkg] = "not installed"

    # Check Groq key configured
    status["groq_configured"] = "yes" if settings.groq_api_key else "no"
    status["groq_model"]      = settings.groq_model if settings.groq_api_key else "—"
    return status


# ── Individual ML model endpoints ─────────────────────────────────────────────

@app.post("/api/quality")
async def assess_quality(file: UploadFile = File(...)):
    path = await validate_upload(file)
    try:
        result = get_quality_assessor().assess(str(path))
        return {"filename": file.filename, "file_url": f"/uploads/{path.name}", "scores": result}
    except Exception as e:
        logger.error(f"Quality assessment failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/faces")
async def detect_faces(file: UploadFile = File(...)):
    """Returns face count, per-face confidences, and normalised bounding boxes."""
    path = await validate_upload(file)
    try:
        detector = get_face_detector()
        results  = detector.model.predict(
            str(path), conf=settings.face_confidence_threshold, verbose=False
        )

        face_count  = 0
        confidences = []
        bboxes      = []
        w = h = 0

        if results and results[0].boxes is not None:
            boxes      = results[0].boxes
            face_count = len(boxes)
            confidences = [round(c, 3) for c in boxes.conf.cpu().tolist()]

            from PIL import Image as PILImage
            img = PILImage.open(str(path))
            w, h = img.size
            for box in boxes.xyxy.cpu().tolist():
                bboxes.append({
                    "x1": round(box[0] / w, 4),
                    "y1": round(box[1] / h, 4),
                    "x2": round(box[2] / w, 4),
                    "y2": round(box[3] / h, 4),
                })

        return {
            "filename":     file.filename,
            "file_url":     f"/uploads/{path.name}",
            "face_count":   face_count,
            "confidences":  confidences,
            "bboxes":       bboxes,
            "image_width":  w,
            "image_height": h,
        }
    except Exception as e:
        logger.error(f"Face detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/content")
async def understand_content(file: UploadFile = File(...)):
    path = await validate_upload(file)
    try:
        result = get_content_understander().understand_image(str(path))
        return {"filename": file.filename, "file_url": f"/uploads/{path.name}", **result}
    except Exception as e:
        logger.error(f"Content understanding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/highlights")
async def extract_highlights(file: UploadFile = File(...), target_duration: int = 45):
    path = await validate_upload(file)
    try:
        highlights = get_video_processor().extract_highlights(str(path), target_duration=target_duration)
        return {
            "filename":               file.filename,
            "file_url":               f"/uploads/{path.name}",
            "highlights":             highlights,
            "total_selected_seconds": round(sum(h["end"] - h["start"] for h in highlights), 2),
        }
    except Exception as e:
        logger.error(f"Highlight extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Synchronous pipeline (small batches / testing) ────────────────────────────

@app.post("/api/pipeline")
async def run_pipeline(
    files: List[UploadFile] = File(...),
    event_description: str = Form("Event"),
):
    paths = [str(p) for p in await validate_uploads(files)]
    try:
        from content_engine import ContentEngine
        engine     = ContentEngine(event_description=event_description)
        selections = engine.select_assets(paths)
        return {"event": event_description, "total": len(selections), "selections": _serialise_selections(selections)}
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Async pipeline via Celery (with APScheduler fallback) ─────────────────────

@app.post("/api/pipeline/async")
async def run_pipeline_async(
    files: List[UploadFile] = File(...),
    event_description: str = Form("Event"),
):
    """
    Submit pipeline job. Returns job_id immediately (<500ms).
    Uses Celery if Redis is available, otherwise APScheduler in-process.
    Poll /api/jobs/{job_id}/status for progress.
    """
    paths = [str(p) for p in await validate_uploads(files)]

    # Try Celery first
    try:
        import redis as redis_lib
        redis_lib.from_url(settings.redis_url, socket_connect_timeout=1).ping()
        from api.tasks import run_pipeline_task
        task = run_pipeline_task.delay(paths, event_description)
        logger.info("job_submitted", backend="celery", job_id=task.id)
        return {"job_id": task.id, "status": "queued", "backend": "celery"}
    except Exception:
        pass

    # Fallback: APScheduler in-memory
    from api.scheduler import submit_pipeline_job
    job_id = submit_pipeline_job(paths, event_description)
    return {"job_id": job_id, "status": "pending", "backend": "apscheduler"}


@app.post("/api/generate/async")
async def run_generate_async(
    files: List[UploadFile] = File(...),
    event_name: str = Form("Event"),
    event_description: str = Form("Event"),
):
    """
    Submit full generation job. Returns job_id immediately (<500ms).
    Uses Celery if Redis is available, otherwise APScheduler in-process.
    """
    paths = [str(p) for p in await validate_uploads(files)]

    # Try Celery first
    try:
        import redis as redis_lib
        redis_lib.from_url(settings.redis_url, socket_connect_timeout=1).ping()
        from api.tasks import run_generate_task
        task = run_generate_task.delay(paths, event_name, event_description)
        logger.info("job_submitted", backend="celery", job_id=task.id)
        return {"job_id": task.id, "status": "queued", "backend": "celery"}
    except Exception:
        pass

    # Fallback: APScheduler in-memory
    from api.scheduler import submit_generate_job
    job_id = submit_generate_job(paths, event_name, event_description)
    return {"job_id": job_id, "status": "pending", "backend": "apscheduler"}


# ── Job status & result ───────────────────────────────────────────────────────

@app.get("/api/jobs/{job_id}/status")
async def job_status(job_id: str):
    """
    Poll job status. Works for both Celery and APScheduler jobs.
    Returns: {job_id, status, progress: {step, pct}, backend, error?}
    """
    # APScheduler in-memory store (checked first — faster)
    from api.scheduler import get_job
    job = get_job(job_id)
    if job:
        return {
            "job_id":   job_id,
            "status":   job["status"],
            "progress": job.get("progress", {}),
            "backend":  "apscheduler",
            "error":    job.get("error"),
        }

    # Celery result backend
    try:
        from celery.result import AsyncResult
        from api.worker import celery_app
        result = AsyncResult(job_id, app=celery_app)
        info   = result.info or {}
        return {
            "job_id":   job_id,
            "status":   result.state,
            "progress": info if isinstance(info, dict) else {},
            "backend":  "celery",
            "error":    str(info) if result.state == "FAILURE" else None,
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found: {e}")


@app.get("/api/jobs/{job_id}/result")
async def job_result(job_id: str):
    """Retrieve completed job result (both backends)."""
    # APScheduler store
    from api.scheduler import get_job
    job = get_job(job_id)
    if job:
        if job["status"] == "completed":
            return job["result"]
        elif job["status"] == "failed":
            raise HTTPException(status_code=500, detail=job.get("error", "Job failed"))
        else:
            return {"job_id": job_id, "status": job["status"], "message": "Job not yet complete"}

    # Celery
    try:
        from celery.result import AsyncResult
        from api.worker import celery_app
        result = AsyncResult(job_id, app=celery_app)
        if result.state == "SUCCESS":
            return result.result
        elif result.state == "FAILURE":
            raise HTTPException(status_code=500, detail=str(result.info))
        else:
            return {"job_id": job_id, "status": result.state, "message": "Job not yet complete"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── WebSocket — real-time job updates ─────────────────────────────────────────

@app.websocket("/ws/jobs/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    """
    Push job status updates over WebSocket every second.
    Closes automatically when the job reaches a terminal state.
    """
    await websocket.accept()
    try:
        while True:
            status_data = await job_status(job_id)
            await websocket.send_json(status_data)
            if status_data.get("status") in ("completed", "SUCCESS", "failed", "FAILURE"):
                break
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# ── Synchronous generate (testing / small batches) ────────────────────────────

@app.post("/api/generate")
async def generate_content(
    files: List[UploadFile] = File(...),
    event_name: str = Form("Event"),
    event_description: str = Form("Event"),
):
    paths = [str(p) for p in await validate_uploads(files)]
    return await _sync_generate(paths, event_name, event_description)


# ── Groq caption regeneration (on-demand, no ML needed) ──────────────────────

@app.post("/api/captions/regenerate")
async def regenerate_captions(
    event_name: str = Form(...),
    event_description: str = Form(""),
    platform: str = Form("all"),   # "linkedin" | "instagram" | "reel" | "stories" | "all"
    scene_concepts: str = Form(""),  # comma-separated detected concepts
    face_count: int = Form(0),
):
    """
    Regenerate captions using Groq without re-running the full ML pipeline.
    Useful for the frontend "Regenerate" button in ResultsPage.
    """
    from content_engine.copy_generator import CopyGenerator
    from content_engine.data_types import AssetMetadata

    # Build a minimal synthetic asset list from the provided context
    concepts = [c.strip() for c in scene_concepts.split(",") if c.strip()]
    relevance = {c: 0.8 for c in concepts}

    synthetic_asset = AssetMetadata(
        path="synthetic",
        asset_type="image",
        quality_score=0.8,
        aesthetic_score=0.7,
        face_count=face_count,
        face_confidences=[0.9] * min(face_count, 5),
        relevance_scores=relevance,
        scene_concepts=concepts,
        final_score=0.75,
    )
    assets = [synthetic_asset]

    gen = CopyGenerator()
    result: dict = {"backend": gen.backend, "event": event_name}

    try:
        if platform in ("linkedin", "all"):
            result["linkedin"] = gen.generate_linkedin_caption(event_name, assets, event_description)
        if platform in ("instagram", "all"):
            result["instagram"] = gen.generate_instagram_caption(event_name, assets, event_description)
        if platform in ("reel", "all"):
            result["reel"] = gen.generate_reel_caption(event_name, assets, event_description)
        if platform in ("stories", "all"):
            result["stories"] = gen.generate_story_captions(event_name, 4, assets, event_description)
    except Exception as e:
        logger.error(f"Caption regeneration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return result


async def _sync_generate(paths, event_name, event_description):
    import tempfile
    tmp_dir = Path(tempfile.mkdtemp(prefix="ce_gen_"))
    try:
        for p in paths:
            shutil.copy(p, tmp_dir / Path(p).name)
        from content_engine.orchestrator import ContentOrchestrator
        orch    = ContentOrchestrator(event_name=event_name, event_description=event_description)
        out_dir = orch.run(str(tmp_dir), output_root=str(settings.output_dir))
        output_files = {f.name: str(f.resolve()) for f in sorted(out_dir.iterdir()) if f.is_file()}
        return {"event": event_name, "output_dir": str(out_dir.resolve()), "files": output_files}
    except Exception as e:
        logger.error(f"Generate failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialise_selections(selections) -> list:
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
    return results


if __name__ == "__main__":
    uvicorn.run(
        "api.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        log_level=settings.log_level.lower(),
    )
