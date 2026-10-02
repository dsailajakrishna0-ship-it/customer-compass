import type { ChatMessage } from "./types.js";

// OpenRouter exposes an OpenAI-compatible /chat/completions endpoint and
// offers several free-tier models (suffixed ":free"). See
// https://openrouter.ai/models?max_price=0 for the current free-model list,
// or GET /api/llm/models on this API (backs the web UI's model dropdown).
const openrouterUrl = "https://openrouter.ai/api/v1/chat/completions";
const defaultOpenrouterModel = process.env.OPENROUTER_MODEL ?? "liquid/lfm-2.5-2.6b:free";

/**
 * Calls the OpenRouter cloud model (Stage 4 swappable alternative to Ollama).
 * `model` is an optional per-request override (from the web UI's "OpenRouter
 * model" dropdown); when omitted, falls back to OPENROUTER_MODEL / the
 * hardcoded default above.
 */
export async function generateWithCloud(
  systemPrompt: string,
  messages: ChatMessage[],
  model?: string,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to apps/api/.env to use LLM_PROVIDER=cloud.");
  }

  const resolvedModel = model ?? defaultOpenrouterModel;

  const response = await fetch(openrouterUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: resolvedModel,
      temperature: 0.3,
      max_tokens: 350,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string; code?: number };
  };

  // OpenRouter can return HTTP 200 with an embedded `error` object when the
  // upstream free-tier provider is overloaded/rate-limited, so we must check
  // for that in addition to !response.ok.
  if (!response.ok || payload.error) {
    const detail = payload.error?.message ?? (await response.text().catch(() => ""));
    console.error("OpenRouter request failed", detail);
    throw new Error(
      `The cloud model (${resolvedModel}) is currently unavailable: ${detail || "unknown error"}. ` +
        "Free-tier models rotate/rate-limit often - try again shortly or pick a different model " +
        "from the dropdown (see apps/api/.env.example for how to refresh the free-model list).",
    );
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("The cloud model returned an empty response. Try again or pick a different model.");
  }
  return content;
}
