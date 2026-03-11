# AI evaluatie (startpunt)

Deze map bevat de minimale evaluatie-aanpak voor AI-functionaliteit.

## Doel

- Kwaliteit van samenvattingen en prefill-output bewaakbaar maken.
- Regressies detecteren bij model- of promptwijzigingen.

## Minimale checks

- JSON-validiteit voor prefill (geen markdown, alleen toegestane keys).
- Volledigheid van verplichte velden (geen lege response).
- Taalconsistentie (Nederlands waar vereist).
- Stabiliteit op representatieve voorbeeld-PDF's.

## Huidige tooling

- Smoke-test script: `../../../scripts/test_ai_client.py`

## Vervolg

- Dataset met vaste golden cases toevoegen.
- Geautomatiseerde evaluatie in CI opnemen.
