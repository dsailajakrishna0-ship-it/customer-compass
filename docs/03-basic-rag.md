# Stage 3 — Basic RAG

**Status:** Completed

## Goal

Build a transparent Retrieval-Augmented Generation pipeline using synthetic CRM
documents. The output must be grounded and cite its source chunks.

## Implemented design

```text
Document -> parse (frontmatter + body) -> chunk (600 chars, 100 overlap)
         -> embed (Ollama mxbai-embed-large, 1024-dim) -> store (pgvector)
Question -> embed -> cosine similarity search (<=>) -> top chunks (>= 0.3 similarity)
         -> numbered context block -> LLM (grounded system prompt) -> answer + citations
```

- Vector storage: `pgvector` extension inside the existing PostgreSQL service
  (image switched to `pgvector/pgvector:pg17`). No ANN index yet — the corpus
  is small enough for an exact `<=>` scan; Stage 5 revisits indexing.
- Embeddings: local Ollama model `mxbai-embed-large`, called through
  `apps/api/src/rag/embeddings.ts`.
- Chunking: explicit character-based sliding window in
  `apps/api/src/rag/chunking.ts` (`CHUNK_SIZE=600`, `CHUNK_OVERLAP=100`),
  unit-tested in `chunking.test.ts`.
- Ingestion (`apps/api/src/rag/ingest.ts`): reads every `.md` file in
  `sample-data/documents/`, parses YAML frontmatter (`title`, `type`,
  optional `company`) with `gray-matter`, resolves `company` to an existing
  `companies.id`, truncates and re-inserts `documents`/`document_chunks` on
  each run, and records each run in `ingestion_runs`.
- Retrieval (`apps/api/src/rag/retrieve.ts`): embeds the question, runs a
  cosine-similarity query joining `document_chunks` → `documents` →
  `companies`, and builds a numbered, citable context block.
- Routes:
  - `POST /api/documents/ingest` — runs the full pipeline.
  - `GET /api/documents` — lists ingested documents with chunk counts.
  - `GET /api/documents/ingestion-runs` — ingestion history/debugging.
  - `POST /api/chat/rag` — grounded chat; returns `{ message, citations[] }`.
  - `POST /api/chat` — unchanged general chat from Stage 2 (now its own router).
- UI: an "Ingest documents" button, a "Use document knowledge (RAG)" toggle,
  and numbered citations (title, company, doc type, similarity score) shown
  under grounded answers.

Synthetic documents (`sample-data/documents/`) cover emails, call notes,
support conversations, and two product/service overviews, cross-referenced
with the three companies already in the CRM database — this sets up Stage 4's
DB + RAG linkage.

## Learning boundaries

- Explain and implement chunk size, overlap, embeddings, similarity scoring,
  retrieval, context construction, and citations explicitly.
- Keep document ingestion distinct from query-time retrieval.
- Add a way to inspect chunks and retrieved sources for debugging.
- Do not use tools/agent loops or hide the pipeline behind a broad framework.

## Acceptance criteria

A developer can ingest sample documents, ask a document-supported question, see
the answer’s citations, and verify the cited source text.

Verified: ingested 8 documents into 16 chunks; asked "Does the Fleet
Visibility package include alerting, and can alerts be set per customer?"
through `POST /api/chat/rag` and received a correct, cited answer referencing
the product overview and the matching support conversation.

## Developer note

Changed/added files:

- `docker-compose.yml` — `db` image switched to `pgvector/pgvector:pg17`;
  mounts `db/002-rag.sql`.
- `db/002-rag.sql` — pgvector extension, `documents`, `document_chunks`,
  `ingestion_runs` tables. Runs automatically only on a fresh volume; apply
  manually to an existing volume with
  `docker exec -i customer-compass-db psql -U customer_compass -d customer_compass < db/002-rag.sql`.
- `apps/api/src/rag/chunking.ts` (+ test), `embeddings.ts`, `ingest.ts`,
  `retrieve.ts`.
- `apps/api/src/routes/documents.ts`, `apps/api/src/routes/chat.ts` (extracted
  from `app.ts`, added the `/rag` grounded endpoint).
- `sample-data/documents/*.md` — 8 synthetic documents.
- `apps/web/src/main.tsx`, `apps/web/src/styles.css` — ingestion control, RAG
  toggle, citation rendering.
- `apps/api/package.json` — fixed the `test` script glob (`src/**/*.test.ts`
  silently matched only one directory level without bash `globstar`, so
  `app.test.ts` was never actually running; now wrapped with
  `bash -O globstar`).

Useful commands:

```bash
docker-compose up -d db ollama
docker exec customer-compass-ollama ollama pull mxbai-embed-large
curl -X POST http://localhost:3001/api/documents/ingest
```

