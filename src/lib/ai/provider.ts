import { prisma } from "@/lib/db";
import { callGemini, callGeminiJSON } from "./gemini";
import { callOllama, callOllamaJSON } from "./ollama";
import { callGroq, callGroqJSON } from "./groq";
import { decryptGraceful } from "@/lib/encryption";

export type AIProvider = "ollama" | "gemini" | "groq" | "jf_groq";

interface AISettings {
  provider: AIProvider;
  ollamaUrl: string;
  ollamaModel: string;
  geminiApiKey: string | null;
  groqApiKey: string | null;
}

async function getUserAISettings(
  userId?: number
): Promise<AISettings | null> {
  if (!userId || userId === 0) return null;
  try {
    const settings = await prisma.userAISettings.findUnique({
      where: { userId },
    });
    if (!settings) return null;
    // Decrypt API keys stored as AES-256-GCM ciphertext
    return {
      ...settings,
      provider: settings.provider as AIProvider,
      geminiApiKey: settings.geminiApiKey
        ? decryptGraceful(settings.geminiApiKey)
        : null,
      groqApiKey: settings.groqApiKey
        ? decryptGraceful(settings.groqApiKey)
        : null,
    };
  } catch {
    return null;
  }
}

function getDefaultProvider(): AIProvider {
  if (process.env.JF_GROQ_API_KEY || process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "ollama";
}

interface ProviderCallFns<T> {
  gemini: (prompt: string, systemPrompt?: string, key?: string) => Promise<T>;
  ollama: (
    prompt: string,
    opts: { url?: string; model?: string; systemPrompt?: string }
  ) => Promise<T>;
  groq: (
    prompt: string,
    opts: { apiKey: string; systemPrompt?: string }
  ) => Promise<T>;
}

async function callAIWithFallback<T>(
  prompt: string,
  fns: ProviderCallFns<T>,
  options?: { userId?: number; systemPrompt?: string },
  logLabel?: string
): Promise<T> {
  const settings = await getUserAISettings(options?.userId);
  const rawProvider = settings?.provider || getDefaultProvider();
  // jf_groq is treated as groq internally
  const provider: AIProvider = rawProvider === "jf_groq" ? "groq" : rawProvider;

  // Try preferred provider first, then fallback chain
  const providers: AIProvider[] = [provider];
  if (!providers.includes("groq")) providers.push("groq");
  if (!providers.includes("gemini")) providers.push("gemini");
  if (!providers.includes("ollama")) providers.push("ollama");

  let lastError: Error | null = null;

  for (const p of providers) {
    try {
      if (logLabel) console.log(`[${logLabel}] Trying provider: ${p}`);
      switch (p) {
        case "gemini": {
          const key = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
          if (!key) {
            if (logLabel)
              console.log(`[${logLabel}] Skipping gemini — no API key`);
            continue;
          }
          return await fns.gemini(prompt, options?.systemPrompt, key);
        }
        case "ollama": {
          return await fns.ollama(prompt, {
            url: settings?.ollamaUrl,
            model: settings?.ollamaModel,
            systemPrompt: options?.systemPrompt,
          });
        }
        case "groq": {
          const key = settings?.groqApiKey || process.env.JF_GROQ_API_KEY || process.env.GROQ_API_KEY;
          if (!key) {
            if (logLabel)
              console.log(`[${logLabel}] Skipping groq — no API key`);
            continue;
          }
          return await fns.groq(prompt, {
            apiKey: key,
            systemPrompt: options?.systemPrompt,
          });
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (logLabel)
        console.error(`[${logLabel}] Provider ${p} failed:`, lastError.message);
      continue;
    }
  }

  throw lastError || new Error("No AI provider available");
}

export async function callAI(
  prompt: string,
  options?: { userId?: number; systemPrompt?: string }
): Promise<string> {
  return callAIWithFallback(
    prompt,
    { gemini: callGemini, ollama: callOllama, groq: callGroq },
    options
  );
}

export async function callAIJSON<T>(
  prompt: string,
  options?: { userId?: number; systemPrompt?: string }
): Promise<T> {
  return callAIWithFallback<T>(
    prompt,
    {
      gemini: callGeminiJSON,
      ollama: callOllamaJSON,
      groq: callGroqJSON,
    },
    options,
    "callAIJSON"
  );
}
