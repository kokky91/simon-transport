#!/usr/bin/env bash

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-farmplatform}"
OUTPUT_DIR="${OUTPUT_DIR:-storage}"

mkdir -p "${OUTPUT_DIR}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${OUTPUT_DIR}/backup_${TIMESTAMP}.dump"

docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" pg_dump \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -Fc > "${BACKUP_FILE}"

echo "Backup created: ${BACKUP_FILE}"
