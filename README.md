# Stranalyser

Lokale Strava-Aktivitäten-App mit Web-UI, KI-Analyse und Multi-Provider-Unterstützung. Läuft vollständig in Docker.

## Features

- Strava OAuth2-Login
- Vollständige Synchronisation aller historischen Aktivitäten
- Automatischer Sync alle 5 Minuten (Celery Beat)
- Aktivitätsliste mit Filter nach Sportart und Zeitraum
- Detailseite mit Leaflet-Karte, Höhenprofil, Herzfrequenz, Leistungs- und Kadenz-Charts
- Dashboard mit Statistiken und wöchentlichem Distanz-Chart
- **KI-Analyse** (Aktivität & Wochenbericht) via Anthropic Claude oder Google Gemini
- **Modell-Auswahl** per Dropdown vor jeder KI-Anfrage
- Läuft vollständig lokal (kein Cloud-Dienst außer Strava-API und KI-API)

## Setup

### 1. Strava-App erstellen

Gehe zu https://www.strava.com/settings/api und erstelle eine neue App:
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
AI_MODEL=claude-sonnet-4-6     # oder: gemini-2.0-flash

ANTHROPIC_API_KEY=sk-ant-...   # https://console.anthropic.com/settings/keys
GOOGLE_API_KEY=AIza...         # https://aistudio.google.com/app/apikey
```

**Für LAN-Zugriff:**
```env
STRAVA_REDIRECT_URI=http://192.168.1.100:8080/api/auth/callback
```

### 3. Starten

```bash
docker compose up --build
```

Öffne http://localhost:8080

---

## KI-Modell auswählen

Das aktive Modell wird in `.env` konfiguriert. Im Frontend kann das Modell vor jeder Analyse per Dropdown gewechselt werden – ohne Neustart.

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
nginx (Port 8080)
  ├── /     → frontend (React + Vite)
  └── /api  → api (FastAPI)
                ├── db (PostgreSQL)
                └── redis → worker (Celery + Beat)
```

## Services

| Service  | Port (intern) | Beschreibung |
|----------|--------------|---------------|
| nginx    | 8080 (Host)  | Reverse Proxy |
| api      | 8000         | FastAPI Backend |
| frontend | 3000         | React SPA |
| db       | 5432         | PostgreSQL |
| redis    | 6379         | Celery Broker |
| worker   | –            | Sync-Tasks (Celery + Beat) |

## Dokumentation

| Datei | Inhalt |
|-------|--------|
| `ROADMAP.md` | Implementierungsplan mit Meilenstein-Status |
| `AGENTS.md` | KI-Agent-Definitionen und Provider-Konfiguration |
| `architecture.md` | Systemarchitektur, Datenmodell, ADRs |
| `QUESTIONS.md` | Offene technische Fragen und Entscheidungslog |
