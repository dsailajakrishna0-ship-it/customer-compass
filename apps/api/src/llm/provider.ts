import type { ChatMessage } from "./types.js";
import { generateWithCloud } from "./cloud.js";
import { generateWithOllama } from "./ollama.js";

export type { ChatMessage } from "./types.js";
export type LlmProvider = "ollama" | "cloud";

export const DEFAULT_LLM_PROVIDER: LlmProvider = (process.env.LLM_PROVIDER as LlmProvider) ?? "ollama";

/**
 * Generates a response using the requested LLM backend. `provider` is an
 * explicit per-request choice (e.g. from a UI selector); when omitted it
 * falls back to `LLM_PROVIDER` (defaults to "ollama" — unchanged Stage 2
 * behavior). Both backends are always available side by side; nothing is
 * replaced. See docs/part-2-grounded-intelligence/04-cloud-llm-provider.md
 * and docs/tech-stack.md.
 */
export async function generate(
  systemPrompt: string,
  messages: ChatMessage[],
  provider?: LlmProvider,
): Promise<string> {
  const resolved = provider ?? DEFAULT_LLM_PROVIDER;
  switch (resolved) {
    case "cloud":
      return generateWithCloud(systemPrompt, messages);
    case "ollama":
      return generateWithOllama(systemPrompt, messages);
    default:
      throw new Error(`Unknown LLM provider "${resolved}". Use "ollama" or "cloud".`);
  }
}
