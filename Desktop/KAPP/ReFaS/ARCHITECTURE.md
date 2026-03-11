# ReFaS Platform Architecture

ReFaS is een **multi-tenant agro simulation and business platform**.

Het platform combineert:

* landbouwbeheer
* simulatie-engine
* AI assistenten
* realtime events
* data-extractie pipelines

De codebase is georganiseerd als een **monorepo**.

---

# High Level Architecture

Het platform bestaat uit vier hoofdlagen.

```
Frontend
Backend services
Simulation engine
Infrastructure
```

---

# 1. Frontend Layer

Frontend apps bevinden zich in:

```
apps/
```

Apps:

```
apps/osagro
apps/farmsim
apps/mobile
```

### osagro

Operationele webapp voor:

* farm management
* plants database
* planning
* AI tools
* realtime dashboards

Stack:

```
React
Vite
TypeScript
Zustand
```

---

# 2. Backend Services

Backend services staan in:

```
services/
```

Services:

```
api
worker
realtime
ai
data-extractor
agro-core
pricing
```

### API service

Verantwoordelijk voor:

* business logic
* database toegang
* auth
* event publishing

Stack:

```
FastAPI
PostgreSQL
Redis
```

---

### Worker service

Voert background jobs uit:

* simulaties
* AI workflows
* lange taken

---

### Realtime service

Websocket service voor:

* event broadcasting
* dashboards
* live simulaties

---

### AI service

Bevat:

```
models
prompts
rag
tools
vector search
```

---

### Data Extractor

Pipelines voor:

* plant data
* infra data
* animal data

---

# 3. Simulation Layer

Simulatie-engine:

```
services/game
services/farmsim-engine
```

Bevat:

```
entity component system
tick engine
production systems
market systems
AI systems
```

Dit maakt realtime farm-simulaties mogelijk.

---

# 4. Shared Packages

Herbruikbare code staat in:

```
packages/
```

Bijvoorbeeld:

```
contracts
shared-logic
scoring
```

Contracts bevatten:

```
events
schemas
domain types
```

---

# 5. Database Layer

Database migraties staan in:

```
database/migrations
```

Belangrijke domeinen:

```
plants
tasks
simulation
infra
users
```

Alle tabellen zijn **tenant-aware**.

---

# 6. Infrastructure

Infrastructure-as-code staat in:

```
infrastructure/
```

Onderdelen:

```
docker
terraform
monitoring
loadtesting
deploy
```

Monitoring stack:

```
Prometheus
Grafana
Alertmanager
```

Loadtesting:

```
k6
```

---

# 7. Event Architecture

Het platform gebruikt **event-driven communicatie**.

Flow:

```
API -> Redis -> Realtime
Worker -> Redis -> Realtime
Simulation -> Redis -> API
```

Events staan in:

```
packages/contracts/src/events
```

---

# 8. Multi Tenant Model

Elke tenant is een geïsoleerde farm.

Alle data bevat:

```
tenant_id
```

De API bepaalt de tenant via:

```
JWT claims
```

---

# 9. Development Workflow

Lokale start:

```
docker compose -f docker-compose.dev.yml up
```

Frontend:

```
pnpm dev
```

---

# 10. Design Principles

Belangrijkste regels:

* frontend praat alleen met API
* services communiceren via events
* zware taken gaan naar workers
* features zijn modulair
* contracts zijn gedeeld

---

# Future Vision

ReFaS evolueert naar een platform voor:

* agro digital twins
* AI assisted farming
* ecosystem simulation
* regenerative agriculture planning
