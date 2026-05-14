#!/bin/sh
# JF-MIG-01: Auto-apply Prisma migrations before starting Next.js
# Runs on every container start; idempotent — 0 pending = exits 0 immediately
set -e

# JF-RUNTIME-FIX-20260512: fail fast with explicit message if DATABASE_URL missing.
# Previously prisma migrate would emit a generic "datasource.url required" error
# (because prisma.config.ts reads process.env.DATABASE_URL at load time), which
# is hard to triage from status logs. This guard makes the failure self-evident.
if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set. Container cannot run prisma migrate."
  echo "[entrypoint] Check that env_file (/opt/docker/secrets/.jobfinder.env) is mounted and contains DATABASE_URL."
  exit 1
fi

echo "[entrypoint] Running prisma migrate deploy..."
node /app/node_modules/prisma/build/index.js migrate deploy
echo "[entrypoint] Migrations done. Starting server..."

exec node server.js
