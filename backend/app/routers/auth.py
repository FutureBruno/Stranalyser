from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.athlete import Athlete
from app.models.sync_state import SyncState
from app.services.strava_client import exchange_code, get_authorization_url, StravaAPIError

router = APIRouter(prefix="/auth", tags=["auth"])


def get_athlete_id(request: Request) -> int | None:
    return request.session.get("athlete_id")


def require_athlete_id(request: Request) -> int:
    athlete_id = request.session.get("athlete_id")
    if not athlete_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return athlete_id


@router.get("/login")
async def login():
    url = get_authorization_url()
    return RedirectResponse(url=url)


@router.get("/callback")
async def callback(
    request: Request,
    code: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    if error:
        return RedirectResponse(url=f"{settings.frontend_url}/?error=strava_denied")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code parameter")

    try:
        token_data = await exchange_code(code)
    except StravaAPIError as e:
        raise HTTPException(status_code=400, detail=str(e))

    athlete_data = token_data.get("athlete", {})
    athlete_id = athlete_data.get("id")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="No athlete data in token response")

    athlete = await db.get(Athlete, athlete_id)
    if not athlete:
        athlete = Athlete(id=athlete_id)
        db.add(athlete)

    athlete.username = athlete_data.get("username")
    athlete.firstname = athlete_data.get("firstname")
    athlete.lastname = athlete_data.get("lastname")
    athlete.profile_medium = athlete_data.get("profile_medium")
    athlete.city = athlete_data.get("city")
    athlete.country = athlete_data.get("country")
    athlete.sex = athlete_data.get("sex")
    athlete.access_token = token_data["access_token"]
    athlete.refresh_token = token_data["refresh_token"]
    athlete.token_expires_at = datetime.fromtimestamp(token_data["expires_at"], tz=timezone.utc)
    athlete.scope = token_data.get("scope")

    sync_state = await db.get(SyncState, athlete_id)
    if not sync_state:
        sync_state = SyncState(athlete_id=athlete_id)
        db.add(sync_state)

    await db.commit()

    request.session["athlete_id"] = athlete_id

    # Trigger full historical sync in background
    from app.tasks.sync_tasks import sync_all_activities
    sync_all_activities.delay(athlete_id)

    return RedirectResponse(url=settings.frontend_url)


@router.get("/me")
async def me(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    athlete_id = get_athlete_id(request)
    if not athlete_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    athlete = await db.get(Athlete, athlete_id)
    if not athlete:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Athlete not found")

    return {
        "id": athlete.id,
        "username": athlete.username,
        "firstname": athlete.firstname,
        "lastname": athlete.lastname,
        "profile_medium": athlete.profile_medium,
        "city": athlete.city,
        "country": athlete.country,
    }


@router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}
