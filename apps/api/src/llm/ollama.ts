import type { ChatMessage } from "./types.js";

const ollamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11435";
const ollamaModel = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";

/** Calls the local Ollama chat model (Stage 2 behavior, unchanged). */
export async function generateWithOllama(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      stream: false,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      options: { temperature: 0.3, num_predict: 350 },
    }),
  });
  if (!ollamaResponse.ok) {
    console.error("Ollama request failed", await ollamaResponse.text());
    throw new Error("The local model is not ready. Start Ollama and pull the configured model.");
  }
  const payload = (await ollamaResponse.json()) as { message?: { content?: string } };
  return payload.message?.content ?? "I could not generate a response.";
}
