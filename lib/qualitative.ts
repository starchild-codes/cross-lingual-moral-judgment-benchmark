import { callOpenRouter, type ChatMessage } from "./openrouter";
import type { ModelKey } from "./schemas";

function requiresProviderReasoning(modelKey: ModelKey) {
  return modelKey === "gemini_flash" || modelKey === "gemini_pro";
}

export async function runQualitativeTask(modelKey: ModelKey, messages: ChatMessage[]) {
  try {
    const result = await callOpenRouter(modelKey, messages, {
      maxTokens: requiresProviderReasoning(modelKey) ? 900 : 260,
      retries: 2,
      timeoutMs: 90000,
      reasoningEffort: requiresProviderReasoning(modelKey) ? "minimal" : "none"
    });
    return { rawOutput: result.content, rawResponse: result.rawResponse, errorNote: null };
  } catch (error) {
    return { rawOutput: null, rawResponse: null, errorNote: error instanceof Error ? error.message : String(error) };
  }
}
