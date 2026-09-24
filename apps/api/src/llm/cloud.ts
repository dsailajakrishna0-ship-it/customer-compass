import type { ChatMessage } from "./types.js";

// OpenRouter exposes an OpenAI-compatible /chat/completions endpoint and
// offers several free-tier models (suffixed ":free"). See
// https://openrouter.ai/models?max_price=0 for the current free-model list.
const openrouterUrl = "https://openrouter.ai/api/v1/chat/completions";
const openrouterModel = process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";

/** Calls the OpenRouter cloud model (Stage 4 swappable alternative to Ollama). */
export async function generateWithCloud(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to apps/api/.env to use LLM_PROVIDER=cloud.");
  }

  const response = await fetch(openrouterUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: openrouterModel,
      temperature: 0.3,
      max_tokens: 350,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!response.ok) {
    console.error("OpenRouter request failed", await response.text());
    throw new Error("The cloud model is not reachable. Check OPENROUTER_API_KEY and OPENROUTER_MODEL.");
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content ?? "I could not generate a response.";
}
