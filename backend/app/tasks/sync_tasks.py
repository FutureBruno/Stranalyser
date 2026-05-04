import asyncio
import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.sync_tasks.sync_all_activities", bind=True, max_retries=3)
def sync_all_activities(self, athlete_id: int) -> dict:
    from app.services.sync_service import sync_all_activities as _sync

    try:
        count = asyncio.run(_sync(athlete_id))
        return {"status": "ok", "activities_synced": count}
    except Exception as exc:
        logger.exception("sync_all_activities failed for athlete %d", athlete_id)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.sync_tasks.incremental_sync_all")
def incremental_sync_all() -> dict:
    """Called by Celery Beat every 30 minutes for all athletes."""
    from app.services.sync_service import sync_incremental as _sync
    from app.database import AsyncSessionLocal
    from app.models.athlete import Athlete
    import asyncio
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Athlete.id))
            athlete_ids = [row[0] for row in result.fetchall()]

        counts = {}
        for athlete_id in athlete_ids:
            try:
                count = await _sync(athlete_id)
                counts[athlete_id] = count
            except Exception:
                logger.exception("Incremental sync failed for athlete %d", athlete_id)
                counts[athlete_id] = -1
        return counts

    return asyncio.run(_run())
