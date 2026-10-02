import { Router } from "express";
import { buildContext, retrieveRelevantChunks } from "../rag/retrieve.js";
import { generate, DEFAULT_LLM_PROVIDER, type ChatMessage, type LlmProvider } from "../llm/provider.js";

export const chatRouter = Router();

const generalSystemPrompt = `You are Compass, a helpful assistant inside a CRM learning application.
You do not have access to any CRM customer data yet. Be transparent about that.
Give concise, useful answers and never invent facts, access, or actions.`;

const groundedSystemPrompt = `You are Compass, a CRM knowledge assistant.
Answer ONLY using the numbered sources provided in the context below.
Every factual claim must be followed by a citation like [1] matching a source number.
If the sources do not contain the answer, say so plainly instead of guessing.`;

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

/** Optional per-request LLM choice from the UI selector; falls back to LLM_PROVIDER when omitted. */
function resolveProvider(provider: unknown): LlmProvider | undefined {
  if (provider === "ollama" || provider === "cloud") return provider;
  return undefined;
}

/** Optional per-request OpenRouter model override from the UI's "OpenRouter model" dropdown. */
function resolveModel(model: unknown): string | undefined {
  return typeof model === "string" && model.trim().length > 0 ? model : undefined;
}

/** General-purpose chat, no CRM/document grounding (Stage 2 behavior). */
chatRouter.post("/", async (request, response) => {
  const { messages, provider, model } = request.body ?? {};
  if (!validateMessages(messages)) {
    return response.status(400).json({ error: "Send between 1 and 12 chat messages." });
  }
  const resolvedProvider = resolveProvider(provider) ?? DEFAULT_LLM_PROVIDER;
  const resolvedModel = resolveModel(model);
  try {
    const message = await generate(generalSystemPrompt, messages, resolvedProvider, resolvedModel);
    return response.json({ message, provider: resolvedProvider });
  } catch (error) {
    console.error(`Could not reach the "${resolvedProvider}" LLM provider`, error);
    return response.status(503).json({ error: error instanceof Error ? error.message : "Could not reach the configured LLM provider." });
  }
});

/** Retrieval-augmented chat: retrieves cited chunks and grounds the answer in them. */
chatRouter.post("/rag", async (request, response) => {
  const { messages, provider, model } = request.body ?? {};
  if (!validateMessages(messages)) {
    return response.status(400).json({ error: "Send between 1 and 12 chat messages." });
  }
  const resolvedProvider = resolveProvider(provider) ?? DEFAULT_LLM_PROVIDER;
  const resolvedModel = resolveModel(model);

  const question = messages[messages.length - 1].content;

  try {
    const chunks = await retrieveRelevantChunks(question);
    if (chunks.length === 0) {
      return response.json({
        message: "I could not find any ingested documents relevant to that question.",
        citations: [],
        provider: resolvedProvider,
      });
    }

    const context = buildContext(chunks);
    const augmentedMessages: ChatMessage[] = [
      ...messages.slice(0, -1),
      { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
    ];

    const message = await generate(groundedSystemPrompt, augmentedMessages, resolvedProvider, resolvedModel);
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
    return response.json({ message, citations, provider: resolvedProvider });
  } catch (error) {
    console.error(`Grounded chat failed with the "${resolvedProvider}" LLM provider`, error);
    return response.status(503).json({ error: error instanceof Error ? error.message : "Could not answer with retrieval." });
  }
});
