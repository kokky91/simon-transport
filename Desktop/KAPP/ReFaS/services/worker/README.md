# services/worker

Asynchrone worker voor queue-verwerking en achtergrondtaken.

## Status

- **Actief**
- Draait in docker compose als service `worker`.

## Quickstart (lokaal)

Vanuit de repo-root:

- Start of herbouw worker: `docker compose -f docker-compose.dev.yml up -d --build worker`
- Schalen (voorbeeld): `docker compose -f docker-compose.dev.yml up -d --build --scale worker=2 worker`

## Kernverantwoordelijkheden

- Verwerkt achtergrondtaken buiten de API request-cycle.
- Consumeert queue/events en voert joblogica uit.
- Publiceert operationele metrics.

## Runtime

- Container command: `python app/main.py`
- Dependencies: `requirements.txt`
- Codepad: `app/`
- Externe afhankelijkheden: Redis en PostgreSQL

## Grenzen

- Geen directe frontendkoppeling.
- Geen ownership van API-authflow.
- Respecteert tenant-isolatie en domeincontracten.

## Zie ook

- Root docs: `../../README.md`
- Autoscaling baseline: `../../infrastructure/monitoring/autoscaling/worker-autoscaling.md`
