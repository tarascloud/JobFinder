/**
 * Prompt injection guard for LLM user input.
 *
 * Detects common prompt injection patterns (instruction override, system prompt
 * leaks, ChatML / Llama template escapes) and provides helpers to safely wrap
 * user-provided content before sending it to the model.
 *
 * Created: REV-20260419-0046
 */

const INJECTION_PATTERNS: RegExp[] = [
  // "ignore previous instructions" / "ignore all prior rules" / "IGNORE ALL PRIOR RULES"
  // Allow one or more override modifiers (previous|prior|all|above|your|the|my|safety|current) before the noun.
  /ignore\s+(?:(?:previous|prior|all|above|your|the|my|safety|current)\s+)+(?:instruction|prompt|rule|safety|system|directive)/i,
  /system[:\s]*(?:you\s+are|ignore|override)/i,
  /disregard\s+(?:previous|all|your|prior|above|any)/i,
  /reveal\s+(?:your|the)\s+(?:system\s+)?prompt/i,
  /show\s+me\s+(?:your|the)\s+(?:instructions|prompt|system)/i,
  /\[INST\]|\[\/INST\]/i, // Llama-style
  /<\|im_start\|>|<\|im_end\|>/i, // ChatML
];

/**
 * Returns true if the user text looks like a prompt-injection attempt.
 * Callers should reject such requests with HTTP 400.
 */
export function isLikelyPromptInjection(text: string): boolean {
  if (!text) return false;
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

/**
 * Basic sanitizer: trims overly long inputs to prevent token-exhaustion
 * attacks and keeps model context windows predictable.
 */
export function sanitizeUserInput(text: string, maxLength = 10000): string {
  if (!text) return "";
  if (text.length > maxLength) return text.slice(0, maxLength);
  return text;
}

/**
 * Wraps user content in `<user_input>` tags so the system prompt can instruct
 * the model to treat anything inside those tags as data, not as instructions.
 */
export function wrapUserContent(text: string): string {
  return `<user_input>\n${text}\n</user_input>`;
}
