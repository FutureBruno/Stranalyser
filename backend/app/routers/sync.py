from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.sync_state import SyncState
from app.routers.auth import require_athlete_id

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/trigger")
async def trigger_sync(
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    sync_state = await db.get(SyncState, athlete_id)
    if sync_state and sync_state.sync_status == "running":
        return {"status": "already_running", "message": "Sync is already in progress"}

    from app.tasks.sync_tasks import sync_all_activities
    task = sync_all_activities.delay(athlete_id)

    return {"status": "started", "task_id": task.id}


@router.get("/status")
async def sync_status(
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    sync_state = await db.get(SyncState, athlete_id)
    if not sync_state:
        return {"status": "never_synced", "activities_synced": 0}

    return {
        "status": sync_state.sync_status,
        "last_full_sync": sync_state.last_full_sync.isoformat() if sync_state.last_full_sync else None,
        "last_incremental_sync": (
            sync_state.last_incremental_sync.isoformat() if sync_state.last_incremental_sync else None
        ),
        "activities_synced": sync_state.activities_synced,
        "error_message": sync_state.error_message,
    }
