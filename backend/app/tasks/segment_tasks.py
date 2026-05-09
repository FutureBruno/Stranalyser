import asyncio
import logging
import time

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.segment_tasks.fetch_segments", bind=True, max_retries=3)
def fetch_segments(self, activity_id: int) -> dict:
    from app.services.segment_service import fetch_segments_for_activity
    from app.services.strava_client import StravaAPIError

    try:
        time.sleep(1)  # stay within Strava rate limits
        count = asyncio.run(fetch_segments_for_activity(activity_id))
        return {"status": "ok", "activity_id": activity_id, "efforts": count}
    except StravaAPIError as exc:
        if exc.status_code == 429:
            raise self.retry(exc=exc, countdown=900)
        raise self.retry(exc=exc, countdown=30)
    except Exception as exc:
        logger.exception("fetch_segments failed for activity %d", activity_id)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.segment_tasks.fetch_all_segments")
def fetch_all_segments(athlete_id: int) -> dict:
    """Queue segment fetch for all unfetched activities of an athlete."""
    import asyncio
    from sqlalchemy import select
    from app.models.activity import Activity
    from app.database import get_worker_session

    async def _get_unfetched():
        async with get_worker_session() as session:
            result = await session.execute(
                select(Activity.id).where(
                    Activity.athlete_id == athlete_id,
                    Activity.segments_fetched == False,
                ).order_by(Activity.start_date.desc())
            )
            return [r[0] for r in result.all()]

    ids = asyncio.run(_get_unfetched())
    for activity_id in ids:
        fetch_segments.apply_async(args=[activity_id], queue="segments")

    return {"queued": len(ids)}
