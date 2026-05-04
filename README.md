# Stranalyser

Lokale Strava-Aktivitäten-App mit Web-UI, die vollständig in Docker läuft.

## Features

- Strava OAuth2-Login
- Vollständige Synchronisation aller historischen Aktivitäten
- Automatischer Sync alle 30 Minuten (Celery Beat)
- Aktivitätsliste mit Filter nach Sportart
- Detailseite mit:
  - Leaflet-Karte (OpenStreetMap) mit GPS-Route
  - Charts für Höhenprofil, Puls, Tempo, Kadenz
- Dashboard mit Statistiken und wöchentlichem Distanz-Chart
- Läuft vollständig lokal (kein Cloud-Dienst außer Strava-API)

## Setup

### 1. Strava-App erstellen

Gehe zu https://www.strava.com/settings/api und erstelle eine neue App:
- **App Name**: Stranalyser (beliebig)
- **Website**: http://localhost
- **Authorization Callback Domain**: `localhost` oder deine LAN-IP (z.B. `192.168.1.100`)

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

`.env` bearbeiten:
```env
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=abc123
STRAVA_REDIRECT_URI=http://localhost:8080/api/auth/callback

DB_PASSWORD=mein_sicheres_passwort
SECRET_KEY=zufälliger_langer_string
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

## Architektur

```
nginx (Port 8080)
  ├── /     → frontend (React + nginx)
  └── /api  → api (FastAPI)
                └── db (PostgreSQL)
                └── redis → worker (Celery)
```

## Services

| Service  | Port (intern) | Beschreibung                |
|----------|--------------|----------------------------|
| nginx    | 8080 (Host)  | Reverse Proxy              |
| api      | 8000         | FastAPI Backend             |
| frontend | 80           | React SPA                  |
| db       | 5432         | PostgreSQL                 |
| redis    | 6379         | Celery Broker              |
| worker   | –            | Sync-Tasks (Celery + Beat) |
