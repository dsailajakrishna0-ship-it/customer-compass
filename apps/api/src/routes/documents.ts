import { Router } from "express";
import { pool } from "../db.js";
import { ingestDocuments } from "../rag/ingest.js";

export const documentsRouter = Router();

/** Runs the full parse -> chunk -> embed -> store pipeline over sample-data/documents. */
documentsRouter.post("/ingest", async (_request, response) => {
  try {
    const summary = await ingestDocuments();
    const statusCode = summary.status === "completed" ? 200 : 502;
    return response.status(statusCode).json(summary);
  } catch (error) {
    console.error("Document ingestion failed unexpectedly", error);
    return response.status(500).json({ error: "Ingestion failed. Check the API logs." });
  }
});

/** Lists ingested documents with their chunk counts, for debugging retrieval. */
documentsRouter.get("/", async (_request, response) => {
  const result = await pool.query(`
    SELECT d.id, d.title, d.doc_type, d.source_path, c.name AS company_name,
           COUNT(dc.id)::int AS chunk_count
    FROM documents d
    LEFT JOIN companies c ON c.id = d.company_id
    LEFT JOIN document_chunks dc ON dc.document_id = d.id
    GROUP BY d.id, c.name
    ORDER BY d.id
  `);
  response.json(result.rows);
});

/** Returns the most recent ingestion runs, most recent first. */
documentsRouter.get("/ingestion-runs", async (_request, response) => {
  const result = await pool.query(`
    SELECT id, started_at, completed_at, status, embedding_model, documents_processed, chunks_created, error
    FROM ingestion_runs
    ORDER BY started_at DESC
    LIMIT 10
  `);
  response.json(result.rows);
});
