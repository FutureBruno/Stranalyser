# Stranalyser

Lokale Strava-Aktivitäten-App mit Web-UI, KI-Analyse und Multi-Provider-Unterstützung. Läuft vollständig in Docker.

## Features

- Strava OAuth2-Login
- Vollständige Synchronisation aller historischen Aktivitäten
- Automatischer Sync alle 5 Minuten (Celery Beat)
- Aktivitätsliste mit Filter nach Sportart und Zeitraum
- Detailseite mit:
  - Leaflet-Karte (OpenStreetMap) mit GPS-Route
  - Charts für Höhenprofil, Herzfrequenz, Leistung, Kadenz
- Dashboard mit Statistiken und wöchentlichem Distanz-Chart
- **KI-Analyse** (Aktivität & Wochenbericht) via Anthropic Claude oder Google Gemini
- **Modell-Auswahl** per Dropdown vor jeder KI-Anfrage
- Läuft vollständig lokal (kein Cloud-Dienst außer Strava-API und KI-API)

## Setup

### 1. Strava-App erstellen

Gehe zu https://www.strava.com/settings/api und erstelle eine neue App:
- **App Name**: Stranalyser (beliebig)
- **Website**: http://localhost
- **Authorization Callback Domain**: `localhost` oder deine LAN-IP

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

`.env` ausfüllen:

```env
# Strava
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=abc123
STRAVA_REDIRECT_URI=http://localhost:8080/api/auth/callback

# Datenbank
DB_PASSWORD=mein_sicheres_passwort
SECRET_KEY=zufälliger_langer_string

# KI-Analyse (mindestens einen Key setzen)
AI_PROVIDER=anthropic          # oder: google
AI_MODEL=claude-sonnet-4-6     # oder z. B.: gemini-2.0-flash

ANTHROPIC_API_KEY=sk-ant-...   # https://console.anthropic.com/settings/keys
GOOGLE_API_KEY=AIza...         # https://aistudio.google.com/app/apikey
```

**Für LAN-Zugriff:**
```env
STRAVA_REDIRECT_URI=http://192.168.1.100:8080/api/auth/callback
```

### 3. Starten

**Entwicklung** (kein nginx, hot-reload, direkte Ports):
```bash
docker compose up --build
```
- Frontend: http://localhost:5173
- API:      http://localhost:8000

**Produktion** (mit nginx als Reverse Proxy):
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```
- App: http://localhost:8080

---

## KI-Modell auswählen

Das aktive KI-Modell wird in `.env` konfiguriert. Im Frontend kann das Modell vor jeder Analyse per Dropdown gewechselt werden – ohne Neustart.

**Anthropic Claude:**
| Modell | Stärke | Geschwindigkeit |
|--------|--------|----------------|
| `claude-opus-4-7` | Höchste Qualität | Langsam |
| `claude-sonnet-4-6` | Ausgewogen (Standard) | Mittel |
| `claude-haiku-4-5-20251001` | Günstig | Schnell |

**Google Gemini:**
| Modell | Stärke | Geschwindigkeit |
|--------|--------|----------------|
| `gemini-2.0-flash` | Günstig, schnell | Sehr schnell |
| `gemini-2.0-flash-thinking-exp` | Reasoning | Mittel |
| `gemini-1.5-pro` | Hohe Qualität | Mittel |
| `gemini-1.5-flash` | Günstig | Schnell |

---

## Architektur

```
nginx (Port 8080, nur Prod)
  ├── /     → frontend (React + Vite)
  └── /api  → api (FastAPI)
                ├── db (PostgreSQL)
                └── redis → worker (Celery + Beat)
```

## Services

| Service  | Dev-Port | Prod-Port | Beschreibung |
|----------|----------|-----------|--------------|
| nginx    | –        | 8080      | Reverse Proxy (nur Prod) |
| api      | 8000     | intern    | FastAPI Backend |
| frontend | 5173     | intern    | React SPA |
| db       | –        | –         | PostgreSQL |
| redis    | –        | –         | Celery Broker |
| worker   | –        | –         | Sync-Tasks (Celery + Beat) |

## Dokumentation

| Datei | Inhalt |
|-------|--------|
| `ROADMAP.md` | Implementierungsplan mit Meilenstein-Status |
| `AGENTS.md` | KI-Agent-Definitionen und Provider-Konfiguration |
| `architecture.md` | Systemarchitektur, Datenmodell, ADRs |
| `QUESTIONS.md` | Offene technische Fragen und Entscheidungslog |
