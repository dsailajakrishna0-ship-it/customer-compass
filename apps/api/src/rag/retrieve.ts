/**
 * Query-time retrieval: embed the question, find the closest chunks, and
 * shape them into citable sources for the LLM prompt and the UI.
 */

import { pool } from "../db.js";
import { embedText, toVectorLiteral } from "./embeddings.js";

export type RetrievedChunk = {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  sourcePath: string;
  docType: string;
  companyName: string | null;
  chunkIndex: number;
  content: string;
  similarity: number;
};

const DEFAULT_TOP_K = 4;
/** Chunks below this cosine similarity are treated as not relevant enough to cite. */
const MIN_SIMILARITY = 0.3;

export async function retrieveRelevantChunks(question: string, topK = DEFAULT_TOP_K): Promise<RetrievedChunk[]> {
  const queryEmbedding = toVectorLiteral(await embedText(question));

  const result = await pool.query<{
    chunk_id: number;
    document_id: number;
    document_title: string;
    source_path: string;
    doc_type: string;
    company_name: string | null;
    chunk_index: number;
    content: string;
    similarity: number;
  }>(
    `SELECT
       dc.id AS chunk_id,
       d.id AS document_id,
       d.title AS document_title,
       d.source_path AS source_path,
       d.doc_type AS doc_type,
       c.name AS company_name,
       dc.chunk_index AS chunk_index,
       dc.content AS content,
       1 - (dc.embedding <=> $1) AS similarity
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     LEFT JOIN companies c ON c.id = d.company_id
     ORDER BY dc.embedding <=> $1
     LIMIT $2`,
    [queryEmbedding, topK],
  );

  return result.rows
    .filter((row) => row.similarity >= MIN_SIMILARITY)
    .map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      sourcePath: row.source_path,
      docType: row.doc_type,
      companyName: row.company_name,
      chunkIndex: row.chunk_index,
      content: row.content,
      similarity: Number(row.similarity),
    }));
}

/** Builds the numbered, citable context block injected into the LLM prompt. */
export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => `[${i + 1}] Source: ${chunk.documentTitle} (${chunk.docType})\n${chunk.content}`)
    .join("\n\n");
}
