# agro-core

`agro-core` is de real-world domeingrens voor operationele landbouwdata.

## Status

- **Architectuurboundary (fase 1 actief als contract, implementatie deels verspreid).**
- Deze map documenteert de grens en regels voor real-state ownership.

## Verantwoordelijkheden

- Beheert truth-state voor operationele data.
- Schrijft uitsluitend naar `real.*` schema’s.
- Publiceert real-domain events naar `real.events`.
- Levert read-only input voor simulatie via transferobjecten/snapshots.

## Datagrens

- Voorbeelden real-tabellen: `real.farms`, `real.tasks`, `real.harvests`.
- Geen writes naar `sim.*` vanuit deze boundary.
- Geen cross-tenant datamenging; tenantcontext is verplicht.

## Contracten met andere services

- API gebruikt deze boundary als bron van waarheid voor operationele mutaties.
- Worker/simulatie mogen real-data alleen lezen via expliciete snapshot/DTO-contracten.
- Realtime mag real-events distribueren, maar niet muteren.

## Non-goals

- Geen simulatieberekeningen.
- Geen verwerking van sandbox-commando’s.
- Geen directe frontend-koppeling naar database.

## Security en multi-tenant regels

- Tenant komt uit JWT-claims (`tenantId` of `tenant_id`).
- Server-side tenant-afleiding is leidend.
- Elke write moet tenant-geïsoleerd en auditbaar zijn.

## Operationele checks

- Controleer API health: `curl.exe -sS --max-time 8 http://localhost:8002/health`
- Controleer migraties in `database/migrations` bij schemawijzigingen.
- Controleer eventflow/metrics via Prometheus en Grafana bij incidenten.

## Verwachte evolutie

- In volgende fases kan de implementatie van deze boundary verder worden uitgesplitst naar dedicated modules/services, zonder contractbreuk op `real.events` en `real.*`.
