# Stranalyser – Offene Fragen & Entscheidungspunkte

Dieses Dokument sammelt offene technische, produktbezogene und architekturelle Fragen, die vor oder während der Implementierung der geplanten Meilensteine geklärt werden müssen.

---

## Kategorie: Infrastruktur & Deployment

### Q1: SSL/HTTPS-Terminierung
**Frage:** Wie soll SSL in der Produktionsumgebung gehandhabt werden?  
**Optionen:**
- A) Nginx im Container übernimmt SSL (Zertifikat via Let's Encrypt / Certbot)
- B) Externer Reverse Proxy (Traefik, Caddy) vor dem Docker-Stack
- C) Nutzer ist selbst verantwortlich (aktueller Stand – nicht empfohlen)  
**Auswirkung:** Sicherheitslevel, Setup-Komplexität  
**Status:** ❓ Offen

---

### Q2: Produktions- vs. Entwicklungs-Frontend
**Frage:** Aktuell läuft das Frontend als Vite-Dev-Server im Container. Soll für Produktionsdeployments ein statischer Build (nginx-served) verwendet werden?  
**Optionen:**
- A) Multi-Stage Dockerfile: `npm run build` + nginx für Produktionsimages
- B) Dev-Server weiterhin nutzen (einfacher, aber langsamer und unsicher)  
**Auswirkung:** Performance, Sicherheit, Build-Komplexität  
**Status:** ❓ Offen

---

### Q3: Automatisches Datenbank-Backup
**Frage:** Soll es eine eingebaute Backup-Strategie für PostgreSQL geben?  
**Optionen:**
- A) Cron-Job im `db`-Container (pg_dump täglich)
- B) Externer Backup-Dienst (Nutzer-Verantwortung)
- C) Volume-Snapshot via Docker-Tooling  
**Auswirkung:** Datensicherheit bei Self-Hosting  
**Status:** ❓ Offen

---

### Q4: CI/CD Pipeline
**Frage:** Soll eine GitHub Actions Pipeline implementiert werden?  
**Benötigt für:** M7 (Tests)  
**Vorschlag:**
```
Push → Lint (ruff, eslint) → Tests (pytest, vitest) → Docker Build → ggf. Push zu Registry
```
**Status:** ❓ Offen – erst nach M7 sinnvoll

---

## Kategorie: Backend & API

### Q5: Strava Webhook vs. Polling
**Frage:** Soll Strava Webhook-Support implementiert werden für Echtzeit-Aktivitäts-Updates?  
**Kontext:** Aktuell werden Aktivitäten alle 5 Minuten gepullt. Strava bietet Webhooks an, die bei neuen/aktualisierten Aktivitäten pushen.  
**Optionen:**
- A) Webhook-Endpoint implementieren (`/api/webhooks/strava`) – Echtzeit, weniger API-Calls
- B) Polling beibehalten – einfacher, keine öffentliche URL nötig  
**Auswirkung:** Aktualität der Daten, Strava-API-Quotas  
**Status:** ❓ Offen

---

### Q6: Rate-Limiting
**Frage:** Soll API-Rate-Limiting implementiert werden?  
**Kontext:** Strava API erlaubt 100 Requests/15min und 1000 Requests/Tag. Ohne Limiting kann ein Nutzer mit vielen Aktivitäten diese Quotas erschöpfen.  
**Optionen:**
- A) `slowapi` (FastAPI Rate Limiter) für `/api/`-Endpunkte
- B) Nginx-Level Rate Limiting
- C) Manuell in sync_service.py (Sleep between pages)  
**Status:** 🟡 Teilweise – sync_service hat kein explizites Throttling

---

### Q7: Session-Persistenz
**Frage:** Sollen Sessions in Redis persistiert werden statt im Speicher?  
**Kontext:** Bei API-Neustart werden alle Sessions ungültig. Nutzer müssen sich neu anmelden.  
**Optionen:**
- A) Starlette SessionMiddleware mit Redis-Backend (z. B. `starlette-session`)
- B) JWT-Tokens statt Server-Sessions  
**Status:** ❓ Offen

---

### Q8: Aktivitäts-Löschung
**Frage:** Was passiert, wenn ein Nutzer eine Aktivität in Strava löscht?  
**Kontext:** Aktuell werden nur neue/aktualisierte Aktivitäten gespeichert. Gelöschte Aktivitäten bleiben in der lokalen DB.  
**Optionen:**
- A) Strava Webhook `activity_delete`-Event verarbeiten (benötigt Q5)
- B) Periodisch alle lokalen IDs gegen Strava abgleichen (teuer)
- C) Manuelle Löschung durch Nutzer in der App  
**Status:** ❓ Offen – aktuell nicht behandelt

---

### Q9: Multi-Sport Statistiken
**Frage:** Wie sollen Sport-Typ-Gruppierungen konfigurierbar gemacht werden?  
**Kontext:** Aktuell ist die Gruppierung (z. B. "Radfahren" = Ride + MountainBikeRide + GravelRide) hart im Code kodiert.  
**Optionen:**
- A) Konfigurationsdatei (YAML/JSON) für Sportgruppen
- B) UI-Einstellung pro Nutzer
- C) Hart kodiert beibehalten (aktueller Stand)  
**Status:** 🟡 Niedrige Priorität, aber technische Schuld

---

## Kategorie: Frontend

### Q10: React Query statt manueller Axios-Calls
**Frage:** Soll React Query (TanStack Query) für Server-State-Management eingeführt werden?  
**Kontext:** Aktuell wird Loading/Error-State manuell in jedem Komponenten-useState verwaltet. Das führt zu Code-Duplizierung.  
**Vorteile:** Automatisches Caching, Background-Refetching, einheitliche Loading-States  
**Aufwand:** ~2 Tage Refactoring  
**Status:** ❓ Geplant für M8

---

### Q11: Internationalisierung (i18n)
**Frage:** Soll die App mehrsprachig werden?  
**Kontext:** App und API sind vollständig auf Deutsch. Bei wachsender Nutzerbasis könnte Englisch relevant werden.  
**Optionen:**
- A) `react-i18next` einführen – vollständig i18n-fähig
- B) Deutsch als einzige Sprache beibehalten (Self-Hosting, hauptsächlich DACH-Nutzer)  
**Status:** ❓ Niedrige Priorität

---

### Q12: Dark Mode
**Frage:** Soll ein Dark Mode unterstützt werden?  
**Kontext:** Tailwind CSS hat eingebaute `dark:` Klassen. Leaflet-Karten benötigen separate Dark-Tiles.  
**Aufwand:** ~1-2 Tage  
**Status:** ❓ Offen – geplant für M11

---

### Q13: Chart-Bibliothek Einheitlichkeit
**Frage:** Sollen alle Charts auf eine einheitliche Bibliothek migriert werden?  
**Kontext:** Aktuell wird Chart.js für Dashboard-Charts verwendet. Für M9 (erweiterte Statistiken) könnte recharts oder Victory eine bessere API bieten.  
**Status:** ❓ Vor M9 entscheiden

---

## Kategorie: KI & Claude API

### Q14: Prompt Caching implementieren
**Frage:** Soll Anthropic Prompt Caching für System-Prompts aktiviert werden?  
**Kontext:** Beide Agenten (Aktivitätsanalyse, Wochenbericht) haben identische System-Prompts. Prompt Caching würde ~80% der Systemkontext-Token-Kosten sparen.  
**Aufwand:** < 1 Tag (API-Parameter hinzufügen)  
**Status:** 🟡 Geplant für M8 – hohe Priorität

---

### Q15: Streaming der KI-Antworten
**Frage:** Sollen KI-Antworten gestreamt werden statt als Block zurückgegeben?  
**Kontext:** Aktuell warten Nutzer 3-8 Sekunden ohne visuelles Feedback bis die KI-Analyse erscheint.  
**Optionen:**
- A) `anthropic.messages.stream()` + Server-Sent Events (SSE) im Frontend
- B) WebSocket-basiertes Streaming
- C) Polling mit Fortschrittsanzeige (einfachste Option)  
**Aufwand:** ~2-3 Tage  
**Status:** ❓ Offen – geplant für M6-Nachbesserung

---

### Q16: KI-Modell-Konfiguration
**Frage:** Sollen Nutzer das verwendete Claude-Modell selbst wählen können?  
**Optionen:**
- A) Feste Konfiguration via `.env` (`CLAUDE_MODEL`)
- B) UI-Einstellung pro Nutzer (Haiku für günstig, Opus für detailliert)
- C) Automatische Auswahl basierend auf Analyse-Typ  
**Status:** ❓ Offen – A ist bereits teilweise implementiert (env var)

---

### Q17: KI-Kosten-Transparenz
**Frage:** Sollen Nutzer ihre KI-Kosten einsehen können?  
**Kontext:** `input_tokens` und `output_tokens` werden bereits pro Analyse gespeichert. Eine einfache Kostenkalkulation wäre möglich.  
**Optionen:**
- A) Einfache Statistikseite: "X Analysen, Y Tokens, ~$Z"
- B) Monatliches Token-Budget mit Warnung
- C) Keine Anzeige (Nutzer trägt selbst die Verantwortung)  
**Status:** ❓ Offen

---

### Q18: Analyse-Invalidierung
**Frage:** Wie soll ein Nutzer eine gecachte KI-Analyse erneuern können?  
**Kontext:** Einmal generierte Analysen werden dauerhaft gecacht. Es gibt keinen "Neu generieren"-Button.  
**Optionen:**
- A) "Neu generieren"-Button löscht alte Analyse und erstellt neue
- B) Analysen haben ein Ablaufdatum (z. B. 30 Tage)
- C) Nur für Wochenberichte relevant (Aktivitätsanalysen ändern sich nicht)  
**Status:** ❓ Offen

---

## Kategorie: Tests & Qualität

### Q19: Test-Strategie
**Frage:** Welcher Test-Ansatz soll verfolgt werden?  
**Kontext:** Aktuell gibt es keine Tests.  
**Empfehlung:** 
- Unit-Tests für Services (Mocking von Strava-Client und Claude-API)
- Integrationstests für Router-Endpunkte (FastAPI TestClient + Test-DB)
- Keine E2E-Tests initial (zu hoher Aufwand für MVP)  
**Status:** ❓ Zu klären vor M7-Start

---

### Q20: Test-Datenbank
**Frage:** Wie wird die Testdatenbank verwaltet?  
**Optionen:**
- A) SQLite für Unit-Tests (kein JSONB-Support → problematisch)
- B) PostgreSQL Testcontainers (produktionsidentisch, aber langsam)
- C) Separate `test`-PostgreSQL-Instanz in docker-compose.test.yml  
**Status:** ❓ Zu klären vor M7-Start

---

## Kategorie: Mehrbenutzer (M10)

### Q21: Maximale Nutzerzahl
**Frage:** Soll die maximale Nutzeranzahl konfigurierbar sein?  
**Kontext:** Für Self-Hosting möchte man evtl. nur eine Handvoll Personen (Familie, Team) erlauben.  
**Optionen:**
- A) `MAX_USERS=5` in `.env` (0 = unlimitiert)
- B) Invite-Only via einmaligem Token
- C) Keine Beschränkung  
**Status:** ❓ Offen

---

### Q22: Admin-Interface
**Frage:** Wird ein Admin-Interface benötigt?  
**Optionen:**
- A) Eigene Admin-Seite im Frontend
- B) FastAPI Admin (Bibliothek)
- C) Direkter Datenbank-Zugriff (kein Interface)  
**Status:** ❓ Offen

---

## Entscheidungs-Log

| Datum | Frage | Entscheidung | Begründung |
|-------|-------|-------------|-----------|
| — | ADR-1: FastAPI | FastAPI gewählt | Async, OpenAPI, Pydantic |
| — | ADR-2: Celery | Celery gewählt | Retry, Scheduling, Skalierung |
| — | ADR-3: PostgreSQL | PostgreSQL gewählt | JSONB, Performance, Produktion |
| — | ADR-4: Zustand | Zustand gewählt | Minimaler Boilerplate |
| — | ADR-5: Axios direkt | Axios ohne React Query | MVP-Entscheidung |

---

## Priorisierung (empfohlen)

**Sofort angehen (vor nächstem Sprint):**
- Q14 – Prompt Caching (hoher ROI, minimaler Aufwand)
- Q6 – Rate-Limiting (Strava-Quota-Schutz)
- Q19 + Q20 – Test-Strategie festlegen

**Mittelfristig (nächste 2-3 Meilensteine):**
- Q1 – SSL-Strategie
- Q5 – Strava Webhooks
- Q10 – React Query Migration
- Q15 – KI-Antwort-Streaming

**Langfristig (M10+):**
- Q11 – i18n
- Q21 – Nutzerbeschränkung
- Q22 – Admin-Interface
