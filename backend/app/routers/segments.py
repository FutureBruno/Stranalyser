from fastapi import APIRouter, Depends, Query

from app.routers.auth import require_athlete_id
from app.services import segment_service

router = APIRouter(prefix="/segments", tags=["segments"])


@router.get("/status")
async def fetch_status(athlete_id: int = Depends(require_athlete_id)):
    return await segment_service.get_fetch_status(athlete_id)


@router.post("/fetch")
async def trigger_fetch(athlete_id: int = Depends(require_athlete_id)):
    from app.tasks.segment_tasks import fetch_all_segments
    fetch_all_segments.apply_async(args=[athlete_id], queue="default")
    return {"status": "queued"}


@router.get("/sport-types")
async def sport_types(athlete_id: int = Depends(require_athlete_id)):
    types = await segment_service.get_sport_types(athlete_id)
    return {"sport_types": types}


@router.get("")
async def list_segments(
    athlete_id: int = Depends(require_athlete_id),
    sport_type: str | None = Query(default=None),
):
    segments = await segment_service.get_segments(athlete_id, sport_type)
    status = await segment_service.get_fetch_status(athlete_id)
    return {"segments": segments, "fetch_status": status}
