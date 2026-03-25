import { callAI } from "@/lib/ai/provider";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  uk: "Ukrainian",
  es: "Spanish",
};

function langName(code: string): string {
  return LANG_NAMES[code] || code;
}

/**
 * Translate a single text string from one language to another via AI.
 * Returns the original text if fromLang === toLang.
 */
export async function translateText(
  text: string,
  fromLang: string,
  toLang: string,
  userId?: number
): Promise<string> {
  if (fromLang === toLang) return text;
  if (!text.trim()) return text;

  const result = await callAI(
    `Translate the following text from ${langName(fromLang)} to ${langName(toLang)}. Return ONLY the translated text, nothing else. Do not add any explanations, notes, or formatting.\n\nText: ${text}`,
    { userId }
  );
  return result.trim();
}

/**
 * Translate a Q&A pair (question + answer) from one language to another.
 */
export async function translateQAPair(
  question: string,
  answer: string,
  fromLang: string,
  toLang: string,
  userId?: number
): Promise<{ question: string; answer: string }> {
  if (fromLang === toLang) return { question, answer };

  const result = await callAI(
    `Translate the following Q&A pair from ${langName(fromLang)} to ${langName(toLang)}. Return ONLY valid JSON with "question" and "answer" fields, nothing else.\n\nQuestion: ${question}\nAnswer: ${answer}`,
    { userId }
  );

  try {
    const parsed = JSON.parse(result.trim());
    return {
      question: parsed.question || question,
      answer: parsed.answer || answer,
    };
  } catch {
    // Fallback: translate individually
    const [tQ, tA] = await Promise.all([
      translateText(question, fromLang, toLang, userId),
      answer ? translateText(answer, fromLang, toLang, userId) : Promise.resolve(""),
    ]);
    return { question: tQ, answer: tA };
  }
}

/**
 * Translate profile fields (headline, summary).
 * Skips skills, URLs, and numeric fields.
 */
export async function translateProfile(
  profile: Record<string, string>,
  fromLang: string,
  toLang: string,
  userId?: number
): Promise<Record<string, string>> {
  if (fromLang === toLang) return profile;

  const translatableKeys = ["headline", "summary"];
  const result = { ...profile };

  const translations = await Promise.all(
    translatableKeys
      .filter((key) => profile[key]?.trim())
      .map(async (key) => ({
        key,
        value: await translateText(profile[key], fromLang, toLang, userId),
      }))
  );

  for (const { key, value } of translations) {
    result[key] = value;
  }

  return result;
}
