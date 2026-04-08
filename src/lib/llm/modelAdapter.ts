import { ChatOpenAI } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import { getConfig } from "@/lib/config";
import { getAppSettings } from "@/lib/settingsStore";
import { logger } from "@/lib/logger";

export type ChatLike = {
  invoke: (messages: BaseMessage[]) => Promise<{ content: unknown }>;
};

/**
 * OpenAI-compatible chat model; Ollama exposes OpenAI-compatible `/v1/chat/completions`.
 */
export function createChatModel(): ChatLike | null {
  const cfg = getConfig();
  const app = getAppSettings();
  const provider =
    cfg.REPOCHECK_MODEL_PROVIDER !== "none"
      ? cfg.REPOCHECK_MODEL_PROVIDER
      : app.modelProvider;

  if (provider === "none") return null;

  if (provider === "ollama") {
    return new ChatOpenAI({
      model: cfg.REPOCHECK_LLM_MODEL,
      temperature: 0.2,
      apiKey: "ollama",
      configuration: { baseURL: `${cfg.OLLAMA_BASE_URL}/v1` },
    }) as unknown as ChatLike;
  }

  if (!cfg.OPENAI_API_KEY) {
    logger.warn("OPENAI_API_KEY missing; LLM disabled");
    return null;
  }

  return new ChatOpenAI({
    model: cfg.REPOCHECK_LLM_MODEL,
    temperature: 0.2,
    apiKey: cfg.OPENAI_API_KEY,
    configuration: cfg.OPENAI_BASE_URL
      ? { baseURL: cfg.OPENAI_BASE_URL }
      : undefined,
  }) as unknown as ChatLike;
}
