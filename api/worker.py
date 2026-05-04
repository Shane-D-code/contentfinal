"""
Celery worker — background job processing.

Start with:
    celery -A api.worker worker --loglevel=info

Monitor with Flower (optional):
    celery -A api.worker flower
"""

from celery import Celery
from config import settings

celery_app = Celery(
    "content_engine",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,                  # Re-queue on worker crash
    worker_prefetch_multiplier=1,         # One task at a time (ML is memory-heavy)
    result_expires=86400,                 # Results expire after 24 hours
)

# Auto-discover tasks in api/tasks.py
celery_app.autodiscover_tasks(["api"])
