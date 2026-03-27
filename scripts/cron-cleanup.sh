#!/bin/bash
# Archive vacancies older than 30 days (daily at 3:00)
# Crontab: 0 3 * * * /opt/repos/taras-code/jf-private/scripts/cron-cleanup.sh >> /var/log/jobfinder-cleanup.log 2>&1

set -euo pipefail

JOBFINDER_URL="${JOBFINDER_URL:-http://localhost:3456}"

if [ -f /opt/docker/secrets/.jobfinder.env ]; then
  source /opt/docker/secrets/.jobfinder.env
fi

if [ -z "${JOBFINDER_CRON_SECRET:-}" ]; then
  echo "[$(date -Iseconds)] ERROR: JOBFINDER_CRON_SECRET not set"
  exit 1
fi

echo "[$(date -Iseconds)] Running vacancy cleanup..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$JOBFINDER_URL/api/vacancies-cleanup" \
  -H "Authorization: Bearer ${JOBFINDER_CRON_SECRET}" \
  --max-time 60)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "[$(date -Iseconds)] Cleanup done: $BODY"
else
  echo "[$(date -Iseconds)] ERROR: HTTP $HTTP_CODE — $BODY"
fi
