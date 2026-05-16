import logging
from datetime import datetime, timezone

from sqlalchemy import select, func, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_worker_session
from app.models.activity import Activity
from app.models.athlete import Athlete
from app.models.segment_effort import SegmentEffort
from app.services.strava_client import StravaClient, StravaAPIError

logger = logging.getLogger(__name__)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def fetch_segments_for_activity(activity_id: int) -> int:
    """Fetch segment efforts from Strava detail endpoint and store them."""
    async with get_worker_session() as session:
        activity = await session.get(Activity, activity_id)
        if not activity or activity.segments_fetched:
            return 0

        athlete = await session.get(Athlete, activity.athlete_id)
        if not athlete:
            return 0

        client = StravaClient(athlete)
        try:
            detail = await client.get_activity(activity_id)
        except StravaAPIError as e:
            logger.warning("Could not fetch activity %d: %s", activity_id, e)
            return 0

        efforts = detail.get("segment_efforts") or []
        rows = []
        for e in efforts:
            seg = e.get("segment") or {}
            rows.append({
                "id": e["id"],
                "activity_id": activity_id,
                "athlete_id": activity.athlete_id,
                "segment_id": seg.get("id", 0),
                "segment_name": seg.get("name") or e.get("name"),
                "sport_type": activity.sport_type,
                "elapsed_time": e.get("elapsed_time"),
                "moving_time": e.get("moving_time"),
                "distance": e.get("distance"),
                "start_date": _parse_dt(e.get("start_date")),
                "start_date_local": _parse_dt(e.get("start_date_local")),
                "pr_rank": e.get("pr_rank"),
                "kom_rank": e.get("kom_rank"),
                "average_watts": e.get("average_watts"),
                "average_heartrate": e.get("average_heartrate"),
                "average_cadence": e.get("average_cadence"),
                "achievements": e.get("achievements"),
                "polyline": seg.get("polyline"),
                "start_latlng": seg.get("start_latlng") or None,
                "end_latlng": seg.get("end_latlng") or None,
            })

        if rows:
            stmt = insert(SegmentEffort).values(rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "elapsed_time": stmt.excluded.elapsed_time,
                    "pr_rank": stmt.excluded.pr_rank,
                    "kom_rank": stmt.excluded.kom_rank,
                    "achievements": stmt.excluded.achievements,
                    "polyline": stmt.excluded.polyline,
                    "start_latlng": stmt.excluded.start_latlng,
                    "end_latlng": stmt.excluded.end_latlng,
                },
            )
            await session.execute(stmt)

        activity.segments_fetched = True
        session.add(athlete)
        await session.commit()
        return len(rows)


async def get_fetch_status(athlete_id: int) -> dict:
    async with get_worker_session() as session:
        total = await session.scalar(
            select(func.count(Activity.id)).where(Activity.athlete_id == athlete_id)
        )
        fetched = await session.scalar(
            select(func.count(Activity.id)).where(
                Activity.athlete_id == athlete_id,
                Activity.segments_fetched == True,
            )
        )
        return {"total": total or 0, "fetched": fetched or 0, "pending": (total or 0) - (fetched or 0)}


async def get_segments(athlete_id: int, sport_type: str | None = None) -> list[dict]:
    """Return segments grouped by segment_id, sorted by effort count desc."""
    async with get_worker_session() as session:
        filters = [SegmentEffort.athlete_id == athlete_id]
        if sport_type:
            filters.append(SegmentEffort.sport_type == sport_type)

        agg = (
            select(
                SegmentEffort.segment_id,
                SegmentEffort.segment_name,
                SegmentEffort.sport_type,
                func.count(SegmentEffort.id).label("effort_count"),
                func.min(SegmentEffort.elapsed_time).label("best_elapsed_time"),
                func.avg(SegmentEffort.elapsed_time).label("avg_elapsed_time"),
                SegmentEffort.distance,
            )
            .where(*filters)
            .group_by(
                SegmentEffort.segment_id,
                SegmentEffort.segment_name,
                SegmentEffort.sport_type,
                SegmentEffort.distance,
            )
            .order_by(func.count(SegmentEffort.id).desc())
        )
        segment_rows = (await session.execute(agg)).all()

        if not segment_rows:
            return []

        segment_ids = [r.segment_id for r in segment_rows]

        effort_q = (
            select(SegmentEffort)
            .where(
                SegmentEffort.athlete_id == athlete_id,
                SegmentEffort.segment_id.in_(segment_ids),
            )
            .order_by(SegmentEffort.segment_id, SegmentEffort.elapsed_time)
        )
        efforts = (await session.execute(effort_q)).scalars().all()

        efforts_by_seg: dict[int, list] = {}
        map_data_by_seg: dict[int, dict] = {}
        for eff in efforts:
            efforts_by_seg.setdefault(eff.segment_id, []).append({
                "effort_id": eff.id,
                "activity_id": eff.activity_id,
                "elapsed_time": eff.elapsed_time,
                "start_date_local": eff.start_date_local.isoformat() if eff.start_date_local else None,
                "pr_rank": eff.pr_rank,
                "kom_rank": eff.kom_rank,
                "average_watts": eff.average_watts,
                "average_heartrate": eff.average_heartrate,
            })
            if eff.segment_id not in map_data_by_seg and (eff.polyline or eff.start_latlng):
                map_data_by_seg[eff.segment_id] = {
                    "polyline": eff.polyline,
                    "start_latlng": eff.start_latlng,
                    "end_latlng": eff.end_latlng,
                }

        result = []
        for r in segment_rows:
            map_data = map_data_by_seg.get(r.segment_id, {})
            result.append({
                "segment_id": r.segment_id,
                "segment_name": r.segment_name,
                "sport_type": r.sport_type,
                "effort_count": r.effort_count,
                "best_elapsed_time": r.best_elapsed_time,
                "avg_elapsed_time": round(r.avg_elapsed_time) if r.avg_elapsed_time else None,
                "distance": r.distance,
                "polyline": map_data.get("polyline"),
                "start_latlng": map_data.get("start_latlng"),
                "end_latlng": map_data.get("end_latlng"),
                "efforts": efforts_by_seg.get(r.segment_id, []),
            })
        return result


async def get_sport_types(athlete_id: int) -> list[str]:
    async with get_worker_session() as session:
        rows = await session.execute(
            select(SegmentEffort.sport_type)
            .where(SegmentEffort.athlete_id == athlete_id, SegmentEffort.sport_type.isnot(None))
            .distinct()
            .order_by(SegmentEffort.sport_type)
        )
        return [r[0] for r in rows.all()]
