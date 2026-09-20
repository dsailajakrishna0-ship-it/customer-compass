/**
 * Explicit chunking policy for Stage 3 (Basic RAG).
 *
 * Splitting a document into overlapping windows keeps each chunk small enough
 * for accurate embeddings while overlap avoids losing meaning that spans a
 * chunk boundary. Sizes are in characters, not tokens, to keep the logic
 * simple and dependency-free while learning the pipeline end to end.
 */

export type Chunk = {
  index: number;
  content: string;
  charStart: number;
  charEnd: number;
};

export const CHUNK_SIZE = 600;
export const CHUNK_OVERLAP = 100;

export function chunkText(
  text: string,
  { chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP }: { chunkSize?: number; overlap?: number } = {},
): Chunk[] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0.");
  }
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap must be non-negative and smaller than chunkSize.");
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];
  const step = chunkSize - overlap;
  let start = 0;
  let index = 0;

  while (start < trimmed.length) {
    const end = Math.min(start + chunkSize, trimmed.length);
    const content = trimmed.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({ index, content, charStart: start, charEnd: end });
      index += 1;
    }
    if (end === trimmed.length) {
      break;
    }
    start += step;
  }

  return chunks;
}
