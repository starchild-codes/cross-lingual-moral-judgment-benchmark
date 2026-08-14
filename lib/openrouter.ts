import { getServerEnv, modelConfig } from "./config";
import type { ModelKey } from "./schemas";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "none";
};

export type OpenRouterResult = {
  modelKey: ModelKey;
  modelString: string;
  content: string;
  rawResponse: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callOpenRouter(modelKey: ModelKey, messages: ChatMessage[], options: OpenRouterOptions = {}): Promise<OpenRouterResult> {
  const env = getServerEnv();
  const modelString = modelConfig[modelKey];
  const retries = options.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      };
      if (env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = env.OPENROUTER_SITE_URL;
      if (env.OPENROUTER_SITE_NAME) headers["X-Title"] = env.OPENROUTER_SITE_NAME;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: modelString,
          messages,
          temperature: options.temperature ?? 0,
          max_tokens: options.maxTokens ?? 32,
          reasoning: {
            effort: options.reasoningEffort ?? "minimal",
            exclude: true
          }
        }),
        signal: controller.signal
      });

      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}: ${JSON.stringify(raw)}`);
      }

      const content = raw?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim().length === 0) {
        throw new Error(`OpenRouter returned no usable content: ${JSON.stringify(raw)}`);
      }

      return { modelKey, modelString, content, rawResponse: raw };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function verifyPinnedModels() {
  const messages: ChatMessage[] = [
    { role: "system", content: "Reply with exactly: ok" },
    { role: "user", content: "Model verification test." }
  ];

  const entries = await Promise.all(
    (Object.keys(modelConfig) as ModelKey[]).map(async (modelKey) => {
      try {
        const needsProviderReasoningBudget = modelKey === "gemini_flash" || modelKey === "gemini_pro";
        const result = await callOpenRouter(modelKey, messages, {
          maxTokens: needsProviderReasoningBudget ? 512 : 64,
          retries: 0,
          timeoutMs: 60000,
          reasoningEffort: needsProviderReasoningBudget ? "minimal" : "none"
        });
        return { modelKey, modelString: modelConfig[modelKey], ok: true, content: result.content, error: null };
      } catch (error) {
        return { modelKey, modelString: modelConfig[modelKey], ok: false, content: null, error: error instanceof Error ? error.message : String(error) };
      }
    })
  );

  return entries;
}
