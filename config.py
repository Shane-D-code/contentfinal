"""
Central configuration — reads from .env file.
Import this everywhere instead of hardcoding values.

Usage:
    from config import settings
    print(settings.upload_dir)
    print(settings.celery_broker_url)
"""

import os
from pathlib import Path
from typing import List

# Load .env if python-dotenv is available (graceful fallback otherwise)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def _list(key: str, default: str) -> List[str]:
    """Parse a comma-separated env var into a list of stripped strings."""
    raw = os.getenv(key, default)
    return [s.strip() for s in raw.split(",") if s.strip()]


class Settings:
    # ── Server ────────────────────────────────────────────────────────────────
    api_host: str  = os.getenv("API_HOST", "0.0.0.0")
    api_port: int  = int(os.getenv("API_PORT", "8000"))
    api_workers: int = int(os.getenv("API_WORKERS", "1"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: List[str] = _list("CORS_ORIGINS", "http://localhost:5173")

    # ── Storage ───────────────────────────────────────────────────────────────
    upload_dir: Path    = Path(os.getenv("UPLOAD_DIR",    "uploads"))
    output_dir: Path    = Path(os.getenv("OUTPUT_DIR",    "output"))
    model_cache_dir: Path = Path(os.getenv("MODEL_CACHE_DIR", "models"))
    log_dir: Path       = Path(os.getenv("LOG_DIR",       "logs"))
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "200"))

    # ── Cleanup ───────────────────────────────────────────────────────────────
    upload_retention_days: int = int(os.getenv("UPLOAD_RETENTION_DAYS", "7"))
    output_retention_days: int = int(os.getenv("OUTPUT_RETENTION_DAYS", "30"))

    # ── ML thresholds ─────────────────────────────────────────────────────────
    face_confidence_threshold: float  = float(os.getenv("FACE_CONFIDENCE_THRESHOLD", "0.35"))
    quality_min_score: float          = float(os.getenv("QUALITY_MIN_SCORE", "0.30"))
    quality_blur_threshold: float     = float(os.getenv("QUALITY_BLUR_THRESHOLD", "300"))
    face_size_weight_threshold: float = float(os.getenv("FACE_SIZE_WEIGHT_THRESHOLD", "0.05"))

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # ── Celery ────────────────────────────────────────────────────────────────
    celery_broker_url: str    = os.getenv("CELERY_BROKER_URL",    "redis://localhost:6379/0")
    celery_result_backend: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
    celery_worker_concurrency: int         = int(os.getenv("CELERY_WORKER_CONCURRENCY", "1"))
    celery_worker_max_tasks_per_child: int = int(os.getenv("CELERY_WORKER_MAX_TASKS_PER_CHILD", "50"))
    celery_task_time_limit: int      = int(os.getenv("CELERY_TASK_TIME_LIMIT", "600"))
    celery_task_soft_time_limit: int = int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", "540"))

    # ── Flower ────────────────────────────────────────────────────────────────
    flower_port: int     = int(os.getenv("FLOWER_PORT", "5555"))
    flower_enabled: bool = os.getenv("FLOWER_ENABLED", "true").lower() == "true"
    flower_user: str     = os.getenv("FLOWER_USER", "admin")
    flower_password: str = os.getenv("FLOWER_PASSWORD", "admin")

    # ── Monitoring ────────────────────────────────────────────────────────────
    sentry_dsn: str = os.getenv("SENTRY_DSN", "")

    # ── Derived properties ────────────────────────────────────────────────────
    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    # ── Allowed MIME types ────────────────────────────────────────────────────
    allowed_image_types: List[str] = [
        "image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff",
    ]
    allowed_video_types: List[str] = [
        "video/mp4", "video/quicktime", "video/x-msvideo",
        "video/x-matroska", "video/webm",
    ]

    @property
    def allowed_mime_types(self) -> List[str]:
        return self.allowed_image_types + self.allowed_video_types


settings = Settings()

# Ensure required directories exist at import time
for _d in (settings.upload_dir, settings.output_dir, settings.log_dir):
    _d.mkdir(parents=True, exist_ok=True)
