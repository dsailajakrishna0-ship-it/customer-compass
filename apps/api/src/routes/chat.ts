import { Router } from "express";
import { buildContext, retrieveRelevantChunks } from "../rag/retrieve.js";

export const chatRouter = Router();

type ChatMessage = { role: "user" | "assistant"; content: string };

const generalSystemPrompt = `You are Compass, a helpful assistant inside a CRM learning application.
You do not have access to any CRM customer data yet. Be transparent about that.
Give concise, useful answers and never invent facts, access, or actions.`;

const groundedSystemPrompt = `You are Compass, a CRM knowledge assistant.
Answer ONLY using the numbered sources provided in the context below.
Every factual claim must be followed by a citation like [1] matching a source number.
If the sources do not contain the answer, say so plainly instead of guessing.`;

const ollamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11435";
const ollamaModel = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";

function validateMessages(messages: unknown): messages is ChatMessage[] {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= 12 &&
    messages.every(
      (message): message is ChatMessage =>
        (message?.role === "user" || message?.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0 &&
        message.content.length <= 4_000,
    )
  );
}

async function callOllama(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
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

/** General-purpose chat, no CRM/document grounding (Stage 2 behavior). */
chatRouter.post("/", async (request, response) => {
  const { messages } = request.body ?? {};
  if (!validateMessages(messages)) {
    return response.status(400).json({ error: "Send between 1 and 12 chat messages." });
  }
  try {
    const message = await callOllama(generalSystemPrompt, messages);
    return response.json({ message });
  } catch (error) {
    console.error("Could not reach Ollama", error);
    return response.status(503).json({ error: error instanceof Error ? error.message : "Could not reach Ollama." });
  }
});

/** Retrieval-augmented chat: retrieves cited chunks and grounds the answer in them. */
chatRouter.post("/rag", async (request, response) => {
  const { messages } = request.body ?? {};
  if (!validateMessages(messages)) {
    return response.status(400).json({ error: "Send between 1 and 12 chat messages." });
  }

  const question = messages[messages.length - 1].content;

  try {
    const chunks = await retrieveRelevantChunks(question);
    if (chunks.length === 0) {
      return response.json({
        message: "I could not find any ingested documents relevant to that question.",
        citations: [],
      });
    }

    const context = buildContext(chunks);
    const augmentedMessages: ChatMessage[] = [
      ...messages.slice(0, -1),
      { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
    ];

    const message = await callOllama(groundedSystemPrompt, augmentedMessages);
    const citations = chunks.map((chunk, i) => ({
      number: i + 1,
      documentId: chunk.documentId,
      title: chunk.documentTitle,
      sourcePath: chunk.sourcePath,
      docType: chunk.docType,
      companyName: chunk.companyName,
      similarity: chunk.similarity,
      snippet: chunk.content.slice(0, 200),
    }));
    return response.json({ message, citations });
  } catch (error) {
    console.error("Grounded chat failed", error);
    return response.status(503).json({ error: error instanceof Error ? error.message : "Could not answer with retrieval." });
  }
});
