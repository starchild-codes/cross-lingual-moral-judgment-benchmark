import { callOpenRouter } from "./openrouter";
import type { ChatMessage } from "./openrouter";
import type { ModelKey } from "./schemas";

function requiresProviderReasoning(modelKey: ModelKey) {
  return modelKey === "gemini_flash" || modelKey === "gemini_pro";
}

export function parseRating(output: string): number | null {
  const trimmed = normalizeRatingDigits(output.trim());
  if (/^[1-7]$/.test(trimmed)) return Number(trimmed);
  const matches = trimmed.match(/\b[1-7]\b/g);
  return matches?.length === 1 ? Number(matches[0]) : null;
}

function normalizeRatingDigits(value: string) {
  const digitMap: Record<string, string> = {
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "१": "1",
    "२": "2",
    "३": "3",
    "४": "4",
    "५": "5",
    "६": "6",
    "७": "7",
    "১": "1",
    "২": "2",
    "৩": "3",
    "৪": "4",
    "৫": "5",
    "৬": "6",
    "৭": "7",
    "௧": "1",
    "௨": "2",
    "௩": "3",
    "௪": "4",
    "௫": "5",
    "௬": "6",
    "௭": "7"
  };
  return [...value].map((char) => digitMap[char] ?? char).join("");
}

export async function runRatingTask(modelKey: ModelKey, messages: ChatMessage[]) {
  let lastRawOutput: string | null = null;
  let lastRawResponse: unknown = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await callOpenRouter(modelKey, messages, {
        maxTokens: requiresProviderReasoning(modelKey) ? 512 : 64,
        retries: 0,
        timeoutMs: 60000,
        reasoningEffort: requiresProviderReasoning(modelKey) ? "minimal" : "none"
      });
      lastRawOutput = result.content;
      lastRawResponse = result.rawResponse;
      const parsedRating = parseRating(result.content);
      if (parsedRating !== null) {
        return { rawOutput: lastRawOutput, rawResponse: lastRawResponse, parsedRating, errorNote: null };
      }
      lastError = `Malformed rating output: ${result.content}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }

  return { rawOutput: lastRawOutput, rawResponse: lastRawResponse, parsedRating: null, errorNote: lastError ?? "Unknown rating failure" };
}
