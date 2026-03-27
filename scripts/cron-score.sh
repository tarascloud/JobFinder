#!/bin/bash
# Run by cron on Mini after scraping (e.g., 17:15 CET)
# Triggers batch scoring for unscored vacancies via API
# Loops until all vacancies are scored or max iterations reached
#
# Crontab entry (on Mini):
#   15 17 * * * /opt/repos/taras-code/jf-private/scripts/cron-score.sh >> /var/log/jobfinder-score.log 2>&1

set -euo pipefail

JOBFINDER_URL="${JOBFINDER_URL:-http://localhost:3456}"
MAX_ITERATIONS=20

# Load secret from env file if available
if [ -f /opt/docker/secrets/.jobfinder.env ]; then
  source /opt/docker/secrets/.jobfinder.env
fi

if [ -z "${JOBFINDER_CRON_SECRET:-}" ]; then
  echo "[$(date -Iseconds)] ERROR: JOBFINDER_CRON_SECRET not set"
  exit 1
fi

echo "[$(date -Iseconds)] Starting batch scoring..."

TOTAL_SCORED=0
TOTAL_FAILED=0
ITERATION=0

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$JOBFINDER_URL/api/score-batch" \
    -H "Authorization: Bearer ${JOBFINDER_CRON_SECRET}" \
    -H "Content-Type: application/json")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" -ne 200 ]; then
    echo "[$(date -Iseconds)] ERROR: HTTP $HTTP_CODE — $BODY"
    exit 1
  fi

  SCORED=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scored',0))" 2>/dev/null || echo "0")
  FAILED=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('failed',0))" 2>/dev/null || echo "0")
  REMAINING=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('remaining',0))" 2>/dev/null || echo "0")

  TOTAL_SCORED=$((TOTAL_SCORED + SCORED))
  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))

  echo "[$(date -Iseconds)] Iteration $ITERATION: scored=$SCORED, failed=$FAILED, remaining=$REMAINING"

  if [ "$REMAINING" -eq 0 ] || [ "$SCORED" -eq 0 ]; then
    break
  fi

  # Brief pause between batches
  sleep 2
done

echo "[$(date -Iseconds)] Batch scoring complete: total_scored=$TOTAL_SCORED, total_failed=$TOTAL_FAILED, iterations=$ITERATION"
