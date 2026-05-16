from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.ai_analysis import AIAnalysis
from app.models.athlete import Athlete
from app.models.user_settings import UserSettings
from app.routers.auth import require_athlete_id
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


def _format_analysis(a: AIAnalysis) -> dict:
    return {
        "id": a.id,
        "analysis_type": a.analysis_type,
        "activity_id": a.activity_id,
        "week_key": a.week_key,
        "content": a.content,
        "model": a.model,
        "input_tokens": a.input_tokens,
        "output_tokens": a.output_tokens,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


async def _get_athlete_name(db: AsyncSession, athlete_id: int) -> str:
    athlete = await db.get(Athlete, athlete_id)
    if not athlete:
        return "Athlet"
    parts = []
    if athlete.firstname:
        parts.append(athlete.firstname)
    if athlete.lastname:
        parts.append(athlete.lastname)
    return " ".join(parts) if parts else (athlete.username or "Athlet")


async def _get_user_keys(db: AsyncSession, athlete_id: int) -> tuple[str | None, str | None]:
    """Return (anthropic_key, google_key) from user settings, falling back to env."""
    row = await db.get(UserSettings, athlete_id)
    anthropic_key = (row.anthropic_api_key if row else None) or settings.anthropic_api_key or None
    google_key = (row.google_api_key if row else None) or settings.google_api_key or None
    return anthropic_key, google_key


async def _get_user_preferred(db: AsyncSession, athlete_id: int) -> tuple[str | None, str | None]:
    """Return (preferred_provider, preferred_model) from user settings."""
    row = await db.get(UserSettings, athlete_id)
    if not row:
        return None, None
    return row.preferred_provider, row.preferred_model


def _check_provider(provider: str, anthropic_key: str | None, google_key: str | None) -> None:
    if provider == "google" and not google_key:
        raise HTTPException(status_code=503, detail="Google API-Key ist nicht konfiguriert.")
    if provider == "anthropic" and not anthropic_key:
        raise HTTPException(status_code=503, detail="Anthropic API-Key ist nicht konfiguriert.")
    if provider not in ("anthropic", "google"):
        raise HTTPException(status_code=400, detail=f"Unbekannter Provider: '{provider}'. Erlaubt: anthropic, google")


@router.get("/providers")
async def get_providers(
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return available AI providers, models and configuration status."""
    anthropic_key, google_key = await _get_user_keys(db, athlete_id)
    pref_provider, pref_model = await _get_user_preferred(db, athlete_id)
    info = ai_service.get_providers_info()
    info["providers"]["anthropic"]["configured"] = bool(anthropic_key)
    info["providers"]["google"]["configured"] = bool(google_key)
    if pref_provider:
        info["current_provider"] = pref_provider
    if pref_model:
        info["current_model"] = pref_model
    return info


@router.post("/weekly-report")
async def create_weekly_report(
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
    week_offset: int = Query(0, description="0 = aktuelle Woche, -1 = letzte Woche"),
    force_refresh: bool = Query(False, description="Existierende Analyse überschreiben"),
    model: str | None = Query(None, description="Modell überschreiben, z.B. gemini-2.0-flash"),
    provider: str | None = Query(None, description="Provider überschreiben: anthropic oder google"),
) -> dict:
    """Generate (or return cached) weekly AI report."""
    anthropic_key, google_key = await _get_user_keys(db, athlete_id)
    pref_provider, pref_model = await _get_user_preferred(db, athlete_id)
    effective_provider = provider or pref_provider or settings.ai_provider
    effective_model = model or pref_model or settings.ai_model
    _check_provider(effective_provider, anthropic_key, google_key)
    athlete_name = await _get_athlete_name(db, athlete_id)

    if force_refresh:
        now = datetime.now(timezone.utc)
        days_since_monday = now.weekday()
        week_start = (now - timedelta(days=days_since_monday + week_offset * 7)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        week_key = week_start.strftime("%Y-W%W")
        existing = await db.execute(
            select(AIAnalysis).where(
                and_(
                    AIAnalysis.athlete_id == athlete_id,
                    AIAnalysis.analysis_type == "weekly_report",
                    AIAnalysis.week_key == week_key,
                )
            )
        )
        for row in existing.scalars().all():
            await db.delete(row)
        await db.commit()

    try:
        analysis = await ai_service.generate_weekly_report(
            db=db,
            athlete_id=athlete_id,
            athlete_name=athlete_name,
            week_offset=week_offset,
            model=effective_model,
            provider=effective_provider,
            user_anthropic_key=anthropic_key,
            user_google_key=google_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI-Analyse fehlgeschlagen: {e}")

    return _format_analysis(analysis)


@router.post("/activities/{activity_id}/analyze")
async def analyze_activity(
    activity_id: int,
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
    force_refresh: bool = Query(False, description="Existierende Analyse überschreiben"),
    model: str | None = Query(None, description="Modell überschreiben, z.B. claude-opus-4-7"),
    provider: str | None = Query(None, description="Provider überschreiben: anthropic oder google"),
) -> dict:
    """Generate (or return cached) AI analysis for a single activity."""
    anthropic_key, google_key = await _get_user_keys(db, athlete_id)
    pref_provider, pref_model = await _get_user_preferred(db, athlete_id)
    effective_provider = provider or pref_provider or settings.ai_provider
    effective_model = model or pref_model or settings.ai_model
    _check_provider(effective_provider, anthropic_key, google_key)
    athlete_name = await _get_athlete_name(db, athlete_id)

    try:
        analysis = await ai_service.analyze_activity(
            db=db,
            athlete_id=athlete_id,
            athlete_name=athlete_name,
            activity_id=activity_id,
            force_refresh=force_refresh,
            model=effective_model,
            provider=effective_provider,
            user_anthropic_key=anthropic_key,
            user_google_key=google_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI-Analyse fehlgeschlagen: {e}")

    return _format_analysis(analysis)


@router.get("/activities/{activity_id}/analysis")
async def get_activity_analysis(
    activity_id: int,
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
) -> dict | None:
    """Get the latest stored AI analysis for an activity."""
    result = await db.execute(
        select(AIAnalysis).where(
            and_(
                AIAnalysis.athlete_id == athlete_id,
                AIAnalysis.analysis_type == "activity_analysis",
                AIAnalysis.activity_id == activity_id,
            )
        ).order_by(desc(AIAnalysis.created_at)).limit(1)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        return None
    return _format_analysis(analysis)


@router.get("/weekly-report")
async def get_weekly_report(
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
    week_key: str | None = Query(None, description="z.B. '2026-W18', Standard: aktuelle Woche"),
) -> dict | None:
    """Get the stored weekly report for a given week."""
    if not week_key:
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        days_since_monday = now.weekday()
        week_start = (now - timedelta(days=days_since_monday)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        week_key = week_start.strftime("%Y-W%W")

    result = await db.execute(
        select(AIAnalysis).where(
            and_(
                AIAnalysis.athlete_id == athlete_id,
                AIAnalysis.analysis_type == "weekly_report",
                AIAnalysis.week_key == week_key,
            )
        ).order_by(desc(AIAnalysis.created_at)).limit(1)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        return None
    return _format_analysis(analysis)


@router.get("/analyses")
async def list_analyses(
    athlete_id: int = Depends(require_athlete_id),
    db: AsyncSession = Depends(get_db),
    analysis_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> dict:
    """List all stored AI analyses for the athlete."""
    from sqlalchemy import func

    filters = [AIAnalysis.athlete_id == athlete_id]
    if analysis_type:
        filters.append(AIAnalysis.analysis_type == analysis_type)

    count_result = await db.execute(
        select(func.count()).select_from(AIAnalysis).where(and_(*filters))
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(AIAnalysis)
        .where(and_(*filters))
        .order_by(desc(AIAnalysis.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    analyses = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "items": [_format_analysis(a) for a in analyses],
    }
