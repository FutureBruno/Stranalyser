import asyncio
import logging
import time

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.stream_tasks.fetch_streams", bind=True, max_retries=3)
def fetch_streams(self, activity_id: int) -> dict:
    from app.services.sync_service import fetch_streams_for_activity
    from app.services.strava_client import StravaAPIError

    try:
        time.sleep(1)  # stay well within rate limits
        asyncio.run(fetch_streams_for_activity(activity_id))
        return {"status": "ok", "activity_id": activity_id}
    except StravaAPIError as exc:
        if exc.status_code == 429:
            raise self.retry(exc=exc, countdown=900)
        raise self.retry(exc=exc, countdown=30)
    except Exception as exc:
        logger.exception("fetch_streams failed for activity %d", activity_id)
        raise self.retry(exc=exc, countdown=60)
