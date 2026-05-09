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
| M7 | Test-Abdeckung (Backend & Frontend) | 🔴 Offen |
| M8 | Performance-Optimierungen & Caching | 🟡 In Arbeit |
| M9 | Erweiterte Statistiken & Vergleiche | 🔴 Offen |
| M10 | Mehrbenutzer-Unterstützung & Rollenmodell | 🔴 Offen |
| M11 | Mobile Optimierung & PWA | 🔴 Offen |
| M12 | Export & Daten-Portabilität | 🔴 Offen |

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
- Bridge-Netzwerk `stranalyser_net` für Container-Isolation

**Offene Punkte:**
- CI/CD-Pipeline (GitHub Actions) fehlt noch
- Kein automatisiertes Backup der PostgreSQL-Datenbank

---

### M2 – Strava OAuth & Datensynchronisation ✅

**Ziel:** Sichere Authentifizierung via Strava OAuth2 und vollautomatische Synchronisation aller Aktivitäten.

**Umgesetzt:**
- Strava OAuth2-Flow (`/api/auth/login` → Callback → Session)
- Automatische Token-Erneuerung bei Ablauf (refresh_token)
- Vollständige Erstsynchronisation aller historischen Aktivitäten nach Login
- Inkrementelle Synchronisation alle 5 Minuten via Celery Beat
- Manuelle Synchronisation via `POST /api/sync/trigger`
- Sync-Status und Fortschritt via `GET /api/sync/status`
- `sync_state`-Tabelle zur Verfolgung von letztem Sync und Fehlerzuständen
- Aktivitäts-Streams (GPS, Herzfrequenz, Leistung, Kadenz, Höhe) werden lazy beim ersten Abruf geladen

**Offene Punkte:**
- Strava Webhook-Integration für Echtzeit-Push-Updates (aktuell nur Pull)
- Fehler-Retry-Logik für fehlgeschlagene Stream-Fetches ausbaubar

---

### M3 – Backend API & Datenmodelle ✅

**Ziel:** Vollständige REST API mit typisierten Datenmodellen für alle Kern-Entitäten.

**Umgesetzt:**
- FastAPI mit async/await throughout
- SQLAlchemy 2.0 (async) mit PostgreSQL via asyncpg
- Datenmodelle: `Athlete`, `Activity`, `ActivityStream`, `SyncState`, `AIAnalysis`
- JSONB-Felder für rohe Strava-Daten und Stream-Daten
- API-Routen: Auth, Activities, Stats, Sync, AI, Health
- Paginierung bei Aktivitätslisten
- Filter: Sporttyp, Datumsbereich
- Aggregierte Statistiken (Übersicht, Wochenansicht)
- CORS-Konfiguration für Frontend-Integration

**Offene Punkte:**
- Keine API-Dokumentation (OpenAPI/Swagger ist verfügbar, aber nicht angepasst)
- Rate-Limiting fehlt
- Keine Input-Validierung-Schemas für alle Endpunkte

---

### M4 – Frontend – Dashboard & Aktivitätsliste ✅

**Ziel:** Responsives React-SPA mit Dashboard-Überblick und filterbarer Aktivitätsliste.

**Umgesetzt:**
- React 18 + Vite + Tailwind CSS
- React Router DOM mit geschützten Routen
- Zustand für globales Auth-State-Management
- Dashboard: Übersichts-Stats-Cards, Wochenchart (Chart.js), KI-Wochenbericht
- Aktivitätsliste: Paginierung, Filterbar (Sporttyp, Zeitraum)
- Aktivitätskarten mit Sporttyp-Icons, Distanz, Dauer, Höhenmeter
- Sport-Typ-Gruppierung (z. B. "Radfahren" = Ride + MountainBikeRide + GravelRide)
- Responsive Layout mit Header-Navigation
- Login-Seite mit Strava-OAuth-Button

**Offene Punkte:**
- Keine Dark-Mode-Unterstützung
- Keine Sortierung der Aktivitätsliste nach verschiedenen Kriterien
- Keine Suchfunktion für Aktivitätsnamen

---

### M5 – Aktivitätsdetail – Karte, Charts & Streams ✅

**Ziel:** Detailansicht jeder Aktivität mit interaktiver Karte und datenreichen Charts.

**Umgesetzt:**
- Leaflet-Karte mit Polyline-Visualisierung der Route
- Höhenprofil-Chart (Chart.js) mit GPS-Höhendaten
- Herzfrequenz-Chart mit Zeitreihen-Daten
- Leistungs-Chart (Watt) für Radaktivitäten
- Kadenz-Chart
- Aktivitäts-Kennzahlen: Distanz, Dauer, Durchschnittsgeschwindigkeit, Höhenmeter, Ø-HR, Ø-Watt
- Streams werden beim ersten Aufruf asynchron geladen (Celery Task)
- KI-Analyse-Sektion in der Detailansicht

**Offene Punkte:**
- Keine Segmentanzeige (Strava-Segmente)
- Keine Vergleichsfunktion mit ähnlichen Aktivitäten
- Keine Lap-Übersicht

---

### M6 – KI-Analyse (Claude API) ✅

**Ziel:** Automatische KI-gestützte Analyse von Aktivitäten und Wochenberichte via Claude API.

**Umgesetzt:**
- Anthropic Python SDK Integration
- Wochenbericht: Zusammenfassung aller Aktivitäten einer Woche mit Trainingsempfehlungen
- Aktivitätsanalyse: Detaillierte Bewertung einer einzelnen Aktivität (Intensität, Leistung, Empfehlungen)
- Ergebnis-Caching in `ai_analyses`-Tabelle (verhindert doppelte API-Kosten)
- Token-Tracking pro Analyse (input_tokens, output_tokens, model)
- `analysis_type`-Unterscheidung: `weekly_report` vs. `activity_analysis`
- Wochenschlüssel-System (`2026-W18`) für konsistente Wochenberichte
- API-Endpunkte für Generate (POST) und Abruf (GET) von Analysen

**Offene Punkte:**
- Kein Prompt-Caching (Anthropic Prompt Caching API) implementiert → höhere Kosten
- Kein Streaming der KI-Antworten (aktuell blocking)
- Keine Nutzerkontrolle über KI-Modellauswahl
- Keine Kostenanzeige für den Nutzer
- Kein Mechanismus zum Invalidieren/Neu-Generieren eines zwischengespeicherten Berichts

---

### M7 – Test-Abdeckung (Backend & Frontend) 🔴

**Ziel:** Mindestens 80 % Code-Coverage für kritische Pfade; CI-gestützte Qualitätssicherung.

**Geplant:**
- **Backend Unit-Tests** (pytest + pytest-asyncio):
  - `sync_service.py`: Upsert-Logik, Token-Refresh, inkrementelle Sync
  - `ai_service.py`: Prompt-Aufbau, Caching-Logik, Fehlerbehandlung
  - `strava_client.py`: HTTP-Mocking (httpx), OAuth-Flow
  - Alle Router-Endpunkte mit FastAPI `TestClient`
- **Backend Integrationstests:**
  - Datenbank-Tests mit `pytest-postgresql` oder Docker Testcontainers
  - Celery-Task-Tests mit `celery.contrib.pytest`
- **Frontend Unit-Tests** (Vitest + React Testing Library):
  - Store-Tests (authStore)
  - Komponenten-Tests für Dashboard, ActivityCard, FilterBar
  - API-Client-Mocking
- **E2E-Tests** (Playwright oder Cypress):
  - Login-Flow
  - Dashboard-Anzeige
  - Aktivitätsdetail-Navigation
- **CI-Pipeline** (GitHub Actions):
  - Lint → Tests → Build bei jedem Push
  - Coverage-Report als PR-Kommentar

**Aufwand:** ~3-4 Sprints

---

### M8 – Performance-Optimierungen & Caching 🟡

**Ziel:** Ladezeiten < 200 ms für alle Dashboard-Anfragen; skalierbare Stream-Verarbeitung.

**Geplant:**
- **Datenbankindizes** auf häufig gefilterten Feldern (`athlete_id`, `sport_type`, `start_date`)
- **Query-Optimierung:** N+1-Probleme in Aktivitätslisten beheben
- **Redis-Caching** für Stats-Endpunkte (`/api/stats/overview`, `/api/stats/weekly`)
- **Anthropic Prompt Caching** für KI-Systemprompte implementieren
- **Frontend-Code-Splitting** (React.lazy) für Dashboard- vs. Detail-Seiten
- **Bild-Optimierung:** Athlete-Profilbilder cachen
- **Celery-Concurrency** konfigurieren für parallele Stream-Fetches
- **Connection-Pooling** für PostgreSQL tunen (asyncpg pool_size)

**Aufwand:** ~2 Sprints

---

### M9 – Erweiterte Statistiken & Vergleiche 🔴

**Ziel:** Tiefere Auswertungsmöglichkeiten über Zeiträume, Sportarten und persönliche Bestleistungen.

**Geplant:**
- Jahresvergleich: Dieses Jahr vs. Vorjahr (Distanz, Stunden, Höhenmeter)
- Persönliche Bestleistungen (PRs) nach Distanz und Sportart
- Trainingszonen-Analyse basierend auf Herzfrequenz
- CTL/ATL/TSB (Trainingsbelastung/Form) Berechnung und Verlaufsgraph
- Monatliche Heatmap der Trainingstage
- Sport-spezifische Seiten (z. B. nur Radfahren)
- Streckenrekorde auf bekannten Routen (via Polyline-Ähnlichkeit)

**Aufwand:** ~4-5 Sprints

---

### M10 – Mehrbenutzer-Unterstützung & Rollenmodell 🔴

**Ziel:** Mehrere Strava-Accounts in einer Instanz verwalten; optionaler Familien-/Team-Modus.

**Geplant:**
- Benutzer-Isolation: Alle Daten strikt nach `athlete_id` getrennt
- Admin-Rolle: Kann alle Nutzer und Sync-Status einsehen
- Einladungslink für neue Nutzer (optional, für geschlossene Gruppen)
- Rate-Limiting pro Nutzer für KI-Endpunkte
- Konfigurierbare maximale Nutzeranzahl (für Self-Hosting)
- Audit-Log für KI-Kosten pro Nutzer

**Aufwand:** ~3 Sprints

---

### M11 – Mobile Optimierung & PWA 🔴

**Ziel:** Vollständig nutzbare App auf Smartphones; installierbar als Progressive Web App.

**Geplant:**
- Responsive Überarbeitung aller Seiten (Breakpoints testen)
- PWA-Manifest + Service Worker (Offline-Caching von Dashboard-Daten)
- Touch-optimierte Karten-Interaktion (Leaflet mobile events)
- Bottom-Navigation statt Header für mobile Nutzung
- App-Icon und Splash-Screen
- Push-Benachrichtigungen bei abgeschlossener Synchronisation (optional)

**Aufwand:** ~2-3 Sprints

---

### M12 – Export & Daten-Portabilität 🔴

**Ziel:** Vollständiger Datenexport für eigene Weiterverarbeitung; Unabhängigkeit von Strava.

**Geplant:**
- CSV-Export aller Aktivitäten mit allen Metriken
- GPX-Export einzelner Aktivitäten (aus GPS-Streams)
- JSON-Export der gesamten Datenbank (Backup)
- Fitness-App-Import (z. B. Garmin Connect, Wahoo)
- Automatisierter wöchentlicher Export via E-Mail (optional)
- DSGVO-konformer "Konto löschen"-Button mit vollständiger Datenlöschung

**Aufwand:** ~2 Sprints

---

## Legende

| Symbol | Bedeutung |
|--------|-----------|
| ✅ | Abgeschlossen |
| 🟡 | In Arbeit / Teilweise umgesetzt |
| 🔴 | Offen / Geplant |
| ⏸️ | Pausiert / Zurückgestellt |
