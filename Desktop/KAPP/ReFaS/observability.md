# Observability Smoke Tests

Doel: snelle QA-verificatie voor trace-correlation, tenant-isolation en event-validatie.

## Abuse protection knobs

- API write rate limit per tenant+client: `RATE_LIMIT_API_WRITE_PER_MINUTE` (default `120`).
- WebSocket handshake rate limit per tenant+client: `WS_HANDSHAKE_RATE_LIMIT_PER_MINUTE` (default `120`).
- WebSocket max gelijktijdige connecties per tenant: `WS_MAX_CONNECTIONS_PER_TENANT` (default `200`).

Bij overschrijding:
- API endpoint retourneert `429` met `Retry-After` header.
- WebSocket handshake wordt geweigerd met policy close (`1008`).

Belangrijke metrics/alerts:
- `api_rate_limit_rejections_total`
- `ws_rate_limit_rejections_total`
- Alerts: `ApiRateLimitRejectionSpike`, `WebSocketRateLimitRejectionSpike`

## Voorwaarden
- Stack draait via docker compose.
- API bereikbaar op http://localhost:8002.
- Realtime bereikbaar op http://localhost:8003.

## 1) API health
PowerShell:

Invoke-WebRequest -UseBasicParsing http://localhost:8002/health | Select-Object -ExpandProperty Content

Verwacht: status ok.

## 2) JWT maken voor tenant-1
PowerShell:

$token = docker compose -f docker-compose.dev.yml exec -T api python -c "import jwt; print(jwt.encode({'tenantId':'tenant-1'}, 'supersecretkey', algorithm='HS256'))"
$headers = @{ Authorization = "Bearer $token" }

## 3) Trace propagation (request header -> response header -> event)
PowerShell:

$traceId = "trace-smoke-001"
$headers = @{ Authorization = "Bearer $token"; "X-Trace-Id" = $traceId }
$resp = Invoke-WebRequest -UseBasicParsing -Method Post -Headers $headers -Uri "http://localhost:8002/market/price-update?crop_id=corn&new_price=111.1"
$resp.Headers["X-Trace-Id"]
$resp.Content

Verwacht:
- Response header X-Trace-Id is trace-smoke-001.
- Event payload bevat traceId met dezelfde waarde.

## 4) Auth enforcement (zonder JWT)
PowerShell:

try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://localhost:8002/market/price-update?crop_id=corn&new_price=111.1"
} catch {
  $_.Exception.Response.StatusCode.value__
  $_.ErrorDetails.Message
}

Verwacht: 401.

## 5) Invalid event rejection (dev endpoint)
PowerShell:

$invalid = @{
  type = "UNKNOWN_EVENT"
  version = 1
  timestamp = "2026-03-02T00:00:00Z"
  traceId = "trace-smoke-invalid"
  tenantId = "tenant-1"
  payload = @{}
} | ConvertTo-Json -Compress

try {
  Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://localhost:8002/dev/publish-event" -ContentType "application/json" -Body $invalid
} catch {
  $_.Exception.Response.StatusCode.value__
  $_.ErrorDetails.Message
}

Verwacht: 400 Unsupported event type.

## 6) WebSocket tenant mismatch block
PowerShell:

@'
import asyncio
import jwt
import websockets

token = jwt.encode({'tenantId': 'tenant-1'}, 'supersecretkey', algorithm='HS256')
url = f"ws://localhost:8003/ws/tenant-2?token={token}"

async def test():
    try:
        async with websockets.connect(url):
            print('UNEXPECTED_CONNECTED')
    except Exception as exc:
        print(type(exc).__name__)

asyncio.run(test())
'@ | docker compose -f docker-compose.dev.yml exec -T realtime python -

Verwacht: connectie wordt geweigerd (bijv. InvalidStatus).

## 7) JSON logs met contextvelden
PowerShell:

docker compose -f docker-compose.dev.yml logs api --tail 30
docker compose -f docker-compose.dev.yml logs realtime --tail 30
docker compose -f docker-compose.dev.yml logs worker --tail 30

Verwacht in JSON logregels:
- traceId
- tenantId
- eventType
- service
- message
- levelname

## 8) Load test baseline (k6)

### Lokaal draaien (PowerShell)

1. JWT genereren voor loadtest-tenant:

$token = docker compose -f docker-compose.dev.yml exec -T api python -c "import jwt; print(jwt.encode({'tenantId':'tenant-loadtest'}, 'supersecretkey', algorithm='HS256'))"

2. k6 baseline draaien via Docker:

docker run --rm --network host `
  -e BASE_URL=http://localhost:8002 `
  -e AUTH_TOKEN=$token `
  -e TEST_TENANT_ID=tenant-loadtest `
  -v "${PWD}/infrastructure/loadtest:/scripts" `
  grafana/k6 run /scripts/k6-baseline.js

### CI baseline

- Handmatig triggerbare workflow: `.github/workflows/loadtest-baseline.yml`
- Workflow doet: compose up -> health wait -> JWT generation -> k6 run -> always teardown.

## 9) Soak profile (stabiliteit)

- Script: `infrastructure/loadtest/k6-soak.js`
- Doel: stabiliteit onder constante load (latency drift, consume-progress, WS metric gezondheid, NoEventConsumption-alert check).
- Standaardprofiel: `15` VUs voor `15m`.

### Lokaal draaien (PowerShell)

$token = docker compose -f docker-compose.dev.yml exec -T api python -c "import jwt; print(jwt.encode({'tenantId':'tenant-soak'}, 'supersecretkey', algorithm='HS256'))"

docker run --rm --network host `
  -e BASE_URL=http://localhost:8002 `
  -e REALTIME_METRICS_URL=http://localhost:8003/metrics/ `
  -e PROM_URL=http://localhost:9090 `
  -e AUTH_TOKEN=$token `
  -e TEST_TENANT_ID=tenant-soak `
  -e K6_VUS=15 `
  -e K6_DURATION=15m `
  -v "${PWD}/infrastructure/loadtest:/scripts" `
  grafana/k6 run /scripts/k6-soak.js

### CI soak

- Handmatige workflow: `.github/workflows/loadtest-soak.yml`
- Inputs: `duration`, `vus`.
- Advies: niet op elke PR draaien; gebruik bij release-kandidaten en performance-investigaties.

## 10) Stress profile (controlled saturation)

- Script: `infrastructure/loadtest/k6-stress.js`
- Doel: breekpunt vinden met gecontroleerde ramp-up i.p.v. brute-force chaos.
- Default stages: `50 -> 100 -> 200 -> 300` VUs met `2m` per stage.

### Lokaal draaien (PowerShell)

$token = docker compose -f docker-compose.dev.yml exec -T api python -c "import jwt; print(jwt.encode({'tenantId':'tenant-stress'}, 'supersecretkey', algorithm='HS256'))"

docker run --rm --network host `
  -e BASE_URL=http://localhost:8002 `
  -e REALTIME_METRICS_URL=http://localhost:8003/metrics/ `
  -e PROM_URL=http://localhost:9090 `
  -e AUTH_TOKEN=$token `
  -e TEST_TENANT_ID=tenant-stress `
  -e STAGE_1_TARGET=50 `
  -e STAGE_2_TARGET=100 `
  -e STAGE_3_TARGET=200 `
  -e STAGE_4_TARGET=300 `
  -e STAGE_1_DURATION=2m `
  -e STAGE_2_DURATION=2m `
  -e STAGE_3_DURATION=2m `
  -e STAGE_4_DURATION=2m `
  -v "${PWD}/infrastructure/loadtest:/scripts" `
  grafana/k6 run /scripts/k6-stress.js

### CI stress

- Handmatige workflow: `.github/workflows/loadtest-stress.yml`
- Inputs: `stage_1_target`, `stage_2_target`, `stage_3_target`, `stage_4_target`, `stage_duration`.
- Niet automatisch op PR draaien.

### Wat je tijdens stress moet volgen

- Grafana: publish latency p95, consumed vs broadcast rate, ws connections.
- Prometheus alerts: `HighPublishLatencyP95`, `NoEventConsumption`, `BroadcastMismatch`.
- Saturatie-indicatie: p95 stijgt richting 1s, errors nemen toe, consumption blijft achter op publish.
