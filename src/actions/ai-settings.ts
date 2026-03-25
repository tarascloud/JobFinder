"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { testOllamaConnection } from "@/lib/ai/ollama";
import { testGroqConnection } from "@/lib/ai/groq";

export type AIProvider = "ollama" | "gemini" | "groq";

export interface AISettingsData {
  provider: AIProvider;
  ollamaUrl: string;
  ollamaModel: string;
  geminiApiKey: string | null;
  groqApiKey: string | null;
}

export async function getAISettings(): Promise<AISettingsData> {
  try {
    const user = await requireUser();
    if (user.id === 0) {
      return {
        provider: "ollama",
        ollamaUrl: "http://ollama:11434",
        ollamaModel: "qwen2.5:14b-instruct-q4_K_M",
        geminiApiKey: null,
        groqApiKey: null,
      };
    }

    const settings = await prisma.userAISettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings) {
      return {
        provider: process.env.GEMINI_API_KEY ? "gemini" : "ollama",
        ollamaUrl: process.env.OLLAMA_URL || "http://ollama:11434",
        ollamaModel: process.env.OLLAMA_MODEL || "qwen2.5:14b-instruct-q4_K_M",
        geminiApiKey: null,
        groqApiKey: null,
      };
    }

    return {
      provider: settings.provider as AIProvider,
      ollamaUrl: settings.ollamaUrl,
      ollamaModel: settings.ollamaModel,
      geminiApiKey: settings.geminiApiKey ? "••••••••" : null,
      groqApiKey: settings.groqApiKey ? "••••••••" : null,
    };
  } catch {
    return {
      provider: "ollama",
      ollamaUrl: "http://ollama:11434",
      ollamaModel: "qwen2.5:14b-instruct-q4_K_M",
      geminiApiKey: null,
      groqApiKey: null,
    };
  }
}

export async function updateAISettings(data: {
  provider: AIProvider;
  ollamaUrl: string;
  ollamaModel: string;
  geminiApiKey?: string | null;
  groqApiKey?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser();
    if (user.id === 0) return { success: false, error: "Demo mode" };

    // Don't overwrite keys if masked value sent back
    const existing = await prisma.userAISettings.findUnique({
      where: { userId: user.id },
    });

    const geminiApiKey =
      data.geminiApiKey === "••••••••"
        ? existing?.geminiApiKey ?? null
        : data.geminiApiKey ?? null;
    const groqApiKey =
      data.groqApiKey === "••••••••"
        ? existing?.groqApiKey ?? null
        : data.groqApiKey ?? null;

    await prisma.userAISettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        provider: data.provider,
        ollamaUrl: data.ollamaUrl,
        ollamaModel: data.ollamaModel,
        geminiApiKey,
        groqApiKey,
      },
      update: {
        provider: data.provider,
        ollamaUrl: data.ollamaUrl,
        ollamaModel: data.ollamaModel,
        geminiApiKey,
        groqApiKey,
      },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function testAIConnection(
  provider: AIProvider,
  config?: { ollamaUrl?: string; geminiApiKey?: string; groqApiKey?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (provider) {
      case "ollama": {
        const ok = await testOllamaConnection(config?.ollamaUrl);
        return ok
          ? { success: true }
          : { success: false, error: "Cannot reach Ollama" };
      }
      case "gemini": {
        // Resolve actual key: if masked, load from DB
        let key = config?.geminiApiKey;
        if (key === "••••••••") {
          const user = await requireUser();
          const settings = await prisma.userAISettings.findUnique({
            where: { userId: user.id },
          });
          key = settings?.geminiApiKey ?? undefined;
        }
        const actualKey = key || process.env.GEMINI_API_KEY;
        if (!actualKey) return { success: false, error: "No Gemini API key" };
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${actualKey}`,
          { signal: AbortSignal.timeout(5000) }
        );
        return resp.ok
          ? { success: true }
          : { success: false, error: `Gemini API: ${resp.status}` };
      }
      case "groq": {
        let key = config?.groqApiKey;
        if (key === "••••••••") {
          const user = await requireUser();
          const settings = await prisma.userAISettings.findUnique({
            where: { userId: user.id },
          });
          key = settings?.groqApiKey ?? undefined;
        }
        const actualKey = key || process.env.GROQ_API_KEY;
        const ok = await testGroqConnection(actualKey);
        return ok
          ? { success: true }
          : { success: false, error: "Cannot reach Groq" };
      }
      default:
        return { success: false, error: "Unknown provider" };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection test failed",
    };
  }
}
