# 📚 Documentatie & Architectuur

Zie de volgende bestanden voor het volledige platformoverzicht:

- [ARCHITECTURE.md](ARCHITECTURE.md): platformarchitectuur, lagen, event-flows
- [docs/architecture-diagram.md](docs/architecture-diagram.md): service-diagram
- [docs/architecture.md](docs/architecture.md): overzicht en links
- [docs/ai-pipeline.md](docs/ai-pipeline.md): AI pipeline
- [docs/development.md](docs/development.md): development workflow

Elke feature heeft een eigen README.md in `apps/osagro/src/features/[feature]/README.md` (zie scripts/generate_feature_readme.py).

---
# ReFaS / FarmPlatform

Realtime multi-tenant agro-platform monorepo voor operationele data, simulatie en eventgedreven dashboards.

## Status

- **Actief:** `services/api`, `services/worker`, `services/realtime`, `services/game`, database-migraties, observability-stack, `apps/osagro`.
- **In opbouw / gepland:** `apps/farmsim`, `apps/mobile`, `services/pricing`.
- **AI-positie:** centrale AI-assets in `services/ai`, runtime-calls in `services/api/app/services/ai`.

## Quickstart (lokaal)

1. Maak je env-bestand.
   - PowerShell: `Copy-Item .env.example .env`
2. Start backend + infra.
   - `docker compose -f docker-compose.dev.yml up -d --build`
3. Start frontend.
   - `pnpm install`
   - `pnpm --filter @farmplatform/osagro dev`
4. Controleer kern-healthchecks.
   - `curl.exe -sS --max-time 8 http://localhost:8002/health`
   - `curl.exe -sS --max-time 8 http://localhost:8002/health/ai`

## Vereisten

- Docker + Docker Compose
- Node.js 20+
- `pnpm` via corepack (`pnpm@10.30.3`)
- Python (voor scripts zoals seed/autoscaling)
- Elke feature bevat eigen `route.tsx`, `api.ts`, `store.ts` (zustand), en optioneel `hooks.ts`.
- Centrale state per feature via zustand (`store.ts`), geen losse useState in pages/components.
- API-boundaries: alleen via `features/[feature]/api.ts`, geen directe fetch/axios calls elders.
- UI-componenten in `src/components`, app shell in `src/app`.
- Gedeelde helpers/utilities in `src/lib`.
- Styling: gedeelde tokens in `src/app/styles.css`, class-naming consistent (`os-*`, `infra-*`).

  - `agro-core`, `farmsim-engine` (architectuurgrenzen/documentatie)
  - `ai` (centrale assets), `pricing` (gepland)
- `packages/`
  - `contracts` + shared logic voor type- en domeincontracten
- `database/`
  - migraties en seeds
- `infrastructure/`
  - monitoring, loadtests, deployment-runbooks, terraform

## Belangrijke poorten

- API: `http://localhost:8002`
- Realtime: `http://localhost:8003`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6380`
- Prometheus: `http://localhost:9090`
- Alertmanager: `http://localhost:9093`
- Grafana: `http://localhost:3001`

## Kernarchitectuur

- Frontends praten alleen met de API.
- API doet validatie en orchestratie (geen zware async compute).
- Worker verwerkt queue/achtergrondtaken.
- Realtime vertaalt events naar websocket-updates.
- Simulatie blijft read-only op `real.*` via snapshots.

## Real vs Sim (fase 1)

- Real-truth data: `real.*`
- Sim-sandbox data: `sim.*`
- Event/contract-grenzen:
  - `real.events`
  - `sim.commands`, `sim.results`, `sim.events`
- Simulatie mag `real.*` nooit muteren.
- Huidige flow is split-ready naar een dedicated `sim-runner` zonder contractbreuk.

## AI (huidige inrichting)

- Runtime AI-calls: `services/api/app/services/ai`
- Centrale AI-assets: `services/ai`
  - modelcatalogus: `services/ai/models/model-catalog.json`
  - prompts: `services/ai/prompts/`
- Endpoints:
  - `GET /health/ai` (provider/model/readiness details)
  - `GET /ready/ai` (`200` ready, `503` not ready)

## Monitoring en load

- Metrics endpoints:
  - API: `/metrics`
  - Realtime: `/metrics`
- Prometheus/alerts/dashboards:
  - `infrastructure/monitoring/prometheus/prometheus.yml`
  - `infrastructure/monitoring/prometheus/alert-rules.yml`
  - `infrastructure/monitoring/grafana/provisioning`
  - `infrastructure/monitoring/grafana/dashboards`
- k6 scripts:
  - `infrastructure/docker/loadtest/k6-baseline.js`
  - `infrastructure/docker/loadtest/k6-soak.js`
  - `infrastructure/docker/loadtest/k6-stress.js`
- Extra context: `observability.md`

## Security en tenantcontract

- Write-routes vereisen `Authorization: Bearer <JWT>`.
- Tenantclaim vereist (`tenantId` of `tenant_id`).
- Tenantcontext is server-side leidend (niet clientinput).
- Realtime endpoint: `/ws/{tenant_id}` met JWT-validatie + tenant-match.
- Geen cross-tenant reads/writes.

## Veelgebruikte commando’s

- Backend stack starten: `docker compose -f docker-compose.dev.yml up -d --build`
- Alleen API herstarten: `docker compose -f docker-compose.dev.yml up -d --build api`
- Worker schalen (voorbeeld): `docker compose -f docker-compose.dev.yml up -d --build --scale worker=2 worker`
- Frontend dev: `pnpm --filter @farmplatform/osagro dev`
- Frontend build: `pnpm --filter @farmplatform/osagro build`
- Root lint: `pnpm eslint`
- Architectuurlint: `pnpm lint:architecture`

## Troubleshooting

- API health: `curl.exe -sS --max-time 8 http://localhost:8002/health`
- AI health: `curl.exe -sS --max-time 8 http://localhost:8002/health/ai`
- AI readiness (statuscode): `curl.exe -i --max-time 8 http://localhost:8002/ready/ai`
- Logs:
  - `docker compose -f docker-compose.dev.yml logs -f api`
  - `docker compose -f docker-compose.dev.yml logs -f worker`
  - `docker compose -f docker-compose.dev.yml logs -f realtime`
- AI smoke (optioneel): `python scripts/test_ai_client.py --allow-unreachable`

## QA, DR en seed

- Observability/security smoke: `observability.md`
- DR scripts:
  - `scripts/backup_postgres.sh`
  - `scripts/restore_postgres.sh`
  - `scripts/dr_smoke_test.sh`
- Tenant-aware dev seed:
  - `python scripts/seed_dev.py --jwt "<BearerToken>" --database-url "postgresql://postgres:postgres@localhost:5432/farmplatform"`

## 🌱 PlantIntakeForm.tsx is leidend voor plantinvoer

Dit bestand ([apps/osagro/src/features/plants/PlantIntakeForm.tsx](apps/osagro/src/features/plants/PlantIntakeForm.tsx)) is de enige bron voor alle logica, types en UI rondom plantinvoer. Gebruik dit als referentie voor:
- API-integratie voor opslaan van plantdata
- Aanpassingen of uitbreidingen van formulierlogica
- Synchronisatie van types met backend/componenten
- Gebruik in andere pagina’s of flows

Alle toekomstige wijzigingen en uitbreidingen moeten hierop gebaseerd worden.
