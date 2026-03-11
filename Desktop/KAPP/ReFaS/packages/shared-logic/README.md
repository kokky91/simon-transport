# packages/shared-logic

Planned package voor gedeelde, domein-neutrale logica.

## Status

- **Gepland / in opbouw**
- Map is momenteel leeg.

## Beoogd doel

- Utility- en helperlogica die door meerdere onderdelen wordt gedeeld.

## Zie ook

- Root docs: `../../README.md`
# shared-logic

Placeholder voor gedeelde domeinlogica/utilities.

## Status

- **Gepland**
- Map bevat nog geen implementatie.

## Starten (lokaal)

- Nog niet van toepassing.

## Grenzen

- Nieuwe code hier moet herbruikbaar en contractgedreven zijn.

## Plaatsingschecklist (wel/niet)

- **Wel in shared-logic**
	- Pure functies zonder netwerk, secrets of runtime-config.
	- Domein-neutrale mapping/validatie helpers.
	- JSON/string normalisatie die geen servicecontext nodig heeft.

- **Niet in shared-logic**
	- Provider-calls (OpenAI/Ollama/HTTP clients).
	- Environment/config-resolutie (`settings`, `.env`, API keys).
	- Retries/timeouts/observability gekoppeld aan een concrete service.

- **Snelle beslisregel**
	- Heeft de helper netwerk, credentials of runtime state nodig? Dan hoort het in de service-laag, niet in shared-logic.

## Links

- Root context: `../../README.md`
