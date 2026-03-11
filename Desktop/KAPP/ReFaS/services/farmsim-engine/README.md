# farmsim-engine

`farmsim-engine` beschrijft de simulatieboundary als concept/legacy domeinlaag.

## Status

- **Concept/legacy boundary-documentatie.**
- **Actieve runtime-implementatie staat momenteel in `services/game`.**

## Verantwoordelijkheden

- Consumeert `DomainSnapshot` op basis van real-state.
- Verwerkt `sim.commands`.
- Produceert `sim.results` en `sim.events`.
- Muteert nooit `real.*` tabellen.

## Huidige runtime-mapping

- Simulatie-engine code en tick-verwerking draaien in `services/game`.
- API accepteert commando-intents; worker verwerkt asynchrone taken.
- Deze README bewaakt de contractgrenzen zodat implementatie-locatie kan veranderen zonder gedragsdrift.

## Contractregels

- Simulatie is read-only ten opzichte van real-world data.
- `real.*` en `sim.*` blijven strikt gescheiden.
- Eventing en resultaatcontracten blijven stabiel bij interne refactors.

## Non-goals

- Geen ownership van real-world truth-state.
- Geen directe writes naar operationele tabellen.
- Geen frontend- of API-authlogica in de enginelaag.

## Split-ready pad

- Doelbeeld fase 2: dedicated `sim-runner` runtime.
- Voorwaarde: contractbehoud op `sim.commands`, `sim.results`, `sim.events`.
- Worker/game-functies kunnen worden verplaatst zonder breaking changes voor API/realtime.

## Operationeel

- Valideer API + sim-run flow via lokale smoke-tests uit root README.
- Gebruik metrics/alerts in `infrastructure/monitoring` om command queue, throughput en failure/retry te volgen.
