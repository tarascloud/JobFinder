const GROQ_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

export async function callGroq(
  prompt: string,
  options?: { model?: string; apiKey?: string; systemPrompt?: string }
): Promise<string> {
  const key = options?.apiKey || process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  const modelName = options?.model || "llama-3.3-70b-versatile";

  const messages: { role: string; content: string }[] = [];
  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= GROQ_RETRY_DELAYS_MS.length; attempt++) {
    const resp = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.3,
        }),
      }
    );

    if (resp.status === 429) {
      const delayMs = GROQ_RETRY_DELAYS_MS[attempt];
      if (delayMs === undefined) {
        throw new Error(`Groq API rate limit (429) after ${attempt} retries`);
      }
      console.warn(`[groq] 429 rate limit, retrying in ${delayMs}ms (attempt ${attempt + 1}/${GROQ_RETRY_DELAYS_MS.length})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      lastError = new Error(`Groq API rate limit (429)`);
      continue;
    }

    if (!resp.ok) throw new Error(`Groq API error: ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "";
  }

  throw lastError || new Error("Groq API rate limit exceeded");
}

export async function callGroqJSON<T>(
  prompt: string,
  options?: { model?: string; apiKey?: string; systemPrompt?: string }
): Promise<T> {
  const text = await callGroq(prompt, options);
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Groq response");
  return JSON.parse(jsonMatch[1] || jsonMatch[0]);
}

export async function testGroqConnection(apiKey?: string): Promise<boolean> {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) return false;
  try {
    const resp = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
