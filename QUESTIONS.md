# Stranalyser – Offene Fragen & Entscheidungspunkte

---

## Infrastruktur & Deployment

### Q1: SSL/HTTPS-Terminierung
**Optionen:** A) Nginx + Certbot, B) Traefik/Caddy, C) Nutzer-Verantwortung (aktuell)  
**Status:** ❓ Offen

### Q2: Produktions-Frontend
**Frage:** Multi-Stage Dockerfile mit `npm run build` + nginx statt Vite-Dev-Server?  
**Status:** ❓ Offen

### Q3: Datenbank-Backup
**Optionen:** A) pg_dump Cron-Job, B) Nutzer-Verantwortung  
**Status:** ❓ Offen

### Q4: CI/CD Pipeline
**Vorschlag:** GitHub Actions – Lint → Tests → Docker Build  
**Status:** ❓ Offen – erst nach M8 sinnvoll

---

## Backend & API

### Q5: Strava Webhook vs. Polling
**Frage:** Echtzeit-Updates via Strava Webhook statt 5-Minuten-Polling?  
**Status:** ❓ Offen

### Q6: Rate-Limiting
**Frage:** `slowapi` oder Nginx-Level für Strava-Quota-Schutz?  
**Status:** ❓ Offen – hohe Priorität

### Q7: Session-Persistenz
**Frage:** Sessions in Redis statt Speicher (überleben API-Neustart)?  
**Status:** ❓ Offen

### Q8: Aktivitäts-Löschung
**Kontext:** Gelöschte Strava-Aktivitäten bleiben aktuell in der lokalen DB.  
**Status:** ❓ Offen – benötigt Q5 (Webhooks)

### Q9: Sport-Typ-Gruppierungen
**Frage:** Konfigurierbar statt hart kodiert?  
**Status:** 🟡 Niedrige Priorität

---

## Frontend

### Q10: React Query
**Frage:** TanStack Query für einheitliche Loading-States und Caching einführen?  
**Aufwand:** ~2 Tage  
**Status:** ❓ Geplant für M9

### Q11: Internationalisierung (i18n)
**Status:** ❓ Niedrige Priorität

### Q12: Dark Mode
**Kontext:** Tailwind `dark:` Klassen; Leaflet benötigt separate Dark-Tiles.  
**Status:** ❓ Geplant für M12

### Q13: Chart-Bibliothek
**Frage:** Alle Charts auf eine Bibliothek migrieren?  
**Status:** ❓ Vor M10 entscheiden

---

## KI & Provider

### Q14: Prompt Caching (Anthropic)
**Frage:** Anthropic Prompt Caching für Systemprompte aktivieren? ~80% Einsparung.  
**Aufwand:** < 1 Tag  
**Status:** 🔴 Offen – hohe Priorität für M9

### Q15: Streaming der KI-Antworten
**Frage:** SSE-Streaming statt blocking? Besseres UX (3-8s Wartezeit).  
**Status:** ❓ Offen

### Q16: KI-Modell-Konfiguration ✅ Gelöst
**Lösung (M7):**
- `.env`: `AI_PROVIDER` + `AI_MODEL` für Default
- Frontend: `ModelSelector`-Dropdown vor jeder Anfrage
- API: `?model=...&provider=...` Query-Parameter
**Status:** ✅ Abgeschlossen (2026-05-09)

### Q17: KI-Kosten-Transparenz
**Frage:** Kostenanzeige für Nutzer? Tokens werden bereits gespeichert.  
**Status:** ❓ Offen

### Q18: Analyse-Invalidierung
**Kontext:** `force_refresh=true` implementiert; UI-Button für Wochenberichte fehlt noch.  
**Status:** 🟡 Teilweise

### Q19: Weitere KI-Provider
**Frage:** OpenAI, Mistral, Ollama (lokal) unterstützen?  
**Kontext:** Provider-Abstraktion in `ai_service.py` macht Erweiterung einfach.  
**Status:** ❓ Bei Bedarf

---

## Tests & Qualität

### Q20: Test-Strategie
**Empfehlung:** Unit-Tests (Services mit Provider-Mocking) + Integrationstests (Router + Test-DB)  
**Status:** ❓ Vor M8 klären

### Q21: Test-Datenbank
**Optionen:** A) SQLite (kein JSONB), B) PostgreSQL Testcontainers, C) docker-compose.test.yml  
**Status:** ❓ Vor M8 klären

---

## Mehrbenutzer (M11)

### Q22: Maximale Nutzerzahl
**Optionen:** A) `MAX_USERS=5` in `.env`, B) Invite-Only Token  
**Status:** ❓ Offen

### Q23: Admin-Interface
**Status:** ❓ Offen

---

## Entscheidungs-Log

| Datum | Entscheidung | Begründung |
|-------|-------------|------------|
| — | FastAPI | Async, OpenAPI, Pydantic |
| — | Celery | Retry, Scheduling, Skalierung |
| — | PostgreSQL | JSONB, Performance |
| — | Zustand | Minimaler Boilerplate |
| — | Axios direkt | MVP-Entscheidung |
| 2026-05-09 | ModelSelector Dropdown + Query-Params (Q16) | Alpha/Beta-Testing ohne Neustart |
| 2026-05-09 | Provider-Abstraktion in ai_service.py | Erweiterbar, minimal invasiv |

---

## Priorisierung

**Sofort:** Q14 (Prompt Caching), Q6 (Rate-Limiting), Q20+Q21 (Test-Strategie)  
**Mittelfristig:** Q1 (SSL), Q5 (Webhooks), Q10 (React Query), Q15 (Streaming)  
**Langfristig:** Q11 (i18n), Q19 (weitere Provider), Q22+Q23 (Mehrbenutzer)
