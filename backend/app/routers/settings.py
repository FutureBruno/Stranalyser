from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user_settings import UserSettings
from app.routers.auth import require_athlete_id
from app.services import ai_service

router = APIRouter(prefix="/settings", tags=["settings"])

_MASK = "••••••••"


class SettingsIn(BaseModel):
    anthropic_api_key: str | None = None
    google_api_key: str | None = None
    preferred_provider: str | None = None
    preferred_model: str | None = None


def _mask(key: str | None) -> str | None:
    if not key:
        return None
    return _MASK


def _is_placeholder(value: str | None) -> bool:
    return value is None or value == _MASK


@router.get("")
async def get_settings(
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await db.get(UserSettings, athlete_id)
    anthropic_key = (row.anthropic_api_key if row else None) or settings.anthropic_api_key or None
    google_key = (row.google_api_key if row else None) or settings.google_api_key or None
    providers_info = ai_service.get_providers_info(
        user_anthropic_key=anthropic_key,
        user_google_key=google_key,
    )
    return {
        "anthropic_api_key": _mask(row.anthropic_api_key) if row else None,
        "google_api_key": _mask(row.google_api_key) if row else None,
        "preferred_provider": row.preferred_provider if row else None,
        "preferred_model": row.preferred_model if row else None,
        "has_anthropic_key": bool(row and row.anthropic_api_key),
        "has_google_key": bool(row and row.google_api_key),
        "available_providers": providers_info["providers"],
    }


@router.put("")
async def update_settings(
    body: SettingsIn,
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await db.get(UserSettings, athlete_id)
    if row is None:
        row = UserSettings(athlete_id=athlete_id)
        db.add(row)

    if not _is_placeholder(body.anthropic_api_key):
        # Empty string means "delete key"
        row.anthropic_api_key = body.anthropic_api_key or None

    if not _is_placeholder(body.google_api_key):
        row.google_api_key = body.google_api_key or None

    if body.preferred_provider is not None:
        row.preferred_provider = body.preferred_provider or None

    if body.preferred_model is not None:
        row.preferred_model = body.preferred_model or None

    await db.commit()
    await db.refresh(row)

    return {
        "anthropic_api_key": _mask(row.anthropic_api_key),
        "google_api_key": _mask(row.google_api_key),
        "preferred_provider": row.preferred_provider,
        "preferred_model": row.preferred_model,
        "has_anthropic_key": bool(row.anthropic_api_key),
        "has_google_key": bool(row.google_api_key),
    }
