/**
 * Thin client around Ollama's embeddings endpoint.
 *
 * Kept separate from ingest/retrieve so both ingestion-time (document chunks)
 * and query-time (the user's question) embedding calls share one code path.
 */

const ollamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11435";
export const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL ?? "mxbai-embed-large";
export const EMBEDDING_DIMENSIONS = 1024;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const response = await fetch(`${ollamaUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embeddings request failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { embeddings?: number[][] };
  if (!Array.isArray(payload.embeddings) || payload.embeddings.length !== texts.length) {
    throw new Error("Ollama did not return one embedding per input text.");
  }
  return payload.embeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

/** Formats an embedding as the pgvector literal string, e.g. "[0.1,0.2,...]". */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
