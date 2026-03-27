const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function callGemini(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string
): Promise<string> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const contents: { role: string; parts: { text: string }[] }[] = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Understood." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  // Retry with backoff for rate limiting (429)
  let resp: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 5000; // 5s, 10s
      console.log(`[callGemini] Rate limited, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
    resp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.3 },
      }),
    });
    if (resp.status !== 429) break;
  }

  if (!resp || !resp.ok) throw new Error(`Gemini API error: ${resp?.status}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function callGeminiJSON<T>(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string
): Promise<T> {
  const text = await callGemini(prompt, systemPrompt, apiKey);
  // Extract JSON from response (may be wrapped in ```json blocks)
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  return JSON.parse(jsonMatch[1] || jsonMatch[0]);
}
