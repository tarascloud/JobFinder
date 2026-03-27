#!/bin/bash
# Run by cron on Mini at 18:00 CET (Mon-Fri)
# Triggers Playwright-based auto-apply for all approved applications via API
#
# Crontab entry (on Mini — uses TZ for automatic CET/CEST handling):
#   CRON_TZ=Europe/Berlin
#   0 18 * * 1-5 /opt/repos/taras-code/jf-private/scripts/cron-apply.sh >> /var/log/jobfinder-apply.log 2>&1
#
# This runs at 18:00 CET (17:00 UTC winter) / 18:00 CEST (16:00 UTC summer) automatically.
#
# Setup on Mini:
#   crontab -e
#   Add the two lines above (CRON_TZ + schedule)
#
# Requires: JOBFINDER_CRON_SECRET in /opt/docker/secrets/.jobfinder.env

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

echo "[$(date -Iseconds)] Starting apply queue processing..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$JOBFINDER_URL/api/apply" \
  -H "Authorization: Bearer ${JOBFINDER_CRON_SECRET}" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "[$(date -Iseconds)] Apply completed: $BODY"
else
  echo "[$(date -Iseconds)] ERROR: HTTP $HTTP_CODE — $BODY"
  exit 1
fi
