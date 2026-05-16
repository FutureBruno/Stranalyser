# Stranalyser – AI Agent Definition

## Überblick

Stranalyser unterstützt **Anthropic Claude** und **Google Gemini** als KI-Provider. Beide können für alle Analyseagenten genutzt werden. API-Keys können entweder zentral über `.env` (Server-seitig) oder individuell pro Nutzer über die **Settings-Seite** (`/settings`) hinterlegt werden. Nutzer-Keys haben dabei Vorrang vor Umgebungsvariablen.

---

## Provider-Übersicht

| Provider | SDK | Unterstützte Modelle |
|----------|-----|----------------------|
| Anthropic | `anthropic` Python SDK | `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| Google | `google-genai` Python SDK | `gemini-2.0-flash`, `gemini-2.0-flash-thinking-exp`, `gemini-1.5-pro`, `gemini-1.5-flash` |

**Standard (Server-Fallback):** `anthropic` / `claude-sonnet-4-6` (via `.env`)

---

## Key-Hierarchie (Priorität absteigend)

```
1. Nutzer-Key aus user_settings (DB)          ← höchste Priorität
2. Env-Var (ANTHROPIC_API_KEY / GOOGLE_API_KEY)
3. Fehler: HTTP 503                           ← kein Key verfügbar
```

---

## Agent 1: Aktivitätsanalyst (`activity_analysis`)

### Zweck
Analysiert eine einzelne Trainingsaktivität und liefert strukturiertes Feedback zu Leistung, Intensität und Trainingsempfehlungen. Vergleicht mit bis zu 10 vorangegangenen Aktivitäten desselben Sporttyps.

### Trigger
- **Manuell:** Nutzer klickt „Aktivität analysieren" → `POST /api/ai/activities/{id}/analyze`
- **Gecacht:** Erneuter Aufruf liefert gespeicherte Analyse → `GET /api/ai/activities/{id}/analysis`
- **Neu generieren:** `?force_refresh=true`
- **Modell-Override:** `?model=gemini-2.0-flash&provider=google`

### Priorität bei Provider/Modell-Auflösung
```
Query-Param (?provider, ?model)
  → User-Preference (user_settings.preferred_provider/model)
    → Env-Default (AI_PROVIDER, AI_MODEL)
```

### Ausgabeformat (JSON)

```json
{
  "bewertung": "string",
  "leistungsvergleich": {
    "tempo_trend": "besser|schlechter|gleich – Erklärung",
    "herzfrequenz_trend": "string",
    "ausdauer_trend": "string",
    "zusammenfassung": "string"
  },
  "staerken": ["string"],
  "verbesserungspotential": ["string"],
  "besonderheiten": "string|null",
  "trainingsempfehlungen": ["string"],
  "erholung": "string"
}
```

### Implementierung

```
backend/app/services/ai_service.py     →  analyze_activity()
backend/app/routers/ai.py              →  POST /api/ai/activities/{id}/analyze
frontend/src/components/ActivityDetail/AIAnalysis.jsx
```

---

## Agent 2: Wochenbericht-Generator (`weekly_report`)

### Zweck
Erstellt einen zusammenfassenden Wochenbericht über alle Trainingsaktivitäten einer Kalenderwoche. Caching verhindert doppelte API-Calls für dieselbe Woche.

### Trigger
- **Manuell:** `POST /api/ai/weekly-report`
- **Gecacht:** Wochenschlüssel (`2026-W18`) verhindert doppelte Generierung
- **Neu generieren:** `?force_refresh=true` (löscht vorherigen Eintrag)
- **Modell-Override:** `?model=claude-opus-4-7&provider=anthropic`
- **Wochen-Offset:** `?week_offset=-1` = letzte Woche

### Ausgabeformat (JSON)

```json
{
  "woche": "05.05. – 11.05.2026",
  "zusammenfassung": "string",
  "highlights": ["string"],
  "sportarten_uebersicht": [
    { "sport": "string", "anzahl": 0, "gesamt_distanz": "string", "gesamt_dauer": "string" }
  ],
  "verbesserungen": ["string"],
  "worauf_achten": ["string"],
  "empfehlungen": ["string"],
  "erholung_und_belastung": "string",
  "naechste_woche": "string"
}
```

### Implementierung

```
backend/app/services/ai_service.py  →  generate_weekly_report()
backend/app/routers/ai.py           →  POST /api/ai/weekly-report
frontend/src/components/Dashboard/WeeklyReport.jsx
```

---

## Provider-Abstraktion (Backend)

### `_call_ai()` – zentrales Routing

```python
def _call_ai(
    prompt: str,
    model: str | None,
    provider: str | None,
    max_tokens: int,
    user_anthropic_key: str | None = None,   # aus user_settings
    user_google_key: str | None = None,       # aus user_settings
) -> tuple[str, dict, str]:
    effective_provider = provider or settings.ai_provider
    effective_model    = model    or settings.ai_model
    if effective_provider == "google":
        return _call_google(prompt, effective_model, max_tokens, api_key=user_google_key)
    return _call_anthropic(prompt, effective_model, max_tokens, api_key=user_anthropic_key)
```

### Key-Fallback in `_call_anthropic()` / `_call_google()`

```python
def _call_anthropic(prompt, model, max_tokens, api_key=None):
    key = api_key or settings.anthropic_api_key  # Nutzer-Key hat Vorrang
    if not key:
        raise ValueError("ANTHROPIC_API_KEY ist nicht konfiguriert.")
    ...
```

---

## Settings-Integration (M8)

### Neue Tabelle: `user_settings`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `athlete_id` | BigInteger PK/FK | Verknüpfung mit `athletes` |
| `anthropic_api_key` | Text, nullable | Nutzer-eigener Anthropic-Key |
| `google_api_key` | Text, nullable | Nutzer-eigener Google-Key |
| `preferred_provider` | String(50) | Default-Anbieter des Nutzers |
| `preferred_model` | String(100) | Default-Modell des Nutzers |
| `updated_at` | DateTime | Letztes Update |

### API-Endpunkte Settings

```
GET  /api/settings   → Keys maskiert (••••••••), has_anthropic_key, has_google_key
PUT  /api/settings   → Keys speichern/überschreiben; leerer String = Key löschen
```

**Sicherheit:** Keys werden niemals im Klartext zurückgegeben. Übertragung erfolgt nur in Richtung Server.

### Routing im AI-Router

```
POST /api/ai/.../analyze
  │
  ├── _get_user_keys(db, athlete_id)         → (anthropic_key, google_key)
  ├── _get_user_preferred(db, athlete_id)    → (preferred_provider, preferred_model)
  │
  ├── effective_provider = ?provider || pref_provider || settings.ai_provider
  ├── effective_model    = ?model    || pref_model    || settings.ai_model
  │
  └── ai_service.analyze_activity(..., user_anthropic_key, user_google_key)
```

---

## ModelSelector (Frontend)

Die `ModelSelector`-Komponente (`frontend/src/components/AI/ModelSelector.jsx`):

- Lädt verfügbare Provider von `GET /api/ai/providers`
- `GET /api/ai/providers` berücksichtigt jetzt Nutzer-Keys: `configured: true` wenn Nutzer- oder Env-Key vorhanden
- Zeigt nur konfigurierte Provider (min. ein Key gesetzt)
- Gruppiert Modelle nach Provider als `<optgroup>`
- Vorauswahl = `current_model` (= Nutzer-Präferenz, falls gesetzt)
- Änderung wird als `(model, provider)` nach oben weitergegeben

---

## Fehlerbehandlung

| Fehler | Verhalten |
|--------|-----------|
| Kein API-Key (weder Nutzer noch Env) | HTTP 503 mit klarer Fehlermeldung |
| Unbekannter Provider | HTTP 400 |
| Ungültiges JSON in Antwort | Rohtext als `content.raw` speichern |
| Analyse bereits vorhanden | Cache zurückgeben, kein neuer API-Call |
| Settings-Eintrag nicht vorhanden | Wird beim ersten `PUT` angelegt |

---

## Konfiguration

### Umgebungsvariablen (Server-Default)

```env
AI_PROVIDER=anthropic          # oder: google
AI_MODEL=claude-sonnet-4-6     # oder: gemini-2.0-flash
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

### Nutzer-Einstellungen (UI → DB)

Über `/settings` im Frontend:
- Anthropic API-Key, Google API-Key
- Bevorzugter Anbieter, bevorzugtes Modell
- Keys werden maskiert dargestellt, können einzeln gelöscht werden

---

## Kostenabschätzung (Stand Mai 2026)

| Agent | Modell | Ø Kosten/Anfrage |
|-------|--------|------------------|
| Aktivitätsanalyse | claude-sonnet-4-6 | ~$0.006 |
| Wochenbericht | claude-sonnet-4-6 | ~$0.012 |
| Aktivitätsanalyse | gemini-2.0-flash | ~$0.001 |
| Wochenbericht | gemini-2.0-flash | ~$0.002 |

Bei 10 Aktivitäten/Woche + 1 Wochenbericht: **~$0.07/Woche** (Claude Sonnet) oder **~$0.01/Woche** (Gemini Flash).

---

## Geplante Agenten-Erweiterungen

| Agent | Zweck | Meilenstein |
|-------|-------|-------------|
| Trainingsplan-Generator | Personalisierter Wochenplan | M12 |
| Anomalie-Detektor | Erkennt Übertraining automatisch | M12 |
| Strecken-Kommentator | Analysiert GPS-Route | M13 |
| Anthropic Prompt Caching | Systempromt-Caching (~80% Einsparung) | M9 |
| KI-Antwort-Streaming (SSE) | Kein Warten auf vollständige Antwort | M10 |
