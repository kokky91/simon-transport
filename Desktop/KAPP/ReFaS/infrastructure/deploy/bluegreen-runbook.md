# Blue/Green Deployment Runbook

Doel: veilige release met snelle rollback, zonder downtime voor API en realtime workloads.

## Scope

- `services/api`
- `services/realtime`
- `services/worker` (optioneel meeschakelen, afhankelijk van queue/backlog)

## Release Model

- **Blue** = huidige productieversie.
- **Green** = nieuwe kandidaatversie.
- Verkeer switcht pas nadat green alle gates haalt.

## Vereisten

- Images zijn immutable getagd (bijvoorbeeld `api:<git-sha>`, `realtime:<git-sha>`).
- Config is extern (env/secrets), geen state op service-instance.
- Database migraties zijn backward-compatible voor ten minste één release-venster.
- Redis en Postgres blijven gedeelde backend tijdens switch.

## CI Gates (Release Candidate)

Workflow: `.github/workflows/bluegreen-gates.yml`

Een kandidaat mag alleen naar green als alle checks slagen:

1. API health check (`/health`)
2. Realtime health check (`/health`)
3. Security smoke (`security-smoke.yml` equivalent checks)
4. Integration smoke (`integration-smoke.yml` equivalent checks)
5. Korte k6 baseline sanity-run

## Stappenplan Blue/Green

1. **Build + push green images**
   - Build images voor API/realtime/worker met nieuwe immutable tag.

2. **Deploy green stack zonder traffic switch**
   - Start green instances parallel aan blue.
   - Verifieer dat green bereikbaar is via interne routing (niet publiek).

3. **Run gates op green**
   - Draai `bluegreen-gates.yml` met de kandidaatcommit/tag.
   - Geen traffic switch zolang één gate faalt.

4. **Traffic switch**
   - Verleg routing in één gecontroleerde stap van blue naar green.
   - Houd blue warm gedurende observatievenster.

5. **Post-switch observatie (10-30 min)**
   - Monitor: API latency p95, rate-limit rejections, ws auth/origin rejects, publish/consume mismatch.
   - Alerts in deze repo: `HighPublishLatencyP95`, `NoEventConsumption`, `BroadcastMismatch`, security/rejection spikes.

6. **Promote of rollback**
   - Bij stabiele metrics: green wordt actief, blue kan gecontroleerd uitgefaseerd worden.
   - Bij regressie: direct rollback naar blue (zie playbook).

## Rollback Playbook

Trigger rollback direct bij één van deze signalen:

- Sustained 5xx stijging na switch
- `NoEventConsumption` of blijvende `BroadcastMismatch`
- Abnormale stijging in auth/origin/rate-limit rejects zonder verwacht traffic-patroon
- Kritieke business-flow faalt in smoke/health checks

Rollback stappen:

1. Herstel traffic routing van green naar blue.
2. Bevestig herstel met:
   - `GET /health` op API en realtime
   - Security smoke kernchecks
   - Eén gecontroleerde publish + websocket receive flow
3. Markeer green als failed candidate en freeze verdere rollout.
4. Verzamel forensics:
   - Compose/container logs
   - Prometheus tijdvenster rond switch
   - Candidate image tags en config diff

## Praktische Guardrails

- Voer nooit schema-breaking migraties uit in dezelfde stap als traffic switch.
- Schakel worker pas over nadat API/realtime stabiel zijn, tenzij release worker-specifiek is.
- Houd rollback-pad altijd eenvoudiger dan rollout-pad.
- Gebruik alleen geversioneerde configuratie en immutable images.
