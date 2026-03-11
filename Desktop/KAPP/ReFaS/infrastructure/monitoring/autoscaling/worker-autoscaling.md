# Worker Autoscaling Strategy (Docker Compose Baseline)

Doel: gecontroleerd horizontaal schalen van `worker` replicas op basis van realtime signalen.

## Signal Inputs (Prometheus)
- `publish_rate`: `sum(rate(events_published_total[1m]))`
- `consume_rate`: `sum(rate(events_consumed_total[1m]))`
- `publish_latency_p95`: `histogram_quantile(0.95, sum(rate(event_publish_latency_seconds_bucket[5m])) by (le))`
- `backlog_growth`: `publish_rate - consume_rate`

## Scale-Up Conditions
Scale up als een van deze waar is:
- `backlog_growth > WORKER_SCALE_UP_BACKLOG_THRESHOLD`
- `publish_latency_p95 > WORKER_SCALE_UP_LATENCY_P95_THRESHOLD`

Actie:
- `replicas = min(current + WORKER_SCALE_UP_STEP, WORKER_MAX_REPLICAS)`

## Scale-Down Conditions
Scale down alleen als alle onderstaande waar zijn:
- `publish_rate < WORKER_SCALE_DOWN_PUBLISH_RATE_THRESHOLD`
- `backlog_growth <= WORKER_SCALE_DOWN_BACKLOG_THRESHOLD`
- `publish_latency_p95 < WORKER_SCALE_DOWN_LATENCY_P95_THRESHOLD`

Actie:
- `replicas = max(current - WORKER_SCALE_DOWN_STEP, WORKER_MIN_REPLICAS)`

## Safety Rules
- Min/max bounds afdwingen (`WORKER_MIN_REPLICAS`, `WORKER_MAX_REPLICAS`)
- Cooldown afdwingen tussen scale-acties (`WORKER_SCALE_COOLDOWN_SECONDS`)
- Dry-run default voor evaluatie (`--dry-run`)

## Operaties
1. Start stack en Prometheus.
2. Draai scaler in dry-run om beslislogica te verifiëren.
3. Activeer apply-mode voor echte scaling.
4. Volg Grafana + alerts (`NoEventConsumption`, `BroadcastMismatch`, latency).

## Belangrijke noot
Deze baseline is Compose-gebaseerd en bedoeld voor gecontroleerde groei. Voor productie op Kubernetes vervang je de `docker compose --scale` stap door HPA/KEDA, maar behoud je dezelfde signalen.
