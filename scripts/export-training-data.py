#!/usr/bin/env python3
"""
Export AI feedback data from JobFinder DB for model training.

Connects to PostgreSQL (jobfinder DB on Mini), exports liked/disliked
AI-generated content, and formats it as JSONL training data.

Usage:
    python3 scripts/export-training-data.py [--db-url URL] [--output PATH]

Environment:
    DATABASE_URL - PostgreSQL connection string (default: Mini jobfinder DB)
"""

import argparse
import json
import os
import sys
from datetime import datetime

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip3 install psycopg2-binary")
    sys.exit(1)


DEFAULT_DB_URL = "postgresql://jobfinder:jobfinder@192.168.1.150:5432/jobfinder"
DEFAULT_OUTPUT = os.path.join(os.path.dirname(__file__), "training-data", "feedback.jsonl")

# Maps feedback field names to training prompt templates
FIELD_PROMPTS = {
    "profile.headline": "Analyze the resume and generate a professional headline.",
    "profile.summary": "Analyze the resume and generate a professional summary.",
    "profile.skills": "Analyze the resume and extract key skills.",
    "cover_letter": "Generate a cover letter for this job application.",
    "qa.answer": "Generate an interview answer for this question.",
    "search.title": "Generate a job search profile title.",
    "search.keywords": "Generate job search keywords.",
    "email.response": "Generate a professional email response.",
    "company.research": "Research this company for interview preparation.",
    "interview.prep": "Prepare interview questions and answers.",
}


def get_prompt_for_field(field: str, context: str | None) -> str:
    """Build a training prompt from field type and optional context."""
    base = FIELD_PROMPTS.get(field, f"Generate content for: {field}")
    if context:
        return f"{base}\n\nContext: {context}"
    return base


def export_feedback(db_url: str, output_path: str) -> dict:
    """Export feedback from DB and write JSONL training data."""
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Fetch all feedback with user context
    cur.execute("""
        SELECT
            f.id,
            f.field,
            f.context,
            f.content,
            f.rating,
            f.comment,
            f.created_at,
            u.id as user_id
        FROM ai_feedback f
        JOIN users u ON u.id = f.user_id
        ORDER BY f.created_at ASC
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        print("No feedback data found in database.")
        return {"total": 0, "likes": 0, "dislikes": 0, "exported": 0}

    # Separate liked and disliked
    liked = [r for r in rows if r["rating"] == "like"]
    disliked = [r for r in rows if r["rating"] == "dislike"]

    print(f"Found {len(rows)} feedback entries: {len(liked)} likes, {len(disliked)} dislikes")

    # Create output directory
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    exported = 0

    with open(output_path, "w", encoding="utf-8") as f:
        # Export liked content as positive training examples
        for row in liked:
            prompt = get_prompt_for_field(row["field"], row["context"])
            entry = {
                "prompt": prompt,
                "completion": row["content"],
                "rating": "like",
                "field": row["field"],
                "feedback_id": row["id"],
                "timestamp": row["created_at"].isoformat() if isinstance(row["created_at"], datetime) else str(row["created_at"]),
            }
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            exported += 1

        # Export disliked content as negative examples (with user comment if available)
        for row in disliked:
            prompt = get_prompt_for_field(row["field"], row["context"])
            entry = {
                "prompt": prompt,
                "completion": row["content"],
                "rating": "dislike",
                "field": row["field"],
                "feedback_id": row["id"],
                "user_comment": row["comment"],
                "timestamp": row["created_at"].isoformat() if isinstance(row["created_at"], datetime) else str(row["created_at"]),
            }
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            exported += 1

    # Also export a "positive-only" file for system prompt enhancement
    positive_path = output_path.replace(".jsonl", "-positive.jsonl")
    with open(positive_path, "w", encoding="utf-8") as f:
        for row in liked:
            prompt = get_prompt_for_field(row["field"], row["context"])
            entry = {
                "messages": [
                    {"role": "system", "content": "You are JobFinder AI, an expert career coach and recruiter."},
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": row["content"]},
                ]
            }
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    # Generate stats by field
    stats_path = output_path.replace(".jsonl", "-stats.json")
    field_stats = {}
    for row in rows:
        field = row["field"]
        if field not in field_stats:
            field_stats[field] = {"likes": 0, "dislikes": 0, "examples": []}
        if row["rating"] == "like":
            field_stats[field]["likes"] += 1
        else:
            field_stats[field]["dislikes"] += 1
            if row["comment"]:
                field_stats[field]["examples"].append(row["comment"])

    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump({
            "exported_at": datetime.now().isoformat(),
            "total": len(rows),
            "likes": len(liked),
            "dislikes": len(disliked),
            "by_field": field_stats,
        }, f, indent=2, ensure_ascii=False)

    print(f"Exported {exported} entries to {output_path}")
    print(f"Positive-only examples: {positive_path}")
    print(f"Stats: {stats_path}")

    return {
        "total": len(rows),
        "likes": len(liked),
        "dislikes": len(disliked),
        "exported": exported,
    }


def main():
    parser = argparse.ArgumentParser(description="Export AI feedback for model training")
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL", DEFAULT_DB_URL),
                        help="PostgreSQL connection URL")
    parser.add_argument("--output", default=DEFAULT_OUTPUT,
                        help="Output JSONL file path")
    args = parser.parse_args()

    print(f"Connecting to: {args.db_url.split('@')[1] if '@' in args.db_url else args.db_url}")
    stats = export_feedback(args.db_url, args.output)

    print(f"\nDone. Total: {stats['total']}, Likes: {stats['likes']}, Dislikes: {stats['dislikes']}")

    if stats["likes"] == 0:
        print("\nWARNING: No positive feedback yet. Collect more 'like' ratings before training.")
        print("The model will use the default system prompt until sufficient feedback is collected.")


if __name__ == "__main__":
    main()
