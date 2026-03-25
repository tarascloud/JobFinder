#!/bin/bash
# Generate Ollama Modelfile for jf-assistant
# Usage: bash scripts/create-modelfile.sh [output_path]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="${1:-$SCRIPT_DIR/Modelfile}"
TRAINING_DATA="$SCRIPT_DIR/training-data/feedback-positive.jsonl"

# Base system prompt
SYSTEM_PROMPT='You are JobFinder AI, an expert career coach and recruiter. You analyze resumes and generate:
- Professional profiles with headline, summary, skills, experience
- Job search strategies targeting different markets (EU, US, remote)
- Interview Q&A pairs personalized to the candidate'\''s experience
- Cover letters in the language of the job posting
- Resume improvement recommendations
- Company research and interview preparation notes

Always return valid JSON when asked. Be specific and personalized based on the actual resume content.
Focus on quantifiable achievements and relevant keywords.
When generating content in a specific language, maintain professional tone appropriate for that language'\''s job market.'

# If we have positive training examples, append them as few-shot guidance
EXAMPLES=""
if [ -f "$TRAINING_DATA" ] && [ -s "$TRAINING_DATA" ]; then
    LIKED_COUNT=$(wc -l < "$TRAINING_DATA" | tr -d ' ')
    echo "Found $LIKED_COUNT positive examples in training data"

    # Extract up to 5 best examples for each field type as few-shot guidance
    EXAMPLES=$'\n\nHere are examples of high-quality outputs that users preferred:'

    # Get unique fields
    FIELDS=$(python3 -c "
import json, sys
fields = set()
with open('$TRAINING_DATA') as f:
    for line in f:
        data = json.loads(line)
        for msg in data.get('messages', []):
            if msg['role'] == 'user':
                fields.add(msg['content'].split('.')[0][:80])
                break
for field in sorted(fields):
    print(field)
" 2>/dev/null || true)

    if [ -n "$FIELDS" ]; then
        EXAMPLES+=$'\n'
        # Take first 3 positive examples as style guidance
        EXAMPLES+=$(python3 -c "
import json
examples = []
with open('$TRAINING_DATA') as f:
    for i, line in enumerate(f):
        if i >= 3:
            break
        data = json.loads(line)
        msgs = data.get('messages', [])
        user_msg = next((m['content'] for m in msgs if m['role'] == 'user'), '')
        assistant_msg = next((m['content'] for m in msgs if m['role'] == 'assistant'), '')
        if user_msg and assistant_msg:
            # Truncate long examples
            preview = assistant_msg[:200] + '...' if len(assistant_msg) > 200 else assistant_msg
            examples.append(f'Task: {user_msg[:100]}\nGood output style: {preview}')
print('\n\n'.join(examples))
" 2>/dev/null || true)
    fi
else
    echo "No training data found yet — using default system prompt"
fi

# Also check for dislike patterns to add negative guidance
FEEDBACK_STATS="$SCRIPT_DIR/training-data/feedback-stats.json"
NEGATIVE_GUIDANCE=""
if [ -f "$FEEDBACK_STATS" ]; then
    NEGATIVE_GUIDANCE=$(python3 -c "
import json
with open('$FEEDBACK_STATS') as f:
    stats = json.load(f)
comments = []
for field, data in stats.get('by_field', {}).items():
    for c in data.get('examples', [])[:2]:
        if c:
            comments.append(f'- Avoid: {c} (in {field})')
if comments:
    print('\n\nCommon user complaints to avoid:\n' + '\n'.join(comments[:5]))
" 2>/dev/null || true)
fi

FULL_PROMPT="${SYSTEM_PROMPT}${EXAMPLES}${NEGATIVE_GUIDANCE}"

cat > "$OUTPUT" << MODELFILE
FROM qwen2.5:14b-instruct-q4_K_M

SYSTEM """${FULL_PROMPT}"""

PARAMETER temperature 0.3
PARAMETER num_ctx 8192
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1
MODELFILE

echo "Modelfile created at: $OUTPUT"
echo "System prompt length: ${#FULL_PROMPT} chars"
