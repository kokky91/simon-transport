#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-farmplatform}"

# Ensure database can be recreated even when active connections exist.
docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" psql -U "${DB_USER}" -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();"
docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" dropdb -U "${DB_USER}" --if-exists "${DB_NAME}"
docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" createdb -U "${DB_USER}" "${DB_NAME}"

cat "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" pg_restore \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --clean --if-exists --no-owner --no-privileges

echo "Restore completed from: ${BACKUP_FILE}"
