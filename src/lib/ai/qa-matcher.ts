import { callGeminiJSON } from "./gemini";

interface QaPairInput {
  question: string;
  answer: string;
}

interface MatchResult {
  matched: boolean;
  answer?: string;
  confidence: number;
}

export async function matchQuestion(
  question: string,
  existingQA: QaPairInput[]
): Promise<MatchResult> {
  if (existingQA.length === 0) {
    return { matched: false, confidence: 0 };
  }

  const qaList = existingQA
    .map((qa, i) => `[${i}] Q: ${qa.question}\n    A: ${qa.answer}`)
    .join("\n");

  const prompt = `You are a screening question matcher. Given a new question from a job application, determine if any existing Q&A pair answers it (semantic match, not exact).

New question: "${question}"

Existing Q&A pairs:
${qaList}

Return JSON: { "matched": true/false, "index": number or -1, "confidence": 0.0-1.0 }
- "matched": true if a semantically similar question exists with confidence >= 0.7
- "index": the index of the best matching Q&A pair, or -1 if no match
- "confidence": how confident you are that the existing answer applies (0.0-1.0)`;

  const result = await callGeminiJSON<{
    matched: boolean;
    index: number;
    confidence: number;
  }>(prompt);

  const confidence = Math.max(0, Math.min(1, result.confidence));

  if (result.matched && result.index >= 0 && result.index < existingQA.length && confidence >= 0.7) {
    return {
      matched: true,
      answer: existingQA[result.index].answer,
      confidence,
    };
  }

  return { matched: false, confidence };
}
