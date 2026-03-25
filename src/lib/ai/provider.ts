import { prisma } from "@/lib/db";
import { callGemini, callGeminiJSON } from "./gemini";
import { callOllama, callOllamaJSON } from "./ollama";
import { callGroq, callGroqJSON } from "./groq";

export type AIProvider = "ollama" | "gemini" | "groq";

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
    return settings as AISettings | null;
  } catch {
    return null;
  }
}

function getDefaultProvider(): AIProvider {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GROQ_API_KEY) return "groq";
  return "ollama";
}

export async function callAI(
  prompt: string,
  options?: { userId?: number; systemPrompt?: string }
): Promise<string> {
  const settings = await getUserAISettings(options?.userId);
  const provider = settings?.provider || getDefaultProvider();

  // Try preferred provider first, then fallback chain
  const providers: AIProvider[] = [provider];
  if (!providers.includes("gemini")) providers.push("gemini");
  if (!providers.includes("ollama")) providers.push("ollama");
  if (!providers.includes("groq")) providers.push("groq");

  let lastError: Error | null = null;

  for (const p of providers) {
    try {
      switch (p) {
        case "gemini": {
          const key = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
          if (!key) continue;
          // callGemini uses process.env.GEMINI_API_KEY internally
          // If user has a custom key, we'd need to pass it — for now env-based
          return await callGemini(prompt, options?.systemPrompt);
        }
        case "ollama": {
          return await callOllama(prompt, {
            url: settings?.ollamaUrl,
            model: settings?.ollamaModel,
            systemPrompt: options?.systemPrompt,
          });
        }
        case "groq": {
          const key = settings?.groqApiKey || process.env.GROQ_API_KEY;
          if (!key) continue;
          return await callGroq(prompt, {
            apiKey: key,
            systemPrompt: options?.systemPrompt,
          });
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  throw lastError || new Error("No AI provider available");
}

export async function callAIJSON<T>(
  prompt: string,
  options?: { userId?: number; systemPrompt?: string }
): Promise<T> {
  const settings = await getUserAISettings(options?.userId);
  const provider = settings?.provider || getDefaultProvider();

  const providers: AIProvider[] = [provider];
  if (!providers.includes("gemini")) providers.push("gemini");
  if (!providers.includes("ollama")) providers.push("ollama");
  if (!providers.includes("groq")) providers.push("groq");

  let lastError: Error | null = null;

  for (const p of providers) {
    try {
      console.log(`[callAIJSON] Trying provider: ${p}`);
      switch (p) {
        case "gemini": {
          const key = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
          if (!key) {
            console.log("[callAIJSON] Skipping gemini — no API key");
            continue;
          }
          return await callGeminiJSON<T>(prompt, options?.systemPrompt);
        }
        case "ollama": {
          return await callOllamaJSON<T>(prompt, {
            url: settings?.ollamaUrl,
            model: settings?.ollamaModel,
            systemPrompt: options?.systemPrompt,
          });
        }
        case "groq": {
          const key = settings?.groqApiKey || process.env.GROQ_API_KEY;
          if (!key) {
            console.log("[callAIJSON] Skipping groq — no API key");
            continue;
          }
          return await callGroqJSON<T>(prompt, {
            apiKey: key,
            systemPrompt: options?.systemPrompt,
          });
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[callAIJSON] Provider ${p} failed:`, lastError.message);
      continue;
    }
  }

  throw lastError || new Error("No AI provider available");
}
