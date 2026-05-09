# Stranalyser – AI Agent Definition

## Überblick

Stranalyser unterstützt **Anthropic Claude** und **Google Gemini** als KI-Provider. Jeder Provider kann für beide Analyseagenten genutzt werden. Das Modell ist per `.env` konfigurierbar und kann pro Anfrage via Dropdown oder Query-Parameter überschrieben werden.

---

## Provider-Übersicht

| Provider | SDK | Unterstützte Modelle |
|----------|-----|----------------------|
| Anthropic | `anthropic` Python SDK | `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| Google | `google-genai` Python SDK | `gemini-2.0-flash`, `gemini-2.0-flash-thinking-exp`, `gemini-1.5-pro`, `gemini-1.5-flash` |

**Standard:** `anthropic` / `claude-sonnet-4-6`

---

## Agent 1: Aktivitätsanalyst (`activity_analysis`)

### Zweck

Analysiert eine einzelne Trainingsaktivität und liefert strukturiertes Feedback zu Leistung, Intensität und Trainingsempfehlungen.

### Trigger

- **Manuell:** Nutzer klickt "Aktivität analysieren" (`POST /api/ai/activities/{id}/analyze`)
- **Gecacht:** Erneuter Aufruf liefert gespeicherte Analyse (`GET /api/ai/activities/{id}/analysis`)
- **Neu generieren:** `?force_refresh=true`
- **Modell-Override:** `?model=gemini-2.0-flash&provider=google`

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
backend/app/services/ai_service.py  →  analyze_activity()
backend/app/routers/ai.py           →  POST /api/ai/activities/{id}/analyze
frontend/src/components/ActivityDetail/AIAnalysis.jsx
```

---

## Agent 2: Wochenbericht-Generator (`weekly_report`)

### Zweck

Erstellt einen zusammenfassenden Wochenbericht über alle Trainingsaktivitäten einer Kalenderwoche.

### Trigger

- **Manuell:** `POST /api/ai/weekly-report`
- **Gecacht:** Wochenschlüssel (`2026-W18`) verhindert doppelte Generierung
- **Neu generieren:** `?force_refresh=true`
- **Modell-Override:** `?model=claude-opus-4-7&provider=anthropic`

### Ausgabeformat (JSON)

```json
{
  "woche": "05.05. – 11.05.2026",
  "zusammenfassung": "string",
  "highlights": ["string"],
  "sportarten_uebersicht": [
    {"sport": "string", "anzahl": 0, "gesamt_distanz": "string", "gesamt_dauer": "string"}
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

```python
def _call_ai(prompt, model, provider, max_tokens) -> tuple[str, dict, str]:
    effective_provider = provider or settings.ai_provider
    effective_model    = model    or settings.ai_model
    if effective_provider == "google":
        return _call_google(prompt, effective_model, max_tokens)
    return _call_anthropic(prompt, effective_model, max_tokens)
```

---

## ModelSelector (Frontend)

Die `ModelSelector`-Komponente (`frontend/src/components/AI/ModelSelector.jsx`):

- Lädt verfügbare Provider von `GET /api/ai/providers`
- Zeigt nur konfigurierte Provider (mit gesetztem API-Key)
- Gruppiert Modelle nach Provider als `<optgroup>`
- Vorauswahl = aktueller Backend-Default (`current_model`)
- Änderung wird als `(model, provider)` nach oben weitergegeben

```jsx
<ModelSelector
  value={selectedModel}
  onChange={(model, provider) => { setSelectedModel(model); setSelectedProvider(provider) }}
/>
```

---

## API-Endpunkt: Provider-Info

```
GET /api/ai/providers
```

```json
{
  "current_provider": "anthropic",
  "current_model": "claude-sonnet-4-6",
  "providers": {
    "anthropic": {
      "configured": true,
      "models": ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
    },
    "google": {
      "configured": false,
      "models": ["gemini-2.0-flash", "gemini-2.0-flash-thinking-exp", "gemini-1.5-pro", "gemini-1.5-flash"]
    }
  }
}
```

---

## Fehlerbehandlung

| Fehler | Verhalten |
|--------|-----------|
| API-Key nicht gesetzt | HTTP 503 mit klarer Fehlermeldung |
| Unbekannter Provider | HTTP 400 |
| Ungültiges JSON in Antwort | Rohtext als `content.raw` speichern |
| Analyse bereits vorhanden | Cache zurückgeben, kein neuer API-Call |

---

## Konfiguration (.env)

```env
AI_PROVIDER=anthropic          # oder: google
AI_MODEL=claude-sonnet-4-6     # oder: gemini-2.0-flash
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

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

## Geplante Agenten-Erweiterungen (M10+)

| Agent | Zweck | Status |
|-------|-------|--------|
| Trainingsplan-Generator | Personalisierter Wochenplan | 🔴 Geplant |
| Anomalie-Detektor | Erkennt Übertraining automatisch | 🔴 Geplant |
| Strecken-Kommentator | Analysiert GPS-Route | 🔴 Geplant |
