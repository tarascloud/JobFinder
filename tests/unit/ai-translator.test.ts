/**
 * Unit tests for src/lib/ai/translator.ts
 *
 * AI provider is mocked. Covers:
 *   - early return when fromLang === toLang (no AI call)
 *   - early return on empty text
 *   - language name expansion in prompt (Ukrainian, Spanish, code fallback)
 *   - QA pair JSON parse + fallback to per-field translation
 *   - profile translation only translates whitelist (headline, summary)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const callAIMock = vi.fn();
vi.mock("@/lib/ai/provider", () => ({
  callAI: (...args: unknown[]) => callAIMock(...args),
}));

import {
  translateText,
  translateQAPair,
  translateProfile,
} from "@/lib/ai/translator";

beforeEach(() => {
  callAIMock.mockReset();
});

describe("translateText", () => {
  it("returns original text without calling AI when fromLang === toLang", async () => {
    const result = await translateText("hello", "en", "en");
    expect(result).toBe("hello");
    expect(callAIMock).not.toHaveBeenCalled();
  });

  it("returns original text without calling AI when text is empty/whitespace", async () => {
    const result = await translateText("   ", "en", "uk");
    expect(result).toBe("   ");
    expect(callAIMock).not.toHaveBeenCalled();
  });

  it("expands locale codes to language names in the prompt", async () => {
    callAIMock.mockResolvedValueOnce("привіт");
    await translateText("hello", "en", "uk");
    const promptArg = callAIMock.mock.calls[0][0] as string;
    expect(promptArg).toContain("English");
    expect(promptArg).toContain("Ukrainian");
  });

  it("trims whitespace from AI response", async () => {
    callAIMock.mockResolvedValueOnce("  hola  \n");
    const result = await translateText("hello", "en", "es");
    expect(result).toBe("hola");
  });

  it("falls back to the raw code when locale is unknown", async () => {
    callAIMock.mockResolvedValueOnce("translated");
    await translateText("hello", "en", "fr");
    const promptArg = callAIMock.mock.calls[0][0] as string;
    expect(promptArg).toContain("fr");
  });

  it("passes userId through to provider options", async () => {
    callAIMock.mockResolvedValueOnce("x");
    await translateText("hello", "en", "uk", 42);
    expect(callAIMock).toHaveBeenCalledWith(expect.any(String), { userId: 42 });
  });
});

describe("translateQAPair", () => {
  it("returns original pair without calling AI when fromLang === toLang", async () => {
    const result = await translateQAPair("Q", "A", "en", "en");
    expect(result).toEqual({ question: "Q", answer: "A" });
    expect(callAIMock).not.toHaveBeenCalled();
  });

  it("parses valid JSON response", async () => {
    callAIMock.mockResolvedValueOnce(
      JSON.stringify({ question: "Питання", answer: "Відповідь" })
    );
    const result = await translateQAPair("Question", "Answer", "en", "uk");
    expect(result).toEqual({ question: "Питання", answer: "Відповідь" });
  });

  it("falls back to per-field translation when JSON parsing fails", async () => {
    callAIMock
      .mockResolvedValueOnce("not valid json at all")
      // fallback: question translation
      .mockResolvedValueOnce("Pregunta")
      // fallback: answer translation
      .mockResolvedValueOnce("Respuesta");

    const result = await translateQAPair("Question", "Answer", "en", "es");
    expect(result).toEqual({ question: "Pregunta", answer: "Respuesta" });
    expect(callAIMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to original Q/A fields when JSON is missing fields", async () => {
    callAIMock.mockResolvedValueOnce(JSON.stringify({}));
    const result = await translateQAPair("Q-orig", "A-orig", "en", "uk");
    expect(result).toEqual({ question: "Q-orig", answer: "A-orig" });
  });
});

describe("translateProfile", () => {
  it("returns profile unchanged when fromLang === toLang", async () => {
    const profile = { headline: "Engineer", summary: "Builds things" };
    const result = await translateProfile(profile, "en", "en");
    expect(result).toEqual(profile);
    expect(callAIMock).not.toHaveBeenCalled();
  });

  it("translates only the whitelist fields (headline, summary)", async () => {
    callAIMock
      .mockResolvedValueOnce("Інженер") // headline
      .mockResolvedValueOnce("Будує штуки"); // summary

    const profile = {
      headline: "Engineer",
      summary: "Builds things",
      skills: "React, Node", // not translated
      url: "https://example.com", // not translated
    };
    const result = await translateProfile(profile, "en", "uk");

    expect(result.headline).toBe("Інженер");
    expect(result.summary).toBe("Будує штуки");
    expect(result.skills).toBe("React, Node");
    expect(result.url).toBe("https://example.com");
    expect(callAIMock).toHaveBeenCalledTimes(2);
  });

  it("skips empty translatable fields", async () => {
    callAIMock.mockResolvedValueOnce("Інженер");

    const profile = { headline: "Engineer", summary: "   " };
    const result = await translateProfile(profile, "en", "uk");

    expect(result.headline).toBe("Інженер");
    expect(result.summary).toBe("   ");
    expect(callAIMock).toHaveBeenCalledTimes(1);
  });
});
