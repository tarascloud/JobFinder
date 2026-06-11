#!/bin/bash
# JobFinder deploy script — runs ON MINI (where docker + pg live).
#
# Usage:
#   ssh mini 'bash /opt/repos/taras-code/jf-private/scripts/deploy.sh'
#
# Pipeline:
#   1. Pre-deploy backup: pg_dump jobfinder → gzip → size check (>10KB)
#   2. git pull origin main
#   3. docker build (jobfinder:latest)
#   4. Migration check: prisma/migrations dirs vs _prisma_migrations table —
#      pending migrations are warned about and applied manually via psql
#      (see memory: project_jf_migrations_manual; entrypoint also runs
#      `prisma migrate deploy` as second safety, registered rows keep it happy)
#   5. docker compose up -d jobfinder (no --force-recreate: compose recreates
#      only when the image actually changed — DEV-20260610-0035; full
#      blue-green is a tracked follow-up)
#   6. Post-deploy smoke: / 200, /api/health status ok, /opengraph-image 200

set -euo pipefail

REPO_DIR="${JF_REPO_DIR:-/opt/repos/taras-code/jf-private}"
BACKUP_DIR="${JF_BACKUP_DIR:-/opt/docker/backups}"
BASE_URL="${JF_URL:-http://127.0.0.1:3456}"
DB_USER="jobfinder"
DB_NAME="jobfinder"
MIN_BACKUP_BYTES=10240 # 10KB

log() { echo "[deploy $(date -Iseconds)] $*"; }
fail() { log "ERROR: $*"; exit 1; }

command -v docker >/dev/null || fail "docker not found — run this script on Mini"
[ -d "$REPO_DIR" ] || fail "repo dir not found: $REPO_DIR"

# --- 1. Pre-deploy backup ---------------------------------------------------
BACKUP_FILE="$BACKUP_DIR/jobfinder_pre_deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
log "Backing up $DB_NAME → $BACKUP_FILE"
docker exec pg pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")
if [ "$BACKUP_SIZE" -lt "$MIN_BACKUP_BYTES" ]; then
  fail "backup too small (${BACKUP_SIZE}B < ${MIN_BACKUP_BYTES}B) — aborting deploy. Check $BACKUP_FILE"
fi
log "Backup OK (${BACKUP_SIZE}B)"

# --- 2. git pull ------------------------------------------------------------
cd "$REPO_DIR"
log "git pull origin main"
git pull origin main

# --- 3. docker build --------------------------------------------------------
log "Building jobfinder:latest"
docker build \
  --build-arg DATABASE_URL="postgresql://jobfinder:jobfinder@pg:5432/jobfinder" \
  -t jobfinder:latest .

# --- 4. Migration check (manual psql apply for pending) ----------------------
log "Checking pending Prisma migrations"
APPLIED=$(docker exec pg psql -U "$DB_USER" -d "$DB_NAME" -tA \
  -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL" \
  2>/dev/null || echo "")

PENDING_COUNT=0
for dir in "$REPO_DIR"/prisma/migrations/*/; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")
  sql_file="$dir/migration.sql"
  [ -f "$sql_file" ] || continue

  if ! echo "$APPLIED" | grep -qx "$name"; then
    PENDING_COUNT=$((PENDING_COUNT + 1))
    log "WARNING: pending migration: $name — applying manually via psql"
    docker exec -i pg psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$sql_file"

    # Register in _prisma_migrations so entrypoint's `prisma migrate deploy`
    # does not try to re-apply it on container start
    checksum=$(sha256sum "$sql_file" | cut -d' ' -f1)
    docker exec pg psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
      "INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
       VALUES (gen_random_uuid(), '$checksum', '$name', now(), now(), 1)
       ON CONFLICT DO NOTHING"
    log "Applied + registered: $name"
  fi
done
if [ "$PENDING_COUNT" -eq 0 ]; then
  log "No pending migrations"
else
  log "Applied $PENDING_COUNT pending migration(s)"
fi

# --- 5. Update container ------------------------------------------------------
# No --force-recreate: compose recreates the container only when the image
# changed (fresh build above always produces a new image ID), avoiding a
# pointless restart window when nothing changed (DEV-20260610-0035).
log "Updating jobfinder container"
docker compose -f "$REPO_DIR/docker-compose.prod.yml" up -d jobfinder

# --- 6. Post-deploy smoke -----------------------------------------------------
log "Waiting for container to become healthy"
HEALTH_OK=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 "$BASE_URL/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
    HEALTH_OK=1
    break
  fi
  sleep 2
done
[ "$HEALTH_OK" -eq 1 ] || fail "smoke FAILED: $BASE_URL/api/health did not return status ok within 60s"
log "Smoke: /api/health OK"

ROOT_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/")
[ "$ROOT_CODE" = "200" ] || fail "smoke FAILED: GET / returned $ROOT_CODE (expected 200)"
log "Smoke: / 200 OK"

OG_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE_URL/opengraph-image")
[ "$OG_CODE" = "200" ] || fail "smoke FAILED: GET /opengraph-image returned $OG_CODE (expected 200)"
log "Smoke: /opengraph-image 200 OK"

log "Deploy DONE. Backup: $BACKUP_FILE"
log "Reminder: browser-level Playwright smoke per .claude/rules/deploy-smoke.md (CSP/hydration check)"
