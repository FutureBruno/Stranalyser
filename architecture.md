# Stranalyser – Architektur

## Systemübersicht

Stranalyser ist eine vollständig containerisierte, self-hosted Web-Applikation für lokale Strava-Aktivitätsanalyse mit KI-Integration. Alle Daten verbleiben auf dem eigenen Server.

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
                                    ┌────────────┼────────────┐
                                    │            │            │
                                    ▼            ▼            ▼
                              ┌──────────┐ ┌─────────┐ ┌──────────┐
                              │PostgreSQL│ │  Redis  │ │  Strava  │
                              │ Port5432 │ │ Port6379│ │   API    │
                              └──────────┘ └────┬────┘ └──────────┘
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │ Celery Worker│
                                         │ + Beat       │
                                         └──────────────┘
                                                │
                                                ▼
                                         ┌──────────────┐
                                         │ Anthropic    │
                                         │ Claude API   │
                                         └──────────────┘
```

---

## Dienste (Docker Compose)

| Service | Image | Port | Rolle |
|---------|-------|------|-------|
| `nginx` | nginx:alpine | 80 | Reverse Proxy & Static-File-Server |
| `api` | ./backend | 8000 | FastAPI REST API + Geschäftslogik |
| `frontend` | ./frontend | 3000 | React SPA (Vite Dev / Nginx Prod) |
| `db` | postgres:16-alpine | 5432 | Primäre Datenspeicherung |
| `redis` | redis:7-alpine | 6379 | Message Broker & Task-Queue |
| `worker` | ./backend | — | Celery Worker + Beat (Background Jobs) |

Alle Services kommunizieren über das Bridge-Netzwerk `stranalyser_net`.

---

## Backend-Architektur

```
backend/app/
├── main.py          # FastAPI-App, Middleware, Router-Registrierung
├── config.py        # Pydantic-Settings (aus .env)
├── database.py      # Async SQLAlchemy Engine, Session-Factory
│
├── models/          # SQLAlchemy ORM-Modelle
│   ├── athlete.py       # Nutzer/Athleten-Daten, OAuth-Tokens
│   ├── activity.py      # Aktivitäten + ActivityStreams (GPS, HR, Power)
│   ├── ai_analysis.py   # KI-Analyseergebnisse (gecacht)
│   └── sync_state.py    # Sync-Status pro Athlet
│
├── routers/         # API-Endpunkte (thin layer)
│   ├── auth.py          # OAuth-Login, Logout, /me
│   ├── activities.py    # Aktivitätsliste, Detail, Streams
│   ├── stats.py         # Aggregierte Statistiken
│   ├── ai.py            # KI-Generierung und Abruf
│   └── sync.py          # Sync-Trigger, Status
│
├── services/        # Geschäftslogik (fat layer)
│   ├── strava_client.py # Strava REST API Client (httpx, Token-Refresh)
│   ├── sync_service.py  # Upsert-Logik, inkrementelle/vollst. Syncs
│   └── ai_service.py    # Claude API Calls, Prompt-Aufbau, Caching
│
└── tasks/           # Celery Hintergrundtasks
    ├── celery_app.py    # Celery-Konfiguration, Beat-Schedule
    ├── sync_tasks.py    # full_sync, incremental_sync Tasks
    └── stream_tasks.py  # fetch_streams_for_activity Task
```

### Schichtenprinzip

```
Router → Service → Model/DB
         Service → External API (Strava, Claude)
         Service → Task Queue (Celery)
```

Router-Schichten enthalten keine Geschäftslogik. Services enthalten keine HTTP-Details.

---

## Datenmodell

```
┌─────────────────────────────────────────────────────────────────┐
│  athletes                                                       │
│  id (PK) | username | firstname | lastname | profile_medium     │
│  access_token | refresh_token | token_expires_at | scope        │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 1:N
          ┌────────────┼────────────────────┐
          ▼            ▼                    ▼
┌──────────────┐ ┌──────────────┐  ┌────────────────────┐
│  activities  │ │  sync_state  │  │    ai_analyses     │
│  id (PK)     │ │  athlete_id  │  │  id (PK)           │
│  athlete_id  │ │  (PK, FK)    │  │  athlete_id (FK)   │
│  name        │ │  last_full_  │  │  analysis_type     │
│  sport_type  │ │  sync        │  │  activity_id (FK?) │
│  start_date  │ │  last_incr_  │  │  week_key          │
│  distance    │ │  sync        │  │  content (JSONB)   │
│  moving_time │ │  sync_status │  │  input_tokens      │
│  elevation   │ │  activities_ │  │  output_tokens     │
│  avg_speed   │ │  synced      │  │  model             │
│  avg_hr      │ └──────────────┘  │  created_at        │
│  avg_watts   │                   └────────────────────┘
│  polyline    │
│  raw (JSONB) │
│  streams_    │
│  fetched     │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────────────────┐
│  activity_streams        │
│  id (PK, auto)           │
│  activity_id (FK, CASC.) │
│  stream_type             │
│  data (JSONB)            │
│  original_size           │
│  resolution              │
│  series_type             │
└──────────────────────────┘
```

### Stream-Typen

| stream_type | Inhalt | Sportart |
|-------------|--------|----------|
| `latlng` | GPS-Koordinaten | Alle |
| `altitude` | Höhe in Metern | Alle |
| `heartrate` | Herzfrequenz bpm | Alle (mit HR-Sensor) |
| `watts` | Leistung in Watt | Radfahren (mit Powermeter) |
| `cadence` | Kadenz rpm | Radfahren/Laufen |
| `velocity_smooth` | Geschwindigkeit m/s | Alle |
| `distance` | Kumulierte Distanz | Alle |
| `time` | Zeitstempel | Alle |

---

## Frontend-Architektur

```
frontend/src/
├── main.jsx          # React-Einstiegspunkt, Query-Client-Setup
├── App.jsx           # Router-Konfiguration, geschützte Routen
│
├── api/
│   └── client.js     # Axios-Instanz, alle API-Endpunkt-Wrapper
│
├── store/
│   └── authStore.js  # Zustand-Store: Athlete-State, Login/Logout
│
├── pages/            # Seitenkomponenten (Route-Level)
│   ├── LoginPage.jsx
│   ├── DashboardPage.jsx
│   ├── ActivitiesPage.jsx
│   └── ActivityPage.jsx
│
└── components/       # Wiederverwendbare UI-Komponenten
    ├── Layout/
    │   ├── Layout.jsx      # Wrapper mit Header
    │   └── Header.jsx      # Navigation
    │
    ├── Dashboard/
    │   ├── OverviewStats.jsx   # Stat-Cards (Distanz, Zeit, Höhe)
    │   ├── WeeklyChart.jsx     # Chart.js Balken/Linienchart
    │   └── WeeklyReport.jsx    # KI-Wochenberichts-Anzeige
    │
    ├── ActivityList/
    │   ├── ActivityCard.jsx    # Einzelne Aktivitätskarte
    │   └── FilterBar.jsx       # Sporttyp- und Zeitraumfilter
    │
    └── ActivityDetail/
        ├── ActivityMap.jsx     # Leaflet-Karte mit Route
        ├── ActivityStats.jsx   # HR/Leistung/Höhe Charts
        └── AIAnalysis.jsx      # KI-Analyse-Darstellung
```

### State Management

```
Zustand (authStore)
└── athlete: { id, username, firstname, lastname, profile_medium }
└── isAuthenticated: boolean
└── login() / logout()

Server State: direkte Axios-Calls in Komponenten
(kein React Query implementiert – manuelles Loading/Error-State)
```

---

## Authentifizierungsflow

```
1. Nutzer klickt "Mit Strava anmelden"
       │
       ▼
2. GET /api/auth/login
   → Redirect zu Strava OAuth (scope: activity:read_all)
       │
       ▼
3. Strava → GET /api/auth/callback?code=...
   → Token-Exchange (Authorization Code → Access/Refresh Token)
   → Athlete-Profil abrufen
   → Athlete in DB upserten
   → Server-Session setzen
   → full_sync Celery-Task starten
   → Redirect zu Frontend /dashboard
       │
       ▼
4. Frontend: GET /api/auth/me
   → Athlete-Daten in Zustand-Store laden
   → Geschützte Routen freischalten
```

### Token-Refresh

```
Strava Access Token abgelaufen?
       │
       ▼
strava_client.py prüft token_expires_at vor jedem API-Call
       │
       ▼
POST https://www.strava.com/oauth/token (grant_type=refresh_token)
       │
       ▼
Neue Tokens in athletes-Tabelle speichern
       │
       ▼
API-Call fortsetzen
```

---

## Synchronisationsarchitektur

```
Celery Beat (alle 5 min)
       │
       ▼
incremental_sync_task(athlete_id)
       │
       ├── Alle Athleten mit gültigem Token laden
       │
       ├── Strava API: Aktivitäten seit last_incremental_sync abrufen
       │
       ├── Neue/geänderte Aktivitäten in DB upserten
       │
       └── sync_state.last_incremental_sync aktualisieren

Manueller Trigger (nach OAuth oder Button):
POST /api/sync/trigger
       │
       ▼
full_sync_task(athlete_id)
       │
       ├── Alle Aktivitäten paginiert von Strava laden (Seiten à 200)
       │
       ├── Bulk-Upsert in activities-Tabelle
       │
       └── sync_state.last_full_sync aktualisieren

Stream-Fetch (lazy, beim ersten Detail-Aufruf):
GET /api/activities/{id}/streams
       │
       ├── streams_fetched == True? → Aus DB zurückgeben
       │
       └── streams_fetched == False?
           │
           ▼
       fetch_streams_task(activity_id)
           │
           ├── Strava API: alle Stream-Typen für Aktivität
           │
           ├── In activity_streams speichern
           │
           └── activities.streams_fetched = True
```

---

## KI-Analyse-Flow

```
POST /api/ai/activities/{id}/analyze
       │
       ├── Bereits gecacht (ai_analyses WHERE activity_id=id AND type='activity_analysis')?
       │   └── Ja → Gecachte Analyse zurückgeben (kein API-Call)
       │
       ├── Nein → Aktivitätsdaten aus DB laden
       │
       ├── Prompt aufbauen (Systemkontext + Aktivitätsdaten als JSON)
       │
       ├── Claude API aufrufen (anthropic.messages.create)
       │
       ├── JSON-Antwort parsen
       │
       └── In ai_analyses speichern (content, tokens, model)
           └── Ergebnis zurückgeben
```

---

## Nginx-Routing

```nginx
# /api/ → FastAPI Backend
location /api/ {
    proxy_pass http://api:8000;
}

# / → React SPA (alle anderen Pfade)
location / {
    proxy_pass http://frontend:3000;
    # oder: try_files für statische Build-Artefakte
}
```

---

## Sicherheitsarchitektur

| Aspekt | Implementierung |
|--------|----------------|
| Authentifizierung | Strava OAuth2 (Authorization Code Flow) |
| Session-Management | Server-seitige Sessions (starlette) |
| Token-Speicherung | Verschlüsselt in PostgreSQL (access/refresh tokens) |
| API-Isolation | Alle Endpunkte prüfen Session-Cookie |
| Container-Isolation | Kein Port-Forwarding auf DB/Redis außer intern |
| Secrets | Nur via .env, nie im Code |
| CORS | Konfiguriert in FastAPI für Frontend-Origin |

### Bekannte Sicherheitslücken (zu adressieren)

- Kein Rate-Limiting auf API-Endpunkten
- Kein HTTPS erzwungen (Nutzer muss selbst SSL terminieren)
- Sessions werden nicht invalidiert bei Token-Diebstahl

---

## Konfiguration & Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|-------------|
| `STRAVA_CLIENT_ID` | ✅ | Strava App Client-ID |
| `STRAVA_CLIENT_SECRET` | ✅ | Strava App Secret |
| `SECRET_KEY` | ✅ | Session-Signing-Key (zufällig, 32+ Zeichen) |
| `POSTGRES_PASSWORD` | ✅ | PostgreSQL-Passwort |
| `ANTHROPIC_API_KEY` | ✅ | Claude API Key |
| `DATABASE_URL` | auto | postgresql+asyncpg://... (aus Compose gesetzt) |
| `REDIS_URL` | auto | redis://redis:6379/0 (aus Compose gesetzt) |
| `CELERY_BROKER_URL` | auto | Wie REDIS_URL |
| `CLAUDE_MODEL` | ❌ | Claude-Modell (Standard: claude-sonnet-4-6) |
| `DEBUG` | ❌ | Debug-Modus (Standard: false) |

---

## Abhängigkeits-Graph

```
nginx
  ├── depends_on: frontend, api
frontend
  └── (statische Assets, kein Backend-Dep)
api
  ├── depends_on: db, redis
  └── external: strava.com, api.anthropic.com
worker
  ├── depends_on: db, redis
  └── external: strava.com, api.anthropic.com
db
  └── (keine Abhängigkeiten)
redis
  └── (keine Abhängigkeiten)
```

---

## Technologie-Entscheidungen (ADRs)

### ADR-1: FastAPI statt Django/Flask

**Entscheidung:** FastAPI  
**Begründung:** Native async-Unterstützung für gleichzeitige Strava-API-Calls; automatische OpenAPI-Dokumentation; Pydantic für typsichere Konfiguration.

### ADR-2: Celery statt FastAPI BackgroundTasks

**Entscheidung:** Celery + Redis  
**Begründung:** Aktivitäts-Sync kann mehrere Minuten dauern; Celery ermöglicht Retry-Logik, Beat-Scheduling und Worker-Skalierung unabhängig vom API-Prozess.

### ADR-3: PostgreSQL statt SQLite

**Entscheidung:** PostgreSQL  
**Begründung:** JSONB für rohe Strava-Daten und Streams; bessere Performance bei großen Aktivitätsdatensätzen; Produktionsreife.

### ADR-4: Zustand statt Redux

**Entscheidung:** Zustand  
**Begründung:** Minimaler Boilerplate für einfaches Auth-State-Management; ausreichend für aktuellen Umfang.

### ADR-5: Kein React Query (aktuell)

**Entscheidung:** Direktes Axios  
**Begründung:** MVP-Entscheidung; React Query für Server-State-Caching ist für M8 geplant um Loading-States und Cache-Invalidierung zu vereinheitlichen.
