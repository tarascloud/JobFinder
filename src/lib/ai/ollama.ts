// Cache for model availability check (TTL: 5 minutes)
let jfAssistantAvailable: boolean | null = null;
let jfAssistantCheckedAt = 0;
const MODEL_CHECK_TTL = 5 * 60 * 1000;

/**
 * Check if jf-assistant model is available in Ollama.
 * Result is cached for 5 minutes to avoid repeated API calls.
 */
export async function isJfAssistantAvailable(url?: string): Promise<boolean> {
  const now = Date.now();
  if (jfAssistantAvailable !== null && now - jfAssistantCheckedAt < MODEL_CHECK_TTL) {
    return jfAssistantAvailable;
  }

  const baseUrl = url || process.env.OLLAMA_URL || "http://ollama:11434";
  try {
    const resp = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      jfAssistantAvailable = false;
      jfAssistantCheckedAt = now;
      return false;
    }
    const data = await resp.json();
    const models: { name: string }[] = data.models || [];
    jfAssistantAvailable = models.some((m) => m.name.startsWith("jf-assistant"));
    jfAssistantCheckedAt = now;
    return jfAssistantAvailable;
  } catch {
    jfAssistantAvailable = false;
    jfAssistantCheckedAt = now;
    return false;
  }
}

/**
 * Resolve the best model to use: prefer jf-assistant if available,
 * then user-configured model, then default qwen2.5.
 */
async function resolveModel(options?: { model?: string; url?: string }): Promise<string> {
  if (options?.model) return options.model;
  // Always prefer jf-assistant (3B, fast) — fallback to env or default
  return "jf-assistant";
}

export async function callOllama(
  prompt: string,
  options?: { model?: string; url?: string; systemPrompt?: string }
): Promise<string> {
  const url = options?.url || process.env.OLLAMA_URL || "http://ollama:11434";
  const modelName = await resolveModel(options);

  const body: Record<string, unknown> = {
    model: modelName,
    prompt,
    stream: false,
  };

  if (options?.systemPrompt) {
    body.system = options.systemPrompt;
  }

  console.log(`[callOllama] Using model: ${modelName}`);

  // 14B model can take 2-3 minutes for complex prompts
  const resp = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300000), // 5 min timeout
  });

  if (!resp.ok) throw new Error(`Ollama API error: ${resp.status}`);
  const data = await resp.json();
  return data.response || "";
}

export async function callOllamaJSON<T>(
  prompt: string,
  options?: { model?: string; url?: string; systemPrompt?: string }
): Promise<T> {
  const text = await callOllama(prompt, options);
  console.log("[callOllamaJSON] Raw response length:", text.length, "first 200 chars:", text.substring(0, 200));

  // Try multiple extraction strategies
  // 1. Code fence with json
  const codeFenceMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (codeFenceMatch) {
    try {
      return JSON.parse(codeFenceMatch[1].trim());
    } catch (e) {
      console.warn("[callOllamaJSON] Code fence JSON parse failed:", e);
    }
  }

  // 2. Any code fence
  const anyFenceMatch = text.match(/```\s*([\s\S]*?)```/);
  if (anyFenceMatch) {
    try {
      return JSON.parse(anyFenceMatch[1].trim());
    } catch (e) {
      console.warn("[callOllamaJSON] Any fence JSON parse failed:", e);
    }
  }

  // 3. Find the outermost { ... } block
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      console.warn("[callOllamaJSON] Brace extraction JSON parse failed:", e);
      // Try fixing common issues: trailing commas, single quotes
      const cleaned = candidate
        .replace(/,\s*([}\]])/g, "$1") // remove trailing commas
        .replace(/'/g, '"'); // replace single quotes
      try {
        return JSON.parse(cleaned);
      } catch {
        // ignore
      }
    }
  }

  throw new Error(`No valid JSON in Ollama response (length: ${text.length}, preview: ${text.substring(0, 300)})`);
}

export async function testOllamaConnection(url?: string): Promise<boolean> {
  const baseUrl = url || process.env.OLLAMA_URL || "http://ollama:11434";
  try {
    const resp = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
