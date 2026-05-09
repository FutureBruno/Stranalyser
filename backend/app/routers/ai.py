from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.ai_analysis import AIAnalysis
from app.models.athlete import Athlete
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


def _check_provider(provider: str | None) -> None:
    effective = provider or settings.ai_provider
    if effective == "google" and not settings.google_api_key:
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY ist nicht konfiguriert.")
    if effective == "anthropic" and not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY ist nicht konfiguriert.")
    if effective not in ("anthropic", "google"):
        raise HTTPException(status_code=400, detail=f"Unbekannter Provider: '{effective}'. Erlaubt: anthropic, google")


@router.get("/providers")
async def get_providers() -> dict:
    """Return available AI providers, models and configuration status."""
    return ai_service.get_providers_info()


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
    _check_provider(provider)
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
            model=model,
            provider=provider,
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
    _check_provider(provider)
    athlete_name = await _get_athlete_name(db, athlete_id)

    try:
        analysis = await ai_service.analyze_activity(
            db=db,
            athlete_id=athlete_id,
            athlete_name=athlete_name,
            activity_id=activity_id,
            force_refresh=force_refresh,
            model=model,
            provider=provider,
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
