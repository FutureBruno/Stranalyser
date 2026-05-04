from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.activity import Activity
from app.routers.auth import require_athlete_id

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview")
async def overview(
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
    days: int = Query(7, ge=1),
    sport_type: str | None = None,
) -> dict:
    filters = [Activity.athlete_id == athlete_id]
    if days:
        filters.append(Activity.start_date >= text(f"NOW() - INTERVAL '{days} days'"))
    if sport_type:
        filters.append(Activity.sport_type == sport_type)

    stmt = (
        select(
            Activity.sport_type,
            func.count(Activity.id).label("count"),
            func.sum(Activity.distance).label("total_distance"),
            func.sum(Activity.moving_time).label("total_moving_time"),
            func.sum(Activity.total_elevation_gain).label("total_elevation"),
        )
        .where(and_(*filters))
        .group_by(Activity.sport_type)
    )
    result = await db.execute(stmt)
    rows = result.fetchall()

    by_sport = [
        {
            "sport_type": row.sport_type,
            "count": row.count,
            "total_distance": row.total_distance or 0,
            "total_moving_time": row.total_moving_time or 0,
            "total_elevation": row.total_elevation or 0,
        }
        for row in rows
    ]

    total_stmt = select(
        func.count(Activity.id),
        func.sum(Activity.distance),
        func.sum(Activity.moving_time),
        func.sum(Activity.total_elevation_gain),
    ).where(and_(*filters))
    total_row = (await db.execute(total_stmt)).fetchone()

    return {
        "total_activities": total_row[0] or 0,
        "total_distance": total_row[1] or 0,
        "total_moving_time": total_row[2] or 0,
        "total_elevation": total_row[3] or 0,
        "by_sport": by_sport,
    }


@router.get("/weekly")
async def weekly(
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
    days: int = Query(7, ge=1, le=365),
    sport_type: str | None = None,
) -> list[dict]:
    filters = [
        Activity.athlete_id == athlete_id,
        Activity.start_date >= text(f"NOW() - INTERVAL '{days} days'"),
    ]
    if sport_type:
        filters.append(Activity.sport_type == sport_type)

    # For short ranges use day buckets, for longer ranges use week buckets
    bucket = "day" if days <= 31 else "week"

    stmt = (
        select(
            func.date_trunc(bucket, Activity.start_date_local).label("bucket"),
            func.count(Activity.id).label("count"),
            func.sum(Activity.distance).label("distance"),
            func.sum(Activity.total_elevation_gain).label("elevation"),
            func.sum(Activity.moving_time).label("moving_time"),
        )
        .where(and_(*filters))
        .group_by(text("bucket"))
        .order_by(text("bucket"))
    )
    result = await db.execute(stmt)
    rows = result.fetchall()

    return [
        {
            "bucket": row.bucket.isoformat() if row.bucket else None,
            "count": row.count,
            "distance": row.distance or 0,
            "elevation": row.elevation or 0,
            "moving_time": row.moving_time or 0,
        }
        for row in rows
    ]
