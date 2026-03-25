#!/bin/bash
# Run by cron on Mini at 17:00 CET
# Triggers scraping for all active search profiles via API
#
# Crontab entry (on Mini):
#   0 17 * * * /opt/repos/taras-code/jf-private/scripts/cron-scrape.sh >> /var/log/jobfinder-scrape.log 2>&1

set -euo pipefail

JOBFINDER_URL="${JOBFINDER_URL:-http://localhost:3456}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load secret from env file if available
if [ -f /opt/docker/secrets/.jobfinder.env ]; then
  source /opt/docker/secrets/.jobfinder.env
fi

if [ -z "${JOBFINDER_CRON_SECRET:-}" ]; then
  echo "[$(date -Iseconds)] ERROR: JOBFINDER_CRON_SECRET not set"
  exit 1
fi

echo "[$(date -Iseconds)] Starting scrape..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$JOBFINDER_URL/api/scrape" \
  -H "Authorization: Bearer ${JOBFINDER_CRON_SECRET}" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "[$(date -Iseconds)] Scrape completed: $BODY"
else
  echo "[$(date -Iseconds)] ERROR: HTTP $HTTP_CODE — $BODY"
  exit 1
fi
