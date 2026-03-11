# infrastructure

Infra, monitoring, loadtesting, deployment-runbooks en IaC documentatie.

## Status

- **Actief**

## Inhoud

- `monitoring/` Prometheus, Grafana, Alertmanager, autoscaling-assets
- `docker/` docker-gerelateerde artefacten
- `loadtest/` k6 scenario’s
- `deploy/` runbooks en readiness docs
- `terraform/` IaC

## Doel

- Operationele betrouwbaarheid, zichtbaarheid en rollout-ondersteuning.

## Gebruik

- Monitoring stack draait via `docker-compose.dev.yml`.
- Smoke/loadtest context in `../observability.md`.

## Zie ook

- Root docs: `../README.md`
- Monitoring submap: `./monitoring/`
# infrastructure

Infra-, monitoring-, loadtest- en deploymentartefacts voor ReFaS.

## Status

- **Actief**

## Inhoud

- `deploy/`: runbooks (blue/green, multi-region readiness, pentest checklist).
- `docker/loadtest/`: k6 baseline/soak/stress scripts.
- `monitoring/`: Prometheus, Alertmanager, Grafana provisioning, autoscaling-hulpmiddelen.
- `terraform/`: IaC-structuur.

## Gebruik

- Monitoring stack draait mee via `docker-compose.dev.yml`.
- k6 scripts zijn bedoeld voor prestatietesten buiten standaard dev-flow.

## Grenzen

- Deze map bevat infrastructuurconfiguratie, geen businesslogica.

## Links

- Root context: `../README.md`
- Observability gids: `../observability.md`
