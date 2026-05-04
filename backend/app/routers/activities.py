from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.activity import Activity, ActivityStream
from app.routers.auth import require_athlete_id

router = APIRouter(prefix="/activities", tags=["activities"])

# All Strava sport types that count as "Radfahren"
RIDE_TYPES = {"Ride", "MountainBikeRide", "GravelRide", "EBikeRide", "EMountainBikeRide"}


def _format_activity(a: Activity) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "sport_type": a.sport_type,
        "type": a.type,
        "start_date": a.start_date.isoformat() if a.start_date else None,
        "start_date_local": a.start_date_local.isoformat() if a.start_date_local else None,
        "timezone": a.timezone,
        "distance": a.distance,
        "moving_time": a.moving_time,
        "elapsed_time": a.elapsed_time,
        "total_elevation_gain": a.total_elevation_gain,
        "average_speed": a.average_speed,
        "max_speed": a.max_speed,
        "average_heartrate": a.average_heartrate,
        "max_heartrate": a.max_heartrate,
        "average_watts": a.average_watts,
        "average_cadence": a.average_cadence,
        "suffer_score": a.suffer_score,
        "kudos_count": a.kudos_count,
        "achievement_count": a.achievement_count,
        "polyline": a.polyline,
        "start_latlng": a.start_latlng,
        "end_latlng": a.end_latlng,
        "description": a.description,
        "trainer": a.trainer,
        "commute": a.commute,
        "streams_fetched": a.streams_fetched,
    }


@router.get("")
async def list_activities(
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sport_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    sort_by: str = "start_date",
    order: str = "desc",
) -> dict:
    filters = [Activity.athlete_id == athlete_id]

    if sport_type:
        if sport_type == "Ride":
            filters.append(Activity.sport_type.in_(RIDE_TYPES))
        else:
            filters.append(Activity.sport_type == sport_type)
    if start_date:
        filters.append(Activity.start_date >= datetime.fromisoformat(start_date))
    if end_date:
        filters.append(Activity.start_date <= datetime.fromisoformat(end_date))

    sort_col = getattr(Activity, sort_by, Activity.start_date)
    order_fn = sort_col.desc() if order == "desc" else sort_col.asc()

    count_stmt = select(func.count()).select_from(Activity).where(and_(*filters))
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(Activity)
        .where(and_(*filters))
        .order_by(order_fn)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(stmt)
    activities = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "items": [_format_activity(a) for a in activities],
    }


@router.get("/{activity_id}")
async def get_activity(
    activity_id: int,
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    activity = await db.get(Activity, activity_id)
    if not activity or activity.athlete_id != athlete_id:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Trigger stream fetch if not done yet
    if not activity.streams_fetched:
        from app.tasks.stream_tasks import fetch_streams
        fetch_streams.apply_async(args=[activity_id], queue="streams")

    return _format_activity(activity)


@router.get("/{activity_id}/streams")
async def get_activity_streams(
    activity_id: int,
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    activity = await db.get(Activity, activity_id)
    if not activity or activity.athlete_id != athlete_id:
        raise HTTPException(status_code=404, detail="Activity not found")

    stmt = select(ActivityStream).where(ActivityStream.activity_id == activity_id)
    result = await db.execute(stmt)
    streams = result.scalars().all()

    return {
        stream.stream_type: {
            "data": stream.data,
            "original_size": stream.original_size,
            "resolution": stream.resolution,
        }
        for stream in streams
    }
