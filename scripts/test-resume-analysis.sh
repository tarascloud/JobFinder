#!/bin/bash
# Test jf-assistant model with a real resume analysis
# Usage: bash scripts/test-resume-analysis.sh

set -euo pipefail

OLLAMA_HOST="${OLLAMA_HOST:-localhost}"
OLLAMA_PORT="9002"
MODEL="jf-assistant"

echo "=== Testing jf-assistant model ==="
echo ""

# Step 1: Check model exists
echo "--- Checking model availability ---"
MODELS=$(ssh mini "curl -s http://localhost:${OLLAMA_PORT}/api/tags" | python3 -c "
import sys, json
data = json.load(sys.stdin)
models = [m['name'] for m in data.get('models', [])]
print('\n'.join(models))
") || true

if echo "$MODELS" | grep -q "$MODEL"; then
    echo "Model '$MODEL' is available"
else
    echo "WARNING: Model '$MODEL' not found. Available models:"
    echo "$MODELS"
    echo ""
    echo "Run 'bash scripts/train-jf-model.sh' first to create the model."
    exit 1
fi
echo ""

# Step 2: Test with a sample resume
echo "--- Test 1: Resume profile generation ---"
RESUME_TEXT="Taras Pedchenko - Engineering Leader & Cloud Architect. 15+ years of software engineering experience. Currently Principal Engineer at Intellias (2021-present) leading cloud transformation for Fortune 500 clients. Previously Senior Engineer at Forte Group (2018-2021), built microservices platform serving 2M daily users. Tech stack: TypeScript, React, Node.js, Python, AWS, GCP, Kubernetes, PostgreSQL, Redis. Education: MSc Computer Science. Languages: English (fluent), Ukrainian (native), Spanish (B2)."

PROMPT="Analyze this resume and return a JSON object with these fields: headline (string), summary (string, 2-3 sentences), skills (array of strings), searchProfiles (array of {title, keywords[], location}).

Resume:
$RESUME_TEXT"

RESPONSE=$(ssh mini "curl -s http://localhost:${OLLAMA_PORT}/api/generate --max-time 120 -d $(echo "{\"model\":\"$MODEL\",\"prompt\":$(echo "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),\"stream\":false}" | python3 -c 'import json,sys; print(json.dumps(json.loads(sys.stdin.read())))')" | python3 -c "import sys,json; print(json.load(sys.stdin).get('response','ERROR'))" 2>&1) || RESPONSE="FAILED"

echo "Response:"
echo "$RESPONSE" | head -30
echo ""

# Step 3: Test cover letter generation
echo "--- Test 2: Cover letter generation ---"
COVER_PROMPT="Generate a cover letter for this job application. Write in English, professional tone, 3 paragraphs.

Candidate: Senior Software Engineer, 10 years experience in cloud architecture and distributed systems.
Job: Staff Engineer at Stripe - Building payment infrastructure at scale. Requirements: distributed systems, API design, team leadership."

COVER_RESPONSE=$(ssh mini "curl -s http://localhost:${OLLAMA_PORT}/api/generate --max-time 120 -d $(echo "{\"model\":\"$MODEL\",\"prompt\":$(echo "$COVER_PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),\"stream\":false}" | python3 -c 'import json,sys; print(json.dumps(json.loads(sys.stdin.read())))')" | python3 -c "import sys,json; print(json.load(sys.stdin).get('response','ERROR'))" 2>&1) || COVER_RESPONSE="FAILED"

echo "Response:"
echo "$COVER_RESPONSE" | head -20
echo ""

# Step 4: Test Q&A generation
echo "--- Test 3: Interview Q&A ---"
QA_PROMPT='Generate 3 interview Q&A pairs as JSON array: [{"question": "...", "answer": "..."}]. Topic: system design and distributed systems. Candidate has 10 years experience building microservices.'

QA_RESPONSE=$(ssh mini "curl -s http://localhost:${OLLAMA_PORT}/api/generate --max-time 120 -d $(echo "{\"model\":\"$MODEL\",\"prompt\":$(echo "$QA_PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),\"stream\":false}" | python3 -c 'import json,sys; print(json.dumps(json.loads(sys.stdin.read())))')" | python3 -c "import sys,json; print(json.load(sys.stdin).get('response','ERROR'))" 2>&1) || QA_RESPONSE="FAILED"

echo "Response:"
echo "$QA_RESPONSE" | head -30
echo ""

echo "=== Tests complete ==="
