"use server";

import { requireUser } from "@/lib/current-user";
import { translateText, translateQAPair } from "@/lib/ai/translator";

// Simple in-memory cache for translations
// Key format: `${userId}:${targetLang}:${hash}`
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

function cacheKey(userId: number, targetLang: string, text: string): string {
  // Simple hash based on first/last chars and length for quick lookup
  const shortHash = `${text.length}:${text.slice(0, 30)}:${text.slice(-20)}`;
  return `${userId}:${targetLang}:${shortHash}`;
}

function setCache(key: string, value: string) {
  if (translationCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    const firstKey = translationCache.keys().next().value;
    if (firstKey) translationCache.delete(firstKey);
  }
  translationCache.set(key, value);
}

/**
 * Get a translation for a text, using cache first.
 * fromLang defaults to "en" (job content is in English).
 */
export async function getTranslation(
  text: string,
  targetLang: string,
  fromLang: string = "en"
): Promise<string> {
  if (fromLang === targetLang) return text;
  if (!text.trim()) return text;

  try {
    const user = await requireUser();
    const key = cacheKey(user.id, targetLang, text);

    const cached = translationCache.get(key);
    if (cached) return cached;

    const translated = await translateText(text, fromLang, targetLang, user.id);
    setCache(key, translated);
    return translated;
  } catch (e) {
    console.error("[getTranslation] error:", e);
    return text; // Return original on error
  }
}

/**
 * Translate a Q&A pair with caching.
 */
export async function getQATranslation(
  question: string,
  answer: string,
  targetLang: string,
  fromLang: string = "en"
): Promise<{ question: string; answer: string }> {
  if (fromLang === targetLang) return { question, answer };

  try {
    const user = await requireUser();
    const qKey = cacheKey(user.id, targetLang, `q:${question}`);
    const aKey = cacheKey(user.id, targetLang, `a:${answer}`);

    const cachedQ = translationCache.get(qKey);
    const cachedA = translationCache.get(aKey);

    if (cachedQ && cachedA) {
      return { question: cachedQ, answer: cachedA };
    }

    const translated = await translateQAPair(
      question,
      answer || "",
      fromLang,
      targetLang,
      user.id
    );

    setCache(qKey, translated.question);
    setCache(aKey, translated.answer);

    return translated;
  } catch (e) {
    console.error("[getQATranslation] error:", e);
    return { question, answer };
  }
}

/**
 * Translate a vacancy description.
 */
export async function getDescriptionTranslation(
  description: string,
  targetLang: string,
  fromLang?: string
): Promise<string> {
  // Vacancy descriptions can be long; translate as-is
  return getTranslation(description, targetLang, fromLang || "en");
}

/**
 * Batch translate multiple texts.
 */
export async function getBatchTranslation(
  texts: string[],
  targetLang: string,
  fromLang: string = "en"
): Promise<string[]> {
  return Promise.all(
    texts.map((text) => getTranslation(text, targetLang, fromLang))
  );
}
