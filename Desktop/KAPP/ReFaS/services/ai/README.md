# services/ai

Centrale AI-hub voor gedeelde AI-assets en standaarden binnen het platform.

## Status

- **Actief als centrale AI-assetlaag**
- Bevat modelcatalogus, prompts en evaluatie-startpunten.
- Runtime-integratie draait via `services/api/app/services/ai`.

## Doel

- Eén centrale plek voor AI-gerelateerde assets die door meerdere services gebruikt kunnen worden.
- Voorkomen dat modelkeuzes en promptteksten versnipperd raken.

## Inhoud

- `models/model-catalog.json`: gedeelde modelcatalogus met aanbevolen model.
- `prompts/plants-summary.nl.txt`: NL prompttemplate voor plants-samenvatting.
- `prompts/plants-prefill.nl.txt`: NL prompttemplate voor plants-prefill JSON.
- `evaluation/README.md`: evaluatie-aanpak en minimale kwaliteitschecks.
- `INVENTORY.md`: inventaris van AI-codepaden en integraties.


## Runtime-grenzen

- Geen eigen deploybare service in deze map.
- API blijft de runtime-entrypoint voor AI-calls.
- Zware asynchrone AI-verwerking hoort in worker-flow, niet in de API request-cycle.
- Promptbestanden zijn instructielaag; AI-contract-anker staat in API: `services/api/app/schemas/plants_ai.py`.
- Prompt en fallback mogen niet afwijken van dat contract.

### Modelcatalogus: reload & idempotentie

- De modelcatalogus (`models/model-catalog.json`) wordt bij runtime éénmalig per proces geladen via caching (`@lru_cache(maxsize=1)` in `assets.py`).
- Herladen gebeurt alleen bij een restart van het proces (bijvoorbeeld na een deploy of reload van de API-service).
- Er is geen registratie- of mutatielogica: alle modelkeuzes zijn contract-gedreven en alleen-lezen.
- Dit voorkomt dubbele registraties, race conditions en inconsistenties.
- Elke API-call gebruikt altijd dezelfde gedeelde catalogus zolang het proces draait.
- Reload-mode (zoals hot-reload in dev) forceert een herlaad van de catalogus, maar blijft idempotent: geen bijwerkingen, geen duplicaten.

## Werkwijze

- Wijzig eerst modelcatalogus en prompts in deze map.
- Houd naming en JSON-structuren contract-consistent met API-schema.
- Valideer vervolgens runtime-gedrag via API health/readiness endpoints.

## Zie ook

- Root docs: `../../README.md`
- API AI-runtime: `../api/app/services/ai/`
