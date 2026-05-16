# Stranalyser – Architektur

## Systemübersicht

Stranalyser ist eine vollständig containerisierte, self-hosted Web-Applikation für lokale Strava-Aktivitätsanalyse mit KI-Integration.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP/HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Nginx (Port 80)                          │
│   /          → frontend:3000 (React SPA)                        │
│   /api/      → api:8000 (FastAPI)                               │
└──────────┬──────────────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────────┐
    │                                             │
    ▼                                             ▼
┌─────────────┐                         ┌─────────────────┐
│  Frontend   │                         │   API (FastAPI)  │
│  (React)    │                         │   Port 8000      │
│  Port 3000  │                         └────────┬────────┘
└─────────────┘                                  │
                                    ┌────────────┼──────────────┐
                                    │            │              │
                                    ▼            ▼              ▼
                              ┌──────────┐ ┌─────────┐ ┌────────────┐
                              │PostgreSQL│ │  Redis  │ │  Externe   │
                              │ Port5432 │ │ Port6379│ │    APIs    │
                              └──────────┘ └────┬────┘ └─────┬──────┘
                                                │             │
                                                ▼             │
                                         ┌──────────────┐    │
                                         │ Celery Worker│    │
                                         │ + Beat       │    │
                                         └──────────────┘    │
                                                        ┌────┴────────────┐
                                                        │ strava.com       │
                                                        │ api.anthropic.com│
                                                        │ googleapis.com   │
                                                        └─────────────────┘
```

---

## Dienste (Docker Compose)

| Service | Image | Port | Rolle |
|---------|-------|------|---------|
| `nginx` | nginx:alpine | 80 | Reverse Proxy |
| `api` | ./backend | 8000 | FastAPI REST API |
| `frontend` | ./frontend | 3000 | React SPA |
| `db` | postgres:16-alpine | 5432 | Datenspeicherung |
| `redis` | redis:7-alpine | 6379 | Message Broker |
| `worker` | ./backend | — | Celery Worker + Beat |

---

## Backend-Architektur

```
backend/app/
├── main.py          # FastAPI-App, Middleware, Router
├── config.py        # Pydantic-Settings (aus .env)
├── database.py      # Async SQLAlchemy Engine
│
├── models/
│   ├── athlete.py       # OAuth-Tokens, Profil
│   ├── activity.py      # Aktivitäten + Streams
│   ├── ai_analysis.py   # KI-Ergebnisse (gecacht)
│   └── sync_state.py    # Sync-Status
│
├── routers/
│   ├── auth.py          # OAuth-Login, /me
│   ├── activities.py    # Aktivitätsliste, Detail, Streams
│   ├── stats.py         # Statistiken
│   ├── ai.py            # KI-Endpunkte inkl. GET /providers
│   └── sync.py          # Sync-Trigger
│
├── services/
│   ├── strava_client.py # Strava API + Token-Refresh
│   ├── sync_service.py  # Upsert-Logik
│   └── ai_service.py    # Provider-Abstraktion (Claude + Gemini)
│
└── tasks/
    ├── celery_app.py    # Celery-Config, Beat-Schedule
    ├── sync_tasks.py    # full_sync, incremental_sync
    └── stream_tasks.py  # fetch_streams
```

---

## Datenmodell

```
athletes (id, username, firstname, lastname, tokens...)
  │
  ├── activities (id, sport_type, start_date, distance, polyline, raw JSONB...)
  │     └── activity_streams (stream_type, data JSONB, ...)
  │
  ├── sync_state (athlete_id PK, last_full_sync, last_incr_sync, status)
  │
  └── ai_analyses (id, analysis_type, activity_id?, week_key?, content JSONB,
                   input_tokens, output_tokens, model, created_at)
```

---

## Frontend-Architektur

```
frontend/src/
├── api/client.js              # Axios + aiApi.getProviders()
├── store/authStore.js         # Zustand Auth-State
├── pages/                     # LoginPage, Dashboard, Activities, Activity
└── components/
    ├── AI/
    │   └── ModelSelector.jsx  ← Shared KI-Modell-Dropdown
    ├── Dashboard/
    │   ├── WeeklyReport.jsx   # Inkl. ModelSelector
    │   └── ...
    └── ActivityDetail/
        ├── AIAnalysis.jsx     # Inkl. ModelSelector
        └── ...
```

### ModelSelector-Datenfluss

```
Mount → GET /api/ai/providers
      → Dropdown (nur konfigurierte Provider)
      → Vorauswahl = current_model

Nutzer wählt Modell
      → generate() mit ?model=...&provider=...
      → POST /api/ai/.../analyze?model=gemini-2.0-flash&provider=google
```

---

## KI-Provider-Routing (Backend)

```
POST /api/ai/activities/{id}/analyze?model=gemini-2.0-flash&provider=google
  │
  ▼
_check_provider()  # Key vorhanden? Provider bekannt?
  │
  ▼
ai_service.analyze_activity(..., model, provider)
  │
  ▼
_call_ai(prompt, model, provider, max_tokens)
  ├── provider=="google"    → _call_google()    → google-genai SDK
  └── provider=="anthropic" → _call_anthropic() → anthropic SDK
  │
  ▼
(text, usage_dict, model_name) → _save_analysis() → AIAnalysis
```

---

## Authentifizierungsflow

```
GET /api/auth/login → Strava OAuth
Strava → /api/auth/callback → Token-Exchange → Session → full_sync → /dashboard
Frontend: GET /api/auth/me → Zustand-Store
```

---

## Konfiguration & Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|-------------|
| `STRAVA_CLIENT_ID` | ✅ | Strava App Client-ID |
| `STRAVA_CLIENT_SECRET` | ✅ | Strava App Secret |
| `SECRET_KEY` | ✅ | Session-Signing-Key |
| `POSTGRES_PASSWORD` | ✅ | PostgreSQL-Passwort |
| `AI_PROVIDER` | ❌ | `anthropic` (Standard) oder `google` |
| `AI_MODEL` | ❌ | Modellname (Standard: `claude-sonnet-4-6`) |
| `ANTHROPIC_API_KEY` | ⚠️ | Pflicht wenn `AI_PROVIDER=anthropic` |
| `GOOGLE_API_KEY` | ⚠️ | Pflicht wenn `AI_PROVIDER=google` |
| `DATABASE_URL` | auto | Von Compose gesetzt |
| `REDIS_URL` | auto | Von Compose gesetzt |

---

## Architekturentscheidungen (ADRs)

### ADR-1: FastAPI
Native async, automatische OpenAPI-Doku, Pydantic-Settings.

### ADR-2: Celery
Retry-Logik, Beat-Scheduling, Worker-Skalierung unabhängig vom API-Prozess.

### ADR-3: PostgreSQL
JSONB für Strava-Rohdaten und Streams; Produktionsreife.

### ADR-4: Zustand statt Redux
Minimaler Boilerplate für einfaches Auth-State-Management.

### ADR-5: Provider-Abstraktion in ai_service.py
Beide Provider teilen dieselbe Prompt-Logik. Neue Provider = neue `_call_<provider>()` Funktion.

### ADR-6: Per-Request Modell-Override via Query-Params
Für Alpha/Beta-Tests kann jede Anfrage ein anderes Modell nutzen ohne Neustart.
