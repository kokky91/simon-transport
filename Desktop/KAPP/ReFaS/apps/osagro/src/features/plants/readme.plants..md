# Features – osagro frontend

Deze map bevat **featuregerichte modules** voor de osagro-frontend.
Elke feature groepeert UI, hooks, API-koppelingen en state rond één domein.

Voorbeelden van features:

* `dashboard`
* `plants`
* `tasks`
* `farms`
* `fields`
* `finance`
* `simulations`
* `admin`
* `auth`

Het doel is om **domeinlogica te isoleren**, zodat features onafhankelijk kunnen evolueren.

---

# Basisstructuur van een feature

Elke feature volgt dezelfde mapstructuur.

```
features/
  feature-name/
    api/
    components/
    hooks/
    pages/
    store/
    types.ts
    route.tsx
```

## Beschrijving per map

### `api/`

API-aanroepen voor deze feature.

Voorbeeld:

```
plants/api/plantsApi.ts
tasks/api.ts
```

Alle API-calls lopen via:

```
src/lib/api/client.ts
```

Directe fetches naar services mogen niet.

---

### `components/`

Herbruikbare UI-componenten voor de feature.

Voorbeelden:

```
PlantDashboard.tsx
PlantDatabaseOverview.tsx
PlantIntakeForm.tsx
```

Regels:

* PascalCase
* Eén hoofdcomponent per file
* Alleen feature-specifieke UI

Algemene UI hoort in:

```
src/components/ui
```

---

### `hooks/`

Custom React hooks voor featurelogica.

Voorbeelden:

```
usePlantAIFlow.ts
useTasks.ts
useSimulationStream.ts
```

Gebruik hooks voor:

* API-calls
* realtime data
* complexe UI-logica

Niet voor pure presentational components.

---

### `pages/`

Top-level pagina’s die door routes worden gebruikt.

Voorbeeld:

```
PlantsPage.tsx
TasksPage.tsx
DashboardPage.tsx
```

Pages mogen:

* layout gebruiken
* featurecomponenten combineren

Pages mogen **geen zware logica bevatten**.

---

### `store/`

State management voor de feature.

Voorbeelden:

```
plantStore.ts
```

Gebruik dit voor:

* feature state
* caching
* UI state

Globale state hoort in:

```
src/store
```

---

### `types.ts`

Typescript types voor de feature.

Voorbeeld:

```
Plant
PlantVersion
Task
SimulationState
```

Voorkom duplicatie van types tussen features.

---

### `route.tsx`

Route-definitie voor de feature.

Voorbeeld:

```
/dashboard
/plants
/tasks
/admin
```

Routes worden geregistreerd in:

```
src/app/router.tsx
```

---

# Stylingregels

Features mogen **geen eigen styling-systeem bouwen**.

Gebruik altijd:

```
src/app/styles.css
```

Regels:

* gebruik `os-*` classnames
* geen hardcoded kleuren
* geen inline margins/paddings
* gebruik design tokens

Voorbeelden:

```
os-card
os-grid
os-stack
os-button
```

Zie:

```
UI_SYSTEM.md
```

---

# Naming conventions

### Componenten

```
PlantDashboard.tsx
TaskList.tsx
AdminPerformanceTable.tsx
```

Niet:

```
dashboardWidget.tsx
dataBox.tsx
itemList.tsx
```

---

### Hooks

```
useTasks
usePlantAIFlow
useSimulationStream
```

---

### Stores

```
plantStore
taskStore
simulationStore
```

---

# Anti-patterns

Vermijd:

❌ API-calls direct in components
❌ styling via inline styles
❌ duplicatie van componenten buiten `components/`
❌ businesslogica in pages
❌ globale state voor feature-specifieke data

---

# Definition of Done (feature)

Een feature is klaar wanneer:

* user flow lokaal werkt
* build slaagt (`pnpm --filter @farmplatform/osagro build`)
* API-contracten niet breken
* styling conform `UI_SYSTEM.md` is
* code logisch verdeeld is over `api`, `components`, `hooks`, `pages` en `store`

---

# Voorbeeld: plants feature

```
features/plants
 ├ api/
 │   └ plantsApi.ts
 ├ components/
 │   ├ PlantDashboard.tsx
 │   ├ PlantDatabaseOverview.tsx
 │   └ PlantIntakeForm.tsx
 ├ hooks/
 │   └ usePlantAIFlow.ts
 ├ pages/
 │   └ PlantsPage.tsx
 ├ store/
 │   └ plantStore.ts
 └ types.ts
```

Dit houdt de codebase **modulair, schaalbaar en onderhoudbaar**.
