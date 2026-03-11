# database

Database-laag voor schema-evolutie en seeddata.

## Status

- **Actief**

## Inhoud

- `migrations/` SQL migraties
- `seeds/` seed-scripts

## Doel

- Beheer van real/sim schema’s en eventtabellen.
- Reproduceerbare evolutie van datamodel per omgeving.

## Gebruik

- Stack starten: `docker compose -f docker-compose.dev.yml up -d db`
- Seeds: zie scripts in `../scripts/` en `seeds/`.

## Richtlijnen

- Migraties zijn append-only.
- Tenant-isolatie en domeinscheiding (`real.*` vs `sim.*`) blijven expliciet.

## Zie ook

- Root docs: `../README.md`
# database

Database-assets voor schema-evolutie en seeddata.

## Status

- **Actief**

## Inhoud

- `migrations/`: SQL-migraties per wijziging.
- `seeds/`: seed scripts voor dev/demo.

## Gebruik

- Migraties en schemawijzigingen worden toegepast via project-runbooks/tooling.
- Voor lokale stack: start `db` met compose.

## Grenzen

- Simulatie- en real-state blijven logisch gescheiden (`sim.*` vs `real.*`).
- Wijzigingen in schema moeten contractcompatibel blijven met services.

## Links

- Root context: `../README.md`
- DR scripts: `../scripts/backup_postgres.sh`, `../scripts/restore_postgres.sh`, `../scripts/dr_smoke_test.sh`
