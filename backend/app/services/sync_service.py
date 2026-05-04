import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.database import get_worker_session
from app.models.activity import Activity, ActivityStream
from app.models.athlete import Athlete
from app.models.sync_state import SyncState
from app.services.strava_client import StravaClient, StravaAPIError

logger = logging.getLogger(__name__)


def _map_activity(data: dict, athlete_id: int) -> dict:
    map_data = data.get("map") or {}
    start = data.get("start_latlng") or []
    end = data.get("end_latlng") or []
    return {
        "id": data["id"],
        "athlete_id": athlete_id,
        "name": data.get("name"),
        "sport_type": data.get("sport_type"),
        "type": data.get("type"),
        "start_date": data.get("start_date"),
        "start_date_local": data.get("start_date_local"),
        "timezone": data.get("timezone"),
        "distance": data.get("distance"),
        "moving_time": data.get("moving_time"),
        "elapsed_time": data.get("elapsed_time"),
        "total_elevation_gain": data.get("total_elevation_gain"),
        "average_speed": data.get("average_speed"),
        "max_speed": data.get("max_speed"),
        "average_heartrate": data.get("average_heartrate"),
        "max_heartrate": data.get("max_heartrate"),
        "average_watts": data.get("average_watts"),
        "average_cadence": data.get("average_cadence"),
        "suffer_score": data.get("suffer_score"),
        "kudos_count": data.get("kudos_count"),
        "achievement_count": data.get("achievement_count"),
        "map_id": map_data.get("id"),
        "polyline": map_data.get("summary_polyline"),
        "start_latlng": start if len(start) == 2 else None,
        "end_latlng": end if len(end) == 2 else None,
        "workout_type": data.get("workout_type"),
        "description": data.get("description"),
        "gear_id": data.get("gear_id"),
        "trainer": data.get("trainer"),
        "commute": data.get("commute"),
        "manual": data.get("manual"),
        "private": data.get("private"),
        "flagged": data.get("flagged"),
        "raw": data,
        "streams_fetched": False,
    }


async def upsert_activities(session, rows: list[dict]) -> int:
    if not rows:
        return 0
    stmt = insert(Activity).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["id"],
        set_={
            "name": stmt.excluded.name,
            "kudos_count": stmt.excluded.kudos_count,
            "achievement_count": stmt.excluded.achievement_count,
            "suffer_score": stmt.excluded.suffer_score,
            "description": stmt.excluded.description,
            "raw": stmt.excluded.raw,
            "updated_at": datetime.now(tz=timezone.utc),
        },
    )
    await session.execute(stmt)
    return len(rows)


async def sync_all_activities(athlete_id: int) -> int:
    """Fetch all historical activities from Strava and store in DB."""
    async with get_worker_session() as session:
        athlete = await session.get(Athlete, athlete_id)
        if not athlete:
            logger.error("Athlete %s not found", athlete_id)
            return 0

        sync_state = await session.get(SyncState, athlete_id)
        if not sync_state:
            sync_state = SyncState(athlete_id=athlete_id, sync_status="running")
            session.add(sync_state)
        else:
            sync_state.sync_status = "running"
            sync_state.error_message = None
        await session.commit()

    client = StravaClient(athlete)
    total = 0
    page = 1

    try:
        while True:
            logger.info("Fetching activities page %d for athlete %d", page, athlete_id)
            try:
                activities_data = await client.list_activities(page=page, per_page=200)
            except StravaAPIError as e:
                if e.status_code == 429:
                    logger.warning("Rate limited, sleeping 15 minutes")
                    await asyncio.sleep(900)
                    continue
                raise

            if not activities_data:
                break

            rows = [_map_activity(a, athlete_id) for a in activities_data]

            async with get_worker_session() as write_session:
                count = await upsert_activities(write_session, rows)
                db_athlete = await write_session.get(Athlete, athlete_id)
                if db_athlete:
                    db_athlete.access_token = athlete.access_token
                    db_athlete.refresh_token = athlete.refresh_token
                    db_athlete.token_expires_at = athlete.token_expires_at
                await write_session.commit()

            total += count
            page += 1

            if len(activities_data) < 200:
                break

            await asyncio.sleep(1)

        async with get_worker_session() as final_session:
            state = await final_session.get(SyncState, athlete_id)
            if state:
                state.sync_status = "idle"
                state.last_full_sync = datetime.now(tz=timezone.utc)
                state.last_incremental_sync = datetime.now(tz=timezone.utc)
                state.activities_synced = total
            await final_session.commit()

        logger.info("Full sync complete: %d activities for athlete %d", total, athlete_id)
        return total

    except Exception as exc:
        logger.exception("Sync failed for athlete %d", athlete_id)
        async with get_worker_session() as err_session:
            state = await err_session.get(SyncState, athlete_id)
            if state:
                state.sync_status = "error"
                state.error_message = str(exc)
            await err_session.commit()
        raise


async def sync_incremental(athlete_id: int) -> int:
    """Fetch only new activities since last sync."""
    async with get_worker_session() as session:
        athlete = await session.get(Athlete, athlete_id)
        sync_state = await session.get(SyncState, athlete_id)

        if not athlete:
            return 0

        after_ts = None
        if sync_state and sync_state.last_incremental_sync:
            after_ts = int(sync_state.last_incremental_sync.timestamp())

    client = StravaClient(athlete)
    activities_data = await client.list_activities(after=after_ts, per_page=200)

    if not activities_data:
        return 0

    rows = [_map_activity(a, athlete_id) for a in activities_data]

    async with get_worker_session() as session:
        count = await upsert_activities(session, rows)

        state = await session.get(SyncState, athlete_id)
        if state:
            state.last_incremental_sync = datetime.now(tz=timezone.utc)
            state.activities_synced = (state.activities_synced or 0) + count

        db_athlete = await session.get(Athlete, athlete_id)
        if db_athlete:
            db_athlete.access_token = athlete.access_token
            db_athlete.refresh_token = athlete.refresh_token
            db_athlete.token_expires_at = athlete.token_expires_at

        await session.commit()

    logger.info("Incremental sync: %d new activities for athlete %d", count, athlete_id)
    return count


async def fetch_streams_for_activity(activity_id: int) -> None:
    """Fetch GPS/HR/altitude streams for one activity."""
    async with get_worker_session() as session:
        activity = await session.get(Activity, activity_id)
        if not activity or activity.streams_fetched:
            return

        athlete = await session.get(Athlete, activity.athlete_id)
        if not athlete:
            return

    client = StravaClient(athlete)
    try:
        streams_data = await client.get_streams(activity_id)
    except StravaAPIError as e:
        logger.warning("Could not fetch streams for activity %d: %s", activity_id, e)
        return

    async with get_worker_session() as session:
        rows = [
            ActivityStream(
                activity_id=activity_id,
                stream_type=stream_type,
                data=stream_info.get("data", []),
                original_size=stream_info.get("original_size"),
                resolution=stream_info.get("resolution"),
                series_type=stream_info.get("series_type"),
            )
            for stream_type, stream_info in streams_data.items()
        ]
        session.add_all(rows)

        act = await session.get(Activity, activity_id)
        if act:
            act.streams_fetched = True

        db_athlete = await session.get(Athlete, activity_id)
        if db_athlete:
            db_athlete.access_token = athlete.access_token
            db_athlete.refresh_token = athlete.refresh_token
            db_athlete.token_expires_at = athlete.token_expires_at

        await session.commit()

    logger.info("Streams fetched for activity %d", activity_id)
