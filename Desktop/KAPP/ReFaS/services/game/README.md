# services/game

Actieve simulatie-runtime en engine-implementatie.

## Status

- **Actief**
- Huidige runtime-waarheid voor sim-engine gedrag.

## Verantwoordelijkheden

- Verwerkt simulatielogica per tick/commando.
- Produceert resultaten/events voor downstream verwerking.
- Blijft read-only t.o.v. `real.*` (geen real-state mutaties).

## Code-indeling

- `engine.py` engine-entry
- `components/` entiteitscomponenten
- `systems/` simulatiesystemen
- `domain/` domeinmodellen
- `core/` kerninfrastructuur

## Dependencies

- `requirements.txt` (o.a. `redis`)

## Grenzen

- Geen ownership van operationele real-world truth-state.
- Geen auth- of API-transportlogica in engine-code.

## Zie ook

- Concept/legacy boundary: `../farmsim-engine/README.md`
- Root architectuur: `../../README.md`
# game

Actieve simulatie-runtime voor sandboxverwerking.

## Status

- **Actief**

## Starten (lokaal)

- Wordt indirect gebruikt via API/worker flow in compose.
- Voor lokale afhankelijkheden: zie `requirements.txt`.

## Config

- Bevat engine-, domain- en systems-modules.
- Heeft Redis dependency voor command/event flow.

## Grenzen

- Simulatie muteert nooit `real.*` truth-state.
- Houdt contracten stabiel voor `sim.commands`, `sim.results`, `sim.events`.

## Links

- Root context: `../../README.md`
- Boundary docs: `../farmsim-engine/README.md`
