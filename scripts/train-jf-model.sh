#!/bin/bash
# JobFinder AI model training pipeline
# Exports feedback data, creates Modelfile, deploys to Ollama on Mini
#
# Usage: bash scripts/train-jf-model.sh
# Requirements: psycopg2-binary (pip3 install psycopg2-binary), ssh access to Mini

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== JobFinder AI Training Pipeline ==="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Step 1: Export training data from DB
echo "--- Step 1: Exporting training data from DB ---"
cd "$PROJECT_DIR"
python3 scripts/export-training-data.py
echo ""

# Step 2: Create the Modelfile with system prompt + few-shot examples
echo "--- Step 2: Creating Modelfile ---"
bash scripts/create-modelfile.sh
echo ""

# Step 3: Copy Modelfile to Mini
echo "--- Step 3: Deploying to Mini ---"
scp scripts/Modelfile "${OLLAMA_HOST:-mini}":/tmp/Modelfile
echo "Modelfile copied to Mini:/tmp/Modelfile"

# Step 4: Create model in Ollama
echo "Creating jf-assistant model in Ollama..."
ssh mini 'docker cp /tmp/Modelfile ollama:/tmp/Modelfile && docker exec ollama ollama create jf-assistant -f /tmp/Modelfile'
echo "Model created successfully"
echo ""

# Step 5: Test the model
echo "--- Step 4: Testing model ---"
RESPONSE=$(ssh mini 'curl -s http://localhost:9002/api/generate -d "{\"model\":\"jf-assistant\",\"prompt\":\"Analyze this resume excerpt and return a JSON with headline and summary fields: Senior Software Engineer with 10 years of experience in distributed systems, cloud architecture (AWS, GCP), and team leadership. Led migration of monolith to microservices serving 5M users.\",\"stream\":false}" --max-time 120' | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('response','NO RESPONSE')[:500])" 2>&1) || true

if [ -n "$RESPONSE" ] && [ "$RESPONSE" != "NO RESPONSE" ]; then
    echo "Model response (first 500 chars):"
    echo "$RESPONSE"
    echo ""
    echo "=== Training pipeline completed successfully ==="
else
    echo "WARNING: Model did not respond or timed out."
    echo "Check Ollama status: ssh mini 'docker exec ollama ollama list'"
    echo ""
    echo "=== Training pipeline completed with warnings ==="
fi

# Show stats
echo ""
echo "Training data stats:"
if [ -f "$SCRIPT_DIR/training-data/feedback-stats.json" ]; then
    python3 -c "
import json
with open('$SCRIPT_DIR/training-data/feedback-stats.json') as f:
    stats = json.load(f)
print(f\"  Total feedback: {stats['total']}\")
print(f\"  Likes: {stats['likes']}\")
print(f\"  Dislikes: {stats['dislikes']}\")
for field, data in stats.get('by_field', {}).items():
    print(f\"  {field}: {data['likes']} likes, {data['dislikes']} dislikes\")
"
else
    echo "  No stats file found (no feedback data yet)"
fi
