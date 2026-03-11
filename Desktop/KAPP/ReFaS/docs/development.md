# Development Workflow

- Start backend: docker compose -f docker-compose.dev.yml up -d --build
- Start frontend: pnpm install && pnpm --filter @farmplatform/osagro dev
- Healthchecks: curl http://localhost:8002/health
- Lint: pnpm eslint
- Architectuurlint: pnpm lint:architecture
