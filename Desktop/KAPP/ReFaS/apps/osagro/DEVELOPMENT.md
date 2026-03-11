# osagro development

Praktische developer-notes voor snelle iteratie in de osagro-frontend.

## Dagelijks werken

- Start vanuit repo-root: `pnpm --filter @farmplatform/osagro dev`
- Build-check: `pnpm --filter @farmplatform/osagro build`
- Preview build: `pnpm --filter @farmplatform/osagro preview`

## Structuur

- `src/app`: app shell en providers
- `src/features`: featuregerichte modules
- `src/components`: gedeelde UI-componenten
- `src/routes`: route-definities
- `src/store`: state management
- `src/lib`: gedeelde helpers en utilities
- `src/lib/api`: fetch-client, auth-afhandeling en endpoint wrappers
- `src/lib/ai`: AI-gerelateerde clientlogica
- `src/lib/hooks`: gedeelde custom hooks (zoals tenant-headers)
- `src/lib/realtime`: realtime listeners/subscriptions
- `src/lib/utils`: generieke utilities (zoals env helpers)

## API in de frontend

- Gebruik `src/lib/api/client.ts` als centrale HTTP-client.
- `apiRequest` voor JSON requests; `apiRequestFormData` voor multipart/form-data.
- Bij `401` wordt sessie/tenant opgeschoond en auth-storage verwijderd.
- Definieer endpointfuncties in `src/lib/api/endpoints.ts` en gebruik die in features/components.

### Conventies (endpoints)

- Lezen: `fetchX` / `fetchXById`
- Aanmaken: `createX` of `startX` (voor jobs/runs)
- Bijwerken: `updateX` of `patchX`
- Verwijderen: `deleteX`
- Gebruik een duidelijke payload-naam: `payload`
- Geef altijd een getypeerde return (`apiRequest<Type>(...)`)
- Houd padnamen API-conform en voorspelbaar (bijv. `/api/sim/runs`)

## API-koppeling

- Frontend praat alleen met `services/api`.
- Gebruik Bearer JWT voor beschermde endpoints.
- Tenantcontext wordt server-side afgedwongen; stuur geen tenant als bron van waarheid in client-state.

## Definition of done

- Lokaal werkt de relevante user flow in dev-mode.
- Build slaagt met `pnpm --filter @farmplatform/osagro build`.
- Geen contractbreuk met API payloads.
