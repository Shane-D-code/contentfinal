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

# Load .env from the same directory as this file (works regardless of cwd)
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).parent / ".env"
    load_dotenv(_env_path if _env_path.exists() else None)
except ImportError:
    pass


def _list(key: str, default: str) -> List[str]:
    """Parse a comma-separated env var into a list of stripped strings."""
    raw = os.getenv(key, default)
    return [s.strip() for s in raw.split(",") if s.strip()]


class Settings:
    def __init__(self):
        # ── Server ────────────────────────────────────────────────────────────
        self.api_host: str   = os.getenv("API_HOST", "0.0.0.0")
        self.api_port: int   = int(os.getenv("API_PORT", "8000"))
        self.api_workers: int = int(os.getenv("API_WORKERS", "1"))
        self.log_level: str  = os.getenv("LOG_LEVEL", "INFO")

        # ── CORS ──────────────────────────────────────────────────────────────
        self.cors_origins: List[str] = _list("CORS_ORIGINS", "http://localhost:5173")

        # ── Storage ───────────────────────────────────────────────────────────
        self.upload_dir: Path      = Path(os.getenv("UPLOAD_DIR",      "uploads"))
        self.output_dir: Path      = Path(os.getenv("OUTPUT_DIR",      "output"))
        self.model_cache_dir: Path = Path(os.getenv("MODEL_CACHE_DIR", "models"))
        self.log_dir: Path         = Path(os.getenv("LOG_DIR",         "logs"))
        self.max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "200"))

        # ── Cleanup ───────────────────────────────────────────────────────────
        self.upload_retention_days: int = int(os.getenv("UPLOAD_RETENTION_DAYS", "7"))
        self.output_retention_days: int = int(os.getenv("OUTPUT_RETENTION_DAYS", "30"))

        # ── ML thresholds ─────────────────────────────────────────────────────
        self.face_confidence_threshold: float  = float(os.getenv("FACE_CONFIDENCE_THRESHOLD", "0.35"))
        self.quality_min_score: float          = float(os.getenv("QUALITY_MIN_SCORE", "0.30"))
        self.quality_blur_threshold: float     = float(os.getenv("QUALITY_BLUR_THRESHOLD", "300"))
        self.face_size_weight_threshold: float = float(os.getenv("FACE_SIZE_WEIGHT_THRESHOLD", "0.05"))

        # ── Redis ─────────────────────────────────────────────────────────────
        self.redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

        # ── Celery ────────────────────────────────────────────────────────────
        self.celery_broker_url: str     = os.getenv("CELERY_BROKER_URL",     "redis://localhost:6379/0")
        self.celery_result_backend: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
        self.celery_worker_concurrency: int         = int(os.getenv("CELERY_WORKER_CONCURRENCY", "1"))
        self.celery_worker_max_tasks_per_child: int = int(os.getenv("CELERY_WORKER_MAX_TASKS_PER_CHILD", "50"))
        self.celery_task_time_limit: int      = int(os.getenv("CELERY_TASK_TIME_LIMIT", "600"))
        self.celery_task_soft_time_limit: int = int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", "540"))

        # ── Flower ────────────────────────────────────────────────────────────
        self.flower_port: int      = int(os.getenv("FLOWER_PORT", "5555"))
        self.flower_enabled: bool  = os.getenv("FLOWER_ENABLED", "true").lower() == "true"
        self.flower_user: str      = os.getenv("FLOWER_USER", "admin")
        self.flower_password: str  = os.getenv("FLOWER_PASSWORD", "admin")

        # ── Monitoring ────────────────────────────────────────────────────────
        self.sentry_dsn: str = os.getenv("SENTRY_DSN", "")

        # ── Groq LLM ──────────────────────────────────────────────────────────
        self.groq_api_key: str      = os.getenv("GROQ_API_KEY", "")
        self.groq_model: str        = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.groq_service_tier: str = os.getenv("GROQ_SERVICE_TIER", "on_demand")
        self.groq_temperature: float = float(os.getenv("GROQ_TEMPERATURE", "0.7"))

        # ── Allowed MIME types ────────────────────────────────────────────────
        self.allowed_image_types: List[str] = [
            "image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff",
        ]
        self.allowed_video_types: List[str] = [
            "video/mp4", "video/quicktime", "video/x-msvideo",
            "video/x-matroska", "video/webm",
        ]

    # ── Derived properties ────────────────────────────────────────────────────
    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    @property
    def allowed_mime_types(self) -> List[str]:
        return self.allowed_image_types + self.allowed_video_types


settings = Settings()

# Ensure required directories exist at import time
for _d in (settings.upload_dir, settings.output_dir, settings.log_dir):
    _d.mkdir(parents=True, exist_ok=True)
