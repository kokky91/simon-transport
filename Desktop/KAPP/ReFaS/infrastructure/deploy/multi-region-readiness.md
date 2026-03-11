# Multi-Region Readiness Plan

Doel: gecontroleerd doorgroeien van single-region naar multi-region zonder tenant-isolation, observability of release-safety te verliezen.

## Scope

- API, realtime en worker schaalbaar en uitwisselbaar per regio.
- Event backbone met Redis High Availability strategie.
- Region-failover met duidelijke SLO/RTO/RPO keuzes.

## Doelarchitectuur (Target State)

- **Global entrypoint** met health-based routing (active/passive start, active/active later).
- **Stateless compute per regio** voor API, realtime en worker.
- **Data layer per regio** met replicatie/failoverbeleid.
- **Redis HA per regio** voor lokale realtime-latency en worker throughput.
- **Cross-region observability** met regionale labels voor snelle incident-triage.

## 1) Stateless Scaling Contract

Vereisten om regio-onafhankelijk te schalen:

- Geen in-memory sessiestate als bron van waarheid.
- Tenant-context altijd uit JWT/claims + event payload, nooit uit instance-lokale cache.
- Config en secrets extern beheren, image immutable houden.
- Elke instance moet vervangbaar zijn zonder dataverlies.

Controlelijst:

- API routes blijven idempotent waar mogelijk.
- Realtime connection state is ephemeral en kan opnieuw worden opgebouwd.
- Worker jobs zijn retry-safe en side-effects beschermd tegen dubbele verwerking.

## 2) Redis HA Strategy

### Fase 1 (kort): Single primary + replica + automated failover per regio

- Gebruik Redis met Sentinel/managed equivalent binnen één regio.
- Doel: snelle failover bij node-uitval, minimale architectuurwijziging.

### Fase 2 (midden): Redis cluster per regio

- Voor hogere throughput en shard-based schaalbaarheid.
- Houd pub/sub usage region-local voor voorspelbare latency.

### Fase 3 (later): Multi-region event bridge

- Niet direct cross-region pub/sub op applicatielaag forceren.
- Gebruik een expliciete event-replicatie/bridge laag voor geselecteerde event-types.
- Definieer welke events region-local blijven en welke globaal gerepliceerd moeten worden.

Beslissingsregel:

- Realtime UX events: region-local first.
- Kritieke business events: durable store first, daarna gecontroleerde replicatie.

## 3) Region Traffic Model

### Startadvies: Active/Passive

- Primair verkeer naar regio A.
- Regio B warm standby met periodieke smoke-validatie.
- Failover alleen bij duidelijke incidentcriteria.

### Doorgroei: Selective Active/Active

- Tenant- of geography-based routing.
- Sticky routing voor websocket-sessies.
- Voorkom willekeurige cross-region reconnect loops.

## 4) Data Consistency en DR

Definieer per datadomein:

- **RTO** (herstelduur)
- **RPO** (toegestaan dataverlies)
- Consistentiemodel (strong vs eventual)

Praktische richtlijn:

- Transactionele kerngegevens: striktere RPO, replicatie met prioriteit.
- Telemetry/operational events: eventual consistency acceptabel.

## 5) Operational Guardrails

- Blue/green blijft verplicht per regio vóór traffic switch.
- Security smoke + integration smoke + load sanity draaien per regio-kandidaat.
- Incident runbooks bevatten expliciete regional failover en failback stappen.
- Region labels verplicht op logs/metrics/traces (`region`, `service`, `tenant`).

## 6) Gefaseerd Implementatiepad

1. **Region-ready baseline**
   - Voeg `REGION` env toe in services.
   - Label alle metrics/logs met regio.

2. **Redis HA per regio**
   - Introduceer managed HA Redis of Sentinel setup.
   - Test failover onder load.

3. **Standby region live maken**
   - Deploy full stack in tweede regio.
   - Draai scheduled smoke checks tegen standby endpoints.

4. **Controlled failover drill**
   - Simuleer region outage.
   - Meet werkelijke RTO/RPO tegen targets.

5. **Selective active/active onboarding**
   - Start met niet-kritieke tenantsegmenten.
   - Monitor reconnect gedrag, queue lag en event mismatch.

## 7) Acceptatiecriteria

Multi-region readiness is gehaald wanneer:

- Region failover aantoonbaar werkt binnen afgesproken RTO.
- Geen cross-tenant datalekken tijdens failover/reconnect.
- Redis failover veroorzaakt geen langdurige consume/broadcast mismatch.
- Blue/green + security/integration gates per regio reproduceerbaar groen zijn.

## 8) Risico's en Mitigaties

- **Risico:** split-brain routing van websocket clients.
  - **Mitigatie:** sticky routing + heldere reconnect policy.

- **Risico:** event duplicatie na failover.
  - **Mitigatie:** idempotency keys en dedupe op consumer pad.

- **Risico:** onderschatte operationele complexiteit active/active.
  - **Mitigatie:** start active/passive, pas daarna gefaseerd uitbreiden.
