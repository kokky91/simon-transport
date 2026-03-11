# services/api

HTTP API voor auth, validatie en orchestratie van real/sim workflows.

## Status

- **Actief**
- Draait in docker compose als service `api`.

## Quickstart (lokaal)

Vanuit de repo-root:

- Start of herbouw API: `docker compose -f docker-compose.dev.yml up -d --build api`
- API health: `http://localhost:8002/health`
- API metrics: `http://localhost:8002/metrics`

## Kernverantwoordelijkheden

- JWT-validatie en tenantafleiding.
- REST-endpoints voor operationele acties.
- Publicatie/doorgeef van events richting worker en realtime.
- Health- en metrics-endpoints voor observability.
- Persistente modelvergelijking voor plant-AI-generaties (`/plants/{document_id}/generate-compare`).

## Runtime

- Container command: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Dependencies: `requirements.txt`
- Codepad: `app/`

## Grenzen

- Geen zware batch/simulatie in de request-cycle.
- Geen directe frontend-toegang tot database.
- AI-runtime draait in API; prompts/modelcatalogus staan centraal in `../ai/`.
- API-schema is contract-anker voor AI-prefill payloads: `app/schemas/plants_ai.py`.
- Afgeleide velden (zoals ranges/density) worden uitsluitend backend-side berekend.

## RBAC (Plants AI)

- Rollen-hiërarchie: `viewer` < `editor` < `ai_reviewer` < `admin`.
- Enforcement via FastAPI dependency `require_role(...)`.
- `role` staat in JWT claim en wordt server-side gevalideerd.
- `admin` erft alle permissies via de rolhiërarchie.

### RBAC-matrix

| Action | viewer | editor | ai_reviewer | admin |
| --- | --- | --- | --- | --- |
| View document | ✅ | ✅ | ✅ | ✅ |
| Generate compare (`POST /plants/{document_id}/generate-compare`) | ❌ | ✅ | ✅ | ✅ |
| Apply generation (`POST /plants/{document_id}/apply-generation`) | ❌ | ❌ | ✅ | ✅ |
| Upload document (`POST /plants/documents`) | ❌ | ❌ | ✅ | ✅ |

## Admin AI Performance (fase 1)

- Endpoint: `GET /admin/ai/performance`
- RBAC: alleen `admin`
- Tenant-safe: aggregatie wordt altijd gefilterd op `tenant_id` uit JWT
- Query params:
	- `range` (`7d` | `30d` | `90d`, default `30d`)
	- `from` (ISO datetime, optioneel, default = `to - 30 dagen`)
	- `to` (ISO datetime, optioneel, default = `nu`)
	- `prompt_version` (optioneel)
	- `sort` (`avg_score` | `avg_latency_ms` | `win_rate` | `total_runs`, default `win_rate`)
	- `order` (`asc` | `desc`, default `desc`)
- Return per `model_name` + `prompt_version`:
	- `avg_score`
	- `avg_latency_ms`
	- `win_rate` (`is_active=true` / totaal)
	- `total_runs`
- Sortering is backend-gestuurd met secondary ordering op `total_runs DESC` (behalve wanneer primair op `total_runs` wordt gesorteerd).
- Precedence: wanneer zowel `from` als `to` zijn meegegeven, overrulen deze de `range` preset.

## Zie ook

- Root docs: `../../README.md`
- AI assets: `../ai/README.md`
- Realtime service: `../realtime/README.md`
- Worker service: `../worker/README.md`
