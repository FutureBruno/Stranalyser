from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "stranalyser",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.sync_tasks", "app.tasks.stream_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.tasks.stream_tasks.*": {"queue": "streams"},
        "app.tasks.sync_tasks.*": {"queue": "default"},
    },
    beat_schedule={
        "incremental-sync-all-athletes": {
            "task": "app.tasks.sync_tasks.incremental_sync_all",
            "schedule": crontab(minute="*/30"),
        },
    },
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)
