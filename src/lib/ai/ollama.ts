export async function callOllama(
  prompt: string,
  options?: { model?: string; url?: string; systemPrompt?: string }
): Promise<string> {
  const url = options?.url || process.env.OLLAMA_URL || "http://ollama:11434";
  const modelName =
    options?.model || process.env.OLLAMA_MODEL || "qwen2.5:14b-instruct-q4_K_M";

  const body: Record<string, unknown> = {
    model: modelName,
    prompt,
    stream: false,
  };

  if (options?.systemPrompt) {
    body.system = options.systemPrompt;
  }

  const resp = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
