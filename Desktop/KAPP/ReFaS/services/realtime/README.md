# services/realtime

Realtime distributielaag voor websocket-updates en event fan-out.

## Status

- **Actief**
- Draait in docker compose als service `realtime`.

## Quickstart (lokaal)

Vanuit de repo-root:

- Start of herbouw realtime: `docker compose -f docker-compose.dev.yml up -d --build realtime`
- Endpoint: `http://localhost:8003`

## Kernverantwoordelijkheden

- Verwerkt realtime subscriptions per tenant.
- Valideert JWT bij websocket-connecties.
- Publiceert metrics voor websocket- en eventgedrag.

## Runtime

- Container command: `uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload`
- Dependencies: `requirements.txt`
- Codepad: `app/`
- Externe dependency: Redis

## Grenzen

- Geen writes naar `real.*` of `sim.*`.
- Geen businessbeslissingen; alleen realtime transport/distributie.
- Tenant-validatie blijft verplicht op websocket-routes.

## Zie ook

- Root docs: `../../README.md`
- Observability: `../../observability.md`
