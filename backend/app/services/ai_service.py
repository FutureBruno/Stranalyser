"""AI analysis service using Claude API."""
import json
from datetime import datetime, timedelta, timezone
from typing import Any

import anthropic
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.activity import Activity
from app.models.ai_analysis import AIAnalysis


RIDE_TYPES = {"Ride", "MountainBikeRide", "GravelRide", "EBikeRide", "EMountainBikeRide"}


def _sport_label(sport_type: str | None) -> str:
    if not sport_type:
        return "Unbekannt"
    labels = {
        "Run": "Laufen", "TrailRun": "Trail Run", "Walk": "Gehen", "Hike": "Wandern",
        "Swim": "Schwimmen", "VirtualRide": "Virtual Ride", "VirtualRun": "Virtual Run",
        "Ride": "Radfahren", "MountainBikeRide": "Mountainbike", "GravelRide": "Gravel Ride",
        "EBikeRide": "E-Bike", "EMountainBikeRide": "E-Mountainbike",
        "Yoga": "Yoga", "WeightTraining": "Krafttraining", "Workout": "Workout",
        "Rowing": "Rudern", "Kayaking": "Kajak", "Skiing": "Skifahren",
        "NordicSki": "Skilanglauf", "IceSkate": "Schlittschuhlaufen",
    }
    return labels.get(sport_type, sport_type)


def _fmt_distance(m: float | None) -> str:
    if not m:
        return "–"
    return f"{m / 1000:.2f} km"


def _fmt_time(seconds: int | None) -> str:
    if not seconds:
        return "–"
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d} h"
    return f"{m}:{s:02d} min"


def _fmt_speed(speed: float | None, sport_type: str | None) -> str:
    if not speed or speed == 0:
        return "–"
    if sport_type in RIDE_TYPES or sport_type == "VirtualRide":
        return f"{speed * 3.6:.1f} km/h"
    secs_per_km = 1000 / speed
    m = int(secs_per_km // 60)
    s = int(secs_per_km % 60)
    return f"{m}:{s:02d} /km"


def _fmt_hr(hr: float | None) -> str:
    return f"{hr:.0f} bpm" if hr else "–"


def _fmt_watts(w: float | None) -> str:
    return f"{w:.0f} W" if w else "–"


def _fmt_cadence(c: float | None, sport_type: str | None) -> str:
    if not c:
        return "–"
    if sport_type in RIDE_TYPES or sport_type == "VirtualRide":
        return f"{c:.0f} rpm"
    return f"{c:.0f} spm"


def _activity_to_dict(a: Activity) -> dict[str, str]:
    return {
        "name": a.name or "Aktivität",
        "sport": _sport_label(a.sport_type),
        "datum": a.start_date_local.strftime("%d.%m.%Y %H:%M") if a.start_date_local else "–",
        "distanz": _fmt_distance(a.distance),
        "dauer": _fmt_time(a.moving_time),
        "tempo": _fmt_speed(a.average_speed, a.sport_type),
        "herzfrequenz_avg": _fmt_hr(a.average_heartrate),
        "herzfrequenz_max": _fmt_hr(a.max_heartrate),
        "leistung_avg": _fmt_watts(a.average_watts),
        "kadenz_avg": _fmt_cadence(a.average_cadence, a.sport_type),
        "hm_aufstieg": f"{a.total_elevation_gain:.0f} m" if a.total_elevation_gain else "–",
        "suffer_score": str(a.suffer_score) if a.suffer_score else "–",
    }


def _get_client() -> anthropic.Anthropic:
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY ist nicht konfiguriert.")
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


async def _save_analysis(
    db: AsyncSession,
    athlete_id: int,
    analysis_type: str,
    content: dict[str, Any],
    usage: Any,
    model: str,
    activity_id: int | None = None,
    week_key: str | None = None,
) -> AIAnalysis:
    analysis = AIAnalysis(
        athlete_id=athlete_id,
        analysis_type=analysis_type,
        activity_id=activity_id,
        week_key=week_key,
        content=content,
        input_tokens=usage.input_tokens if usage else None,
        output_tokens=usage.output_tokens if usage else None,
        model=model,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis


async def generate_weekly_report(
    db: AsyncSession,
    athlete_id: int,
    athlete_name: str,
    week_offset: int = 0,
) -> AIAnalysis:
    """Generate AI weekly report. week_offset=0 is current week, -1 is last week."""
    now = datetime.now(timezone.utc)
    # Monday of target week
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday + week_offset * 7)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    week_end = week_start + timedelta(days=7)
    week_key = week_start.strftime("%Y-W%W")

    # Check if we already have a report for this week
    existing = await db.execute(
        select(AIAnalysis).where(
            and_(
                AIAnalysis.athlete_id == athlete_id,
                AIAnalysis.analysis_type == "weekly_report",
                AIAnalysis.week_key == week_key,
            )
        ).order_by(desc(AIAnalysis.created_at)).limit(1)
    )
    existing_analysis = existing.scalar_one_or_none()
    if existing_analysis:
        return existing_analysis

    # Fetch this week's activities
    stmt = (
        select(Activity)
        .where(
            and_(
                Activity.athlete_id == athlete_id,
                Activity.start_date >= week_start,
                Activity.start_date < week_end,
            )
        )
        .order_by(Activity.start_date)
    )
    result = await db.execute(stmt)
    week_activities = result.scalars().all()

    # Fetch previous 4 weeks for comparison
    prev_start = week_start - timedelta(weeks=4)
    prev_stmt = (
        select(Activity)
        .where(
            and_(
                Activity.athlete_id == athlete_id,
                Activity.start_date >= prev_start,
                Activity.start_date < week_start,
            )
        )
        .order_by(Activity.start_date)
    )
    prev_result = await db.execute(prev_stmt)
    prev_activities = prev_result.scalars().all()

    # Build prompt context
    week_data = [_activity_to_dict(a) for a in week_activities]
    prev_data = [_activity_to_dict(a) for a in prev_activities]

    prompt = f"""Du bist ein erfahrener Trainingscoach und analysierst die Trainingsdaten von {athlete_name}.

## Diese Woche ({week_start.strftime('%d.%m.%Y')} – {(week_end - timedelta(days=1)).strftime('%d.%m.%Y')})

Anzahl Aktivitäten: {len(week_activities)}

{json.dumps(week_data, ensure_ascii=False, indent=2) if week_data else "Keine Aktivitäten in dieser Woche."}

## Vorherige 4 Wochen (Vergleichszeitraum)

Anzahl Aktivitäten: {len(prev_activities)}

{json.dumps(prev_data, ensure_ascii=False, indent=2) if prev_data else "Keine Vergleichsdaten vorhanden."}

---

Erstelle einen detaillierten Wochenbericht auf Deutsch. Antworte ausschließlich mit einem validen JSON-Objekt in diesem Format:

{{
  "woche": "{week_start.strftime('%d.%m.')} – {(week_end - timedelta(days=1)).strftime('%d.%m.%Y')}",
  "zusammenfassung": "2-3 Sätze Gesamtzusammenfassung der Trainingswoche",
  "highlights": ["Highlight 1", "Highlight 2", "..."],
  "sportarten_uebersicht": [
    {{"sport": "...", "anzahl": 0, "gesamt_distanz": "...", "gesamt_dauer": "..."}}
  ],
  "verbesserungen": ["Was hat sich im Vergleich zur Vorperiode verbessert?", "..."],
  "worauf_achten": ["Hinweis 1 was beobachtet oder verbessert werden sollte", "..."],
  "empfehlungen": ["Konkrete Trainingsempfehlung 1", "..."],
  "erholung_und_belastung": "Kurze Einschätzung zu Belastung und Erholung",
  "naechste_woche": "1-2 Sätze Ausblick und Ziele für die nächste Woche"
}}

Wichtig:
- Sei konkret und beziehe dich auf die tatsächlichen Daten
- Wenn wenig oder keine Daten vorhanden sind, gib trotzdem hilfreiche Empfehlungen
- Schreibe natürlich und motivierend, nicht zu technisch
"""

    client = _get_client()
    message = client.messages.create(
        model=settings.ai_model,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw_text = message.content[0].text.strip()
    # Extract JSON if wrapped in code block
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        raw_text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        parsed = {"raw": raw_text, "fehler": "Antwort konnte nicht als JSON geparst werden."}

    return await _save_analysis(
        db=db,
        athlete_id=athlete_id,
        analysis_type="weekly_report",
        content=parsed,
        usage=message.usage,
        model=message.model,
        week_key=week_key,
    )


async def analyze_activity(
    db: AsyncSession,
    athlete_id: int,
    athlete_name: str,
    activity_id: int,
    force_refresh: bool = False,
) -> AIAnalysis:
    """Analyze a single activity and compare with recent same-type activities."""
    # Load the activity
    activity = await db.get(Activity, activity_id)
    if not activity or activity.athlete_id != athlete_id:
        raise ValueError("Aktivität nicht gefunden.")

    # Check for existing analysis (unless forced)
    if not force_refresh:
        existing = await db.execute(
            select(AIAnalysis).where(
                and_(
                    AIAnalysis.athlete_id == athlete_id,
                    AIAnalysis.analysis_type == "activity_analysis",
                    AIAnalysis.activity_id == activity_id,
                )
            ).order_by(desc(AIAnalysis.created_at)).limit(1)
        )
        existing_analysis = existing.scalar_one_or_none()
        if existing_analysis:
            return existing_analysis

    # Fetch the last 10 activities of the same sport type before this one
    sport_types = list(RIDE_TYPES) if activity.sport_type in RIDE_TYPES else [activity.sport_type]
    prev_stmt = (
        select(Activity)
        .where(
            and_(
                Activity.athlete_id == athlete_id,
                Activity.sport_type.in_(sport_types),
                Activity.start_date < activity.start_date,
                Activity.id != activity_id,
            )
        )
        .order_by(desc(Activity.start_date))
        .limit(10)
    )
    prev_result = await db.execute(prev_stmt)
    prev_activities = list(reversed(prev_result.scalars().all()))

    current_data = _activity_to_dict(activity)
    prev_data = [_activity_to_dict(a) for a in prev_activities]

    sport_label = _sport_label(activity.sport_type)

    prompt = f"""Du bist ein erfahrener Trainingscoach und analysierst eine Aktivität von {athlete_name}.

## Aktuelle Aktivität

{json.dumps(current_data, ensure_ascii=False, indent=2)}

## Letzte {len(prev_activities)} {sport_label}-Aktivitäten (chronologisch, älteste zuerst)

{json.dumps(prev_data, ensure_ascii=False, indent=2) if prev_data else "Keine Vergleichsaktivitäten vorhanden (erste Aktivität dieses Typs)."}

---

Erstelle eine detaillierte Aktivitätsanalyse auf Deutsch. Antworte ausschließlich mit einem validen JSON-Objekt:

{{
  "bewertung": "Gesamtbewertung der Aktivität in 1-2 Sätzen",
  "leistungsvergleich": {{
    "tempo_trend": "besser/schlechter/gleich – kurze Erklärung",
    "herzfrequenz_trend": "besser/schlechter/gleich – kurze Erklärung",
    "ausdauer_trend": "besser/schlechter/gleich – kurze Erklärung",
    "zusammenfassung": "Gesamteinschätzung der Leistungsentwicklung"
  }},
  "staerken": ["Stärke 1 dieser Aktivität", "..."],
  "verbesserungspotential": ["Bereich 1 mit Potenzial", "..."],
  "besonderheiten": "Besondere Aspekte oder Auffälligkeiten dieser Aktivität (oder null)",
  "trainingsempfehlungen": ["Konkrete Empfehlung 1 für das nächste Training", "..."],
  "erholung": "Empfehlung zur Erholung nach dieser Aktivität"
}}

Wichtig:
- Vergleiche konkret mit den Vorläuferaktivitäten und nenne Zahlen wenn möglich
- Wenn keine Vergleichsdaten vorhanden sind, analysiere die absolute Leistung
- Sei motivierend aber ehrlich
- Schreibe auf Deutsch
"""

    client = _get_client()
    message = client.messages.create(
        model=settings.ai_model,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    raw_text = message.content[0].text.strip()
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        raw_text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        parsed = {"raw": raw_text, "fehler": "Antwort konnte nicht als JSON geparst werden."}

    return await _save_analysis(
        db=db,
        athlete_id=athlete_id,
        analysis_type="activity_analysis",
        content=parsed,
        usage=message.usage,
        model=message.model,
        activity_id=activity_id,
    )
