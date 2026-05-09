# Stranalyser – AI Agent Definition

## Überblick

Stranalyser nutzt die Anthropic Claude API für zwei eigenständige KI-Analysefunktionen. Dieses Dokument beschreibt die Agentenarchitektur, Promptstrategien, Verhalten und Erweiterungsmöglichkeiten.

---

## Agent 1: Aktivitätsanalyst (`activity_analysis`)

### Zweck

Analysiert eine einzelne Trainingsaktivität und liefert strukturiertes Feedback zu Leistung, Intensität und Trainingsempfehlungen.

### Trigger

- **Manuell:** Nutzer klickt "Analysieren" in der Aktivitätsdetailansicht (`POST /api/ai/activities/{id}/analyze`)
- **Gecacht:** Erneuter Aufruf liefert die gespeicherte Analyse ohne neuen API-Call (`GET /api/ai/activities/{id}/analysis`)

### Eingabedaten

```python
{
  "name": str,                     # Aktivitätsname
  "sport_type": str,               # z. B. "Ride", "Run"
  "start_date": str,               # ISO-Datum
  "distance": float,               # Meter
  "moving_time": int,              # Sekunden
  "total_elevation_gain": float,   # Meter
  "average_speed": float,          # m/s
  "average_heartrate": float,      # bpm (optional)
  "max_heartrate": float,          # bpm (optional)
  "average_watts": float,          # W (optional, Rad)
  "average_cadence": float,        # rpm (optional)
  "suffer_score": int              # Strava Belastungswert (optional)
}
```

### Ausgabeformat (JSON)

```json
{
  "zusammenfassung": "string",
  "leistungsbewertung": "string",
  "intensitaet": "niedrig|mittel|hoch|sehr hoch",
  "staerken": ["string"],
  "verbesserungen": ["string"],
  "empfehlungen": ["string"],
  "naechste_einheit": "string"
}
```

### Modell

- **Aktuell:** `claude-sonnet-4-6` (oder konfiguriert via `CLAUDE_MODEL` Env-Variable)
- **Empfehlung für Produktion:** `claude-haiku-4-5-20251001` für schnellere, kostengünstigere Antworten bei einfachen Aktivitätsanalysen

### Verhalten & Constraints

- Sprache: **Deutsch** (Systemsprache der App)
- Antwortlänge: Präzise und strukturiert, kein Fließtext-Überfluss
- Kein externes Wissen über den Nutzer außer den übergebenen Aktivitätsdaten
- Keine Halluzination von Daten – fehlende Metriken werden im Output als "nicht verfügbar" markiert
- Caching: Einmalige Generierung pro Aktivität; Ergebnis dauerhaft in `ai_analyses` gespeichert

### Implementierung

```
backend/app/services/ai_service.py  →  generate_activity_analysis()
backend/app/routers/ai.py           →  POST /api/ai/activities/{id}/analyze
```

---

## Agent 2: Wochenbericht-Generator (`weekly_report`)

### Zweck

Erstellt einen zusammenfassenden Wochenbericht über alle Trainingsaktivitäten einer Kalenderwoche mit Gesamtauswertung und langfristigen Empfehlungen.

### Trigger

- **Manuell:** Nutzer klickt "Wochenbericht generieren" im Dashboard (`POST /api/ai/weekly-report`)
- **Gecacht:** Wochenschlüssel (`2026-W18`) verhindert doppelte Generierung für dieselbe Woche

### Eingabedaten

```python
{
  "week_key": str,                 # z. B. "2026-W18"
  "start_date": str,               # Montag der Woche (ISO)
  "end_date": str,                 # Sonntag der Woche (ISO)
  "activities": [
    {
      "name": str,
      "sport_type": str,
      "start_date": str,
      "distance": float,
      "moving_time": int,
      "total_elevation_gain": float,
      "average_speed": float,
      "average_heartrate": float,  # optional
      "average_watts": float,      # optional
      "suffer_score": int          # optional
    }
  ],
  "totals": {
    "total_distance": float,
    "total_time": int,
    "total_elevation": float,
    "activity_count": int,
    "sport_types": [str]
  }
}
```

### Ausgabeformat (JSON)

```json
{
  "titel": "string",
  "zusammenfassung": "string",
  "highlights": ["string"],
  "gesamtbewertung": "string",
  "belastungsanalyse": "string",
  "naechste_woche": ["string"],
  "langfristige_empfehlungen": ["string"]
}
```

### Modell

- **Aktuell:** `claude-sonnet-4-6`
- **Empfehlung für Produktion:** `claude-sonnet-4-6` (komplexere Zusammenfassung rechtfertigt stärkeres Modell)

### Verhalten & Constraints

- Sprache: **Deutsch**
- Berücksichtigt die Vielfalt der Sportarten (kein reiner Radsport-Fokus)
- Hebt Ruhetage und Erholung positiv hervor, wenn sinnvoll
- Keine medizinischen Diagnosen oder Gesundheitsratschläge jenseits allgemeiner Trainingstipps
- Caching: Pro Wochenschlüssel + `athlete_id` – ein Nutzer kann denselben Bericht mehrfach abrufen, ohne neue Kosten

### Implementierung

```
backend/app/services/ai_service.py  →  generate_weekly_report()
backend/app/routers/ai.py           →  POST /api/ai/weekly-report
```

---

## Gemeinsame Agentenkonfiguration

### Systemkontext (System Prompt Basis)

Beide Agenten teilen denselben Systemkontext-Aufbau:

```
Du bist ein erfahrener Trainingsanalyst und Sportcoach.
Du analysierst Trainingsdaten von Ausdauersportlern (Radfahrer, Läufer, Triathleten).
Deine Antworten sind immer auf Deutsch, präzise, motivierend und datenbasiert.
Du gibst keine medizinischen Diagnosen.
Antworte ausschließlich im angeforderten JSON-Format.
```

### Token-Tracking

Jede Analyse speichert:

```python
{
  "input_tokens": int,
  "output_tokens": int,
  "model": str,
  "created_at": datetime
}
```

Diese Daten sind in der `ai_analyses`-Tabelle abrufbar und ermöglichen Kostenüberwachung.

### Fehlerbehandlung

| Fehler | Verhalten |
|--------|-----------|
| Anthropic API nicht erreichbar | HTTP 503 zurückgeben, keine Daten speichern |
| Ungültiges JSON in Antwort | Rohtext als `content.raw` speichern, Warnung loggen |
| Aktivität hat keine Streams | Analyse nur auf verfügbaren Metadaten basieren |
| Analyse bereits vorhanden | GET-Endpunkt liefert Cache, kein neuer API-Call |

---

## Geplante Agenten-Erweiterungen

### Agent 3: Trainingsplan-Generator (geplant, M9)

- Erstellt personalisierten Wochentrainingsplan basierend auf historischen Daten
- Eingabe: Ziel (z. B. "Marathon in 12 Wochen"), aktuelle Fitness, Verfügbarkeit
- Ausgabe: 7-Tage-Plan mit konkreten Einheiten

### Agent 4: Anomalie-Detektor (geplant, M9)

- Erkennt ungewöhnliche Leistungsabfälle oder Übertrainings-Muster
- Läuft automatisch nach jedem Sync als Hintergrundtask
- Benachrichtigt den Nutzer bei kritischen Mustern

### Agent 5: Strecken-Kommentator (geplant, M11)

- Analysiert GPS-Route und kommentiert Segmente (Anstiege, Technikanforderungen)
- Eingabe: Polyline + Höhenprofil
- Ausgabe: Streckencharakterisierung und Tipps für die Strecke

---

## Kostenabschätzung (Stand Mai 2026)

| Agent | Modell | Ø Input Tokens | Ø Output Tokens | Ø Kosten/Anfrage |
|-------|--------|----------------|-----------------|-----------------|
| Aktivitätsanalyse | claude-sonnet-4-6 | ~800 | ~400 | ~$0.006 |
| Wochenbericht | claude-sonnet-4-6 | ~1.500 | ~600 | ~$0.012 |

Durch Caching entstehen Kosten nur einmalig pro Analyse. Bei 10 Aktivitäten/Woche + 1 Wochenbericht: **~$0.07/Woche**.

---

## Konfiguration

Relevante Umgebungsvariablen:

```env
ANTHROPIC_API_KEY=sk-ant-...       # Pflicht
CLAUDE_MODEL=claude-sonnet-4-6     # Optional, Standard: claude-sonnet-4-6
```
