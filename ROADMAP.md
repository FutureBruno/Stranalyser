# Stranalyser – Implementierungs-Roadmap

## Meilenstein-Übersicht

| # | Meilenstein | Status |
|---|-------------|--------|
| M1 | Kern-Infrastruktur & DevOps | ✅ Abgeschlossen |
| M2 | Strava OAuth & Datensynchronisation | ✅ Abgeschlossen |
| M3 | Backend API & Datenmodelle | ✅ Abgeschlossen |
| M4 | Frontend – Dashboard & Aktivitätsliste | ✅ Abgeschlossen |
| M5 | Aktivitätsdetail – Karte, Charts & Streams | ✅ Abgeschlossen |
| M6 | KI-Analyse (Claude API) | ✅ Abgeschlossen |
| M7 | Multi-Provider KI & Modell-Auswahl | ✅ Abgeschlossen |
| M8 | Test-Abdeckung (Backend & Frontend) | 🔴 Offen |
| M9 | Performance-Optimierungen & Caching | 🔴 Offen |
| M10 | Erweiterte Statistiken & Vergleiche | 🔴 Offen |
| M11 | Mehrbenutzer-Unterstützung & Rollenmodell | 🔴 Offen |
| M12 | Mobile Optimierung & PWA | 🔴 Offen |
| M13 | Export & Daten-Portabilität | 🔴 Offen |

---

## Meilenstein-Beschreibungen

---

### M1 – Kern-Infrastruktur & DevOps ✅

**Ziel:** Produktionsreife Containerisierung aller Dienste mit einem einzigen Startbefehl.

**Umgesetzt:**
- Docker Compose Setup mit 6 Services: `nginx`, `api`, `frontend`, `db`, `redis`, `worker`
- Nginx als Reverse Proxy (Frontend auf `/`, API auf `/api/`)
- PostgreSQL 16 mit persistentem Volume
- Redis 7 als Message Broker für Celery
- Alembic-Migrationen für versionierte Datenbankschemas
- `.env.example` mit allen notwendigen Konfigurationsvariablen
- Health-Checks für alle Services

**Offene Punkte:**
- CI/CD-Pipeline fehlt noch
- Kein automatisiertes Backup der PostgreSQL-Datenbank

---

### M2 – Strava OAuth & Datensynchronisation ✅

**Ziel:** Sichere Authentifizierung via Strava OAuth2 und vollautomatische Synchronisation aller Aktivitäten.

**Umgesetzt:**
- Strava OAuth2-Flow mit automatischer Token-Erneuerung
- Vollständige Erstsynchronisation nach Login
- Inkrementelle Synchronisation alle 5 Minuten via Celery Beat
- Manuelle Synchronisation via `POST /api/sync/trigger`
- `sync_state`-Tabelle zur Verfolgung von Sync-Status
- Lazy-Loading von Aktivitäts-Streams (GPS, HR, Leistung, Kadenz, Höhe)

**Offene Punkte:**
- Strava Webhook-Integration für Echtzeit-Push-Updates

---

### M3 – Backend API & Datenmodelle ✅

**Ziel:** Vollständige REST API mit typisierten Datenmodellen.

**Umgesetzt:**
- FastAPI mit async/await
- SQLAlchemy 2.0 (async) mit PostgreSQL via asyncpg
- Datenmodelle: `Athlete`, `Activity`, `ActivityStream`, `SyncState`, `AIAnalysis`
- JSONB-Felder für rohe Strava-Daten und Stream-Daten
- Paginierung, Filter nach Sporttyp und Datumsbereich
- Aggregierte Statistiken (Übersicht, Wochenansicht)

**Offene Punkte:**
- Rate-Limiting auf API-Endpunkten fehlt

---

### M4 – Frontend – Dashboard & Aktivitätsliste ✅

**Umgesetzt:**
- React 18 + Vite + Tailwind CSS
- React Router DOM mit geschützten Routen
- Zustand für Auth-State-Management
- Dashboard: Stats-Cards, Wochenchart (Chart.js), KI-Wochenbericht
- Aktivitätsliste: Paginierung, Filterbar (Sporttyp, Zeitraum)

**Offene Punkte:**
- Kein Dark Mode, keine Suchfunktion

---

### M5 – Aktivitätsdetail – Karte, Charts & Streams ✅

**Umgesetzt:**
- Leaflet-Karte mit Polyline-Visualisierung
- Höhenprofil-, Herzfrequenz-, Leistungs- und Kadenz-Charts
- Streams werden lazy beim ersten Aufruf geladen

**Offene Punkte:**
- Keine Segmentanzeige, keine Lap-Übersicht

---

### M6 – KI-Analyse (Claude API) ✅

**Umgesetzt:**
- Wochenbericht und Aktivitätsanalyse via Claude API
- Ergebnis-Caching in `ai_analyses`-Tabelle
- Token-Tracking (input/output) pro Analyse
- `force_refresh`-Parameter zum Neu-Generieren

---

### M7 – Multi-Provider KI & Modell-Auswahl ✅

**Ziel:** Unterstützung mehrerer KI-Anbieter (Anthropic, Google) mit manueller Modellauswahl pro Anfrage.

**Umgesetzt:**
- **Provider-Abstraktion** in `ai_service.py`: `_call_anthropic()` / `_call_google()` / `_call_ai()`
- **Google Gemini** via `google-genai` SDK
  - Modelle: `gemini-2.0-flash`, `gemini-2.0-flash-thinking-exp`, `gemini-1.5-pro`, `gemini-1.5-flash`
- **Anthropic Claude** Modelle: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- **Konfiguration via `.env`**: `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`
- **Per-Request Override**: `?provider=google&model=gemini-2.0-flash`
- **`GET /api/ai/providers`**: verfügbare Provider, Modelle, Konfigurationsstatus
- **`ModelSelector`-Dropdown** im Frontend:
  - Shared-Komponente `components/AI/ModelSelector.jsx`
  - Gruppiert nach Provider (Anthropic / Google)
  - Nur konfigurierte Provider werden angezeigt
  - Vorauswahl = aktueller Backend-Default
  - Integriert in `WeeklyReport` und `AIAnalysis`

**Offene Punkte:**
- Kein Prompt-Caching (Anthropic Prompt Caching API)
- Kein Streaming der KI-Antworten

---

### M8 – Test-Abdeckung (Backend & Frontend) 🔴

**Geplant:**
- Backend Unit-Tests (pytest + pytest-asyncio): Services, Router, Celery-Tasks
- Provider-Mocking für beide KI-Provider
- Frontend-Tests (Vitest + React Testing Library): ModelSelector, Stores
- E2E-Tests (Playwright): Login, Dashboard, Aktivitätsdetail
- CI-Pipeline (GitHub Actions)

**Aufwand:** ~3-4 Sprints

---

### M9 – Performance-Optimierungen & Caching 🔴

**Geplant:**
- Datenbankindizes auf `athlete_id`, `sport_type`, `start_date`
- Redis-Caching für Stats-Endpunkte
- Anthropic Prompt Caching für Systemprompte
- React Query für Server-State-Management
- Frontend Code-Splitting

**Aufwand:** ~2 Sprints

---

### M10 – Erweiterte Statistiken & Vergleiche 🔴

**Geplant:**
- Jahresvergleich, persönliche Bestleistungen
- Trainingszonen-Analyse, CTL/ATL/TSB
- Monatliche Heatmap der Trainingstage

**Aufwand:** ~4-5 Sprints

---

### M11 – Mehrbenutzer-Unterstützung & Rollenmodell 🔴

**Geplant:**
- Benutzer-Isolation, Admin-Rolle
- Rate-Limiting pro Nutzer für KI-Endpunkte
- `MAX_USERS` konfigurierbar

**Aufwand:** ~3 Sprints

---

### M12 – Mobile Optimierung & PWA 🔴

**Geplant:**
- Responsive Überarbeitung, PWA-Manifest + Service Worker
- Dark Mode, Touch-optimierte Karte

**Aufwand:** ~2-3 Sprints

---

### M13 – Export & Daten-Portabilität 🔴

**Geplant:**
- CSV- und GPX-Export, JSON-Backup
- DSGVO-konformer "Konto löschen"-Button

**Aufwand:** ~2 Sprints

---

## Legende

| Symbol | Bedeutung |
|--------|-----------|
| ✅ | Abgeschlossen |
| 🟡 | In Arbeit |
| 🔴 | Offen / Geplant |
| ⏸️ | Pausiert |
