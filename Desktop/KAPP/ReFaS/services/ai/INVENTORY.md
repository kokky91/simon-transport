# AI code-inventaris

Dit document beschrijft waar AI-logica en AI-assets momenteel staan.

## Centrale AI-assets (bron van waarheid)

- `services/ai/models/model-catalog.json`
- `services/ai/prompts/plants-summary.nl.txt`
- `services/ai/prompts/plants-prefill.nl.txt`
- `services/ai/evaluation/README.md`

## Runtime AI-integratie (actief)

- API client/factory/config:
  - `services/api/app/services/ai/client.py`
  - `services/api/app/services/ai/factory.py`
  - `services/api/app/services/ai/config.py`
- Assetkoppeling naar `services/ai`:
  - `services/api/app/services/ai/assets.py`
- Plants route gebruikt centrale prompts en modelcatalogus:
  - `services/api/app/routes/plants.py`

## Compatibiliteit en aanroepers

- Legacy shim:
  - `services/api/app/core/ai_client.py`
- API startup/readiness gebruikt AI client:
  - `services/api/app/main.py`
- AI test-harnas:
  - `scripts/test_ai_client.py`

## Conclusie

- AI-assets leven centraal in `services/ai`.
- Runtime blijft in API-service (huidige fase), maar leest nu direct uit `services/ai`.
