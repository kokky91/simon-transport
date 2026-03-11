# apps/osagro

Frontend webapp voor operationele workflows en dashboards.

## Status

- **Actief**
- Stack: React + Vite + TypeScript
- Feature-first structuur: alle modules onder `src/features/[feature]`
- Centrale state per feature via zustand (`store.ts`)
- API-boundaries: alleen via `features/[feature]/api.ts`

## Quickstart (lokaal)

Vanuit de repo-root:

1. `pnpm install`
2. `pnpm --filter @farmplatform/osagro dev`

Build/preview:

- `pnpm --filter @farmplatform/osagro build`
- `pnpm --filter @farmplatform/osagro preview`

## Kernverantwoordelijkheden

- UI voor tenant-aware interactie met de API.
- Weergave van operationele data en realtime updates.
- Geen directe databaseconnecties vanuit de client.

## Structuur & best practices

- Feature-modules in `src/features/[feature]` met eigen `route.tsx`, `api.ts`, `store.ts` (zustand), optioneel `hooks.ts`.
- Gedeelde UI-componenten in `src/components`, app shell in `src/app`.
- Helpers/utilities in `src/lib`.
- API-calls uitsluitend via feature-boundary (`api.ts`), geen fetch/axios direct in UI.
- State management: zustand store per feature, geen losse useState in pages/components.
- Migratie: verplaats lokale state naar zustand, centraliseer businesslogica in hooks of store.

## Belangrijke paden

- `src/features/`: feature modules
- `src/components/`: gedeelde UI
- `src/app/`: shell, styles
- `src/lib/`: helpers, api-client
- `public/`: statische assets
- `vite.config.ts`: bundlerconfig
- `package.json`: scripts `dev`, `build`, `preview`

## Grenzen

- Backendverkeer loopt uitsluitend via `services/api`.
- Auth via Bearer JWT; tenantcontext wordt server-side afgedwongen.
- Domeincontracten blijven via `packages/contracts`.

## Styling en thema-consistentie

- Gebruik `src/app/styles.css` als primaire bron voor gedeelde stylingregels.
- Hergebruik bestaande class-naming (`os-*` voor app/ui, `infra-*` voor simulatie/infra) en voeg nieuwe classes in dezelfde stijl toe.
- Voeg nieuwe kleuren/spacings eerst als centrale CSS custom properties toe (bij voorkeur in `styles.css`) in plaats van losse hardcoded waarden per component.
- Houd light/dark-gedrag consistent: definieer varianten op token-niveau en voorkom ad-hoc thema-afwijkingen in individuele componenten.
- Vermijd inline styles voor structurele UI-styling; gebruik classes zodat themawijzigingen op één plek beheersbaar blijven.
- Bij UI-wijzigingen: controleer minimaal login, dashboard en simulatie-schermen op leesbaarheid/contrast in beide thema’s.

## Zie ook

- Root-overzicht: `../../README.md`
- API service: `../../services/api/README.md`
- Observability smoke-tests: `../../observability.md`
