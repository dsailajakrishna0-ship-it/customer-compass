/**
 * Document ingestion pipeline: parse -> chunk -> embed -> store.
 *
 * This is intentionally a standalone, re-runnable process rather than
 * something that happens implicitly on every chat request. Ingestion is a
 * distinct lifecycle step from query-time retrieval (see retrieve.ts).
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { pool } from "../db.js";
import { chunkText } from "./chunking.js";
import { EMBEDDING_MODEL, embedTexts, toVectorLiteral } from "./embeddings.js";

const DOCUMENT_TYPES = ["email", "call", "note", "support", "product"] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

type ParsedDocument = {
  sourcePath: string;
  title: string;
  docType: DocumentType;
  companyName?: string;
  content: string;
};

export type IngestSummary = {
  ingestionRunId: number;
  documentsProcessed: number;
  chunksCreated: number;
  status: "completed" | "failed";
  error?: string;
};

function documentsDir(): string {
  const here = path.dirname(new URL(import.meta.url).pathname);
  return path.resolve(here, "..", "..", "..", "..", "sample-data", "documents");
}

async function loadDocuments(): Promise<ParsedDocument[]> {
  const dir = documentsDir();
  const files = (await readdir(dir)).filter((file) => file.endsWith(".md"));

  const documents: ParsedDocument[] = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const raw = await readFile(fullPath, "utf-8");
    const { data, content } = matter(raw);

    if (typeof data.title !== "string" || !DOCUMENT_TYPES.includes(data.type)) {
      throw new Error(`Document ${file} is missing required frontmatter (title, type).`);
    }

    documents.push({
      sourcePath: path.relative(path.resolve(dir, "..", ".."), fullPath),
      title: data.title,
      docType: data.type,
      companyName: typeof data.company === "string" ? data.company : undefined,
      content: content.trim(),
    });
  }
  return documents;
}

async function resolveCompanyId(companyName: string | undefined): Promise<number | null> {
  if (!companyName) {
    return null;
  }
  const result = await pool.query<{ id: number }>("SELECT id FROM companies WHERE name = $1", [companyName]);
  return result.rows[0]?.id ?? null;
}

/** Ingests every document under sample-data/documents, replacing any prior ingestion. */
export async function ingestDocuments(): Promise<IngestSummary> {
  const runResult = await pool.query<{ id: number }>(
    "INSERT INTO ingestion_runs (embedding_model) VALUES ($1) RETURNING id",
    [EMBEDDING_MODEL],
  );
  const ingestionRunId = runResult.rows[0].id;

  let documentsProcessed = 0;
  let chunksCreated = 0;

  try {
    const documents = await loadDocuments();

    // Re-ingesting should not duplicate rows: clear prior documents/chunks first.
    await pool.query("TRUNCATE document_chunks, documents RESTART IDENTITY CASCADE");

    for (const doc of documents) {
      const companyId = await resolveCompanyId(doc.companyName);
      const insertedDoc = await pool.query<{ id: number }>(
        `INSERT INTO documents (source_path, title, doc_type, company_id, content)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [doc.sourcePath, doc.title, doc.docType, companyId, doc.content],
      );
      const documentId = insertedDoc.rows[0].id;

      const chunks = chunkText(doc.content);
      if (chunks.length === 0) {
        continue;
      }
      const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

      for (const [i, chunk] of chunks.entries()) {
        await pool.query(
          `INSERT INTO document_chunks (document_id, chunk_index, content, char_start, char_end, embedding)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [documentId, chunk.index, chunk.content, chunk.charStart, chunk.charEnd, toVectorLiteral(embeddings[i])],
        );
        chunksCreated += 1;
      }
      documentsProcessed += 1;
    }

    await pool.query(
      "UPDATE ingestion_runs SET status = 'completed', completed_at = NOW(), documents_processed = $1, chunks_created = $2 WHERE id = $3",
      [documentsProcessed, chunksCreated, ingestionRunId],
    );
    return { ingestionRunId, documentsProcessed, chunksCreated, status: "completed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      "UPDATE ingestion_runs SET status = 'failed', completed_at = NOW(), documents_processed = $1, chunks_created = $2, error = $3 WHERE id = $4",
      [documentsProcessed, chunksCreated, message, ingestionRunId],
    );
    return { ingestionRunId, documentsProcessed, chunksCreated, status: "failed", error: message };
  }
}
