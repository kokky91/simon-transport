# packages/contracts

Gedeelde contracten (types/events) tussen apps en services.

## Status

- **Actief**

## Doel

- Eén bron van waarheid voor event- en datatypecontracten.
- Vermindert drift tussen API, realtime, worker en frontends.

## Inhoud

- `src/index.ts` package exports
- `src/events/` eventdefinities

## Richtlijnen

- Contractwijzigingen versioneren en communiceren.
- Backward compatibility bewaken waar mogelijk.

## Zie ook

- Root docs: `../../README.md`
# contracts

Gedeelde contracten (types/events/interfaces) tussen apps en services.

## Status

- **Actief**

## Doel

- Centraliseert cross-service contractdefinities.
- Vermindert drift tussen frontend, API, worker en realtime.

## Gebruik

- Public API via `src/index.ts`.
- Eventcontracten onder `src/events/`.

## Grenzen

- Alleen contracten en types; geen runtime infrastructuur of domeinmutaties.

## Links

- Root context: `../../README.md`
