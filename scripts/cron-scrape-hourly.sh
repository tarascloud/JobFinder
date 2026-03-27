#!/bin/bash
# Run by cron on Mini every hour
# Triggers hourly scraping with rate limiting, night window check, and smart dedup
#
# Crontab entry (on Mini):
#   0 * * * * /opt/repos/taras-code/jf-private/scripts/cron-scrape-hourly.sh >> /var/log/jobfinder-scrape-hourly.log 2>&1

set -euo pipefail

JOBFINDER_URL="${JOBFINDER_URL:-http://localhost:3456}"

# Load secret from env file if available
if [ -f /opt/docker/secrets/.jobfinder.env ]; then
  source /opt/docker/secrets/.jobfinder.env
fi

if [ -z "${JOBFINDER_CRON_SECRET:-}" ]; then
  echo "[$(date -Iseconds)] ERROR: JOBFINDER_CRON_SECRET not set"
  exit 1
fi

echo "[$(date -Iseconds)] Starting hourly scrape..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$JOBFINDER_URL/api/scrape-hourly" \
  -H "Authorization: Bearer ${JOBFINDER_CRON_SECRET}" \
  -H "Content-Type: application/json" \
  --max-time 600)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "[$(date -Iseconds)] Hourly scrape completed: $BODY"
else
  echo "[$(date -Iseconds)] ERROR: HTTP $HTTP_CODE — $BODY"
  exit 1
fi
