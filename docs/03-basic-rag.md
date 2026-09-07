# Stage 3 — Basic RAG

**Status:** Planned

## Goal

Build a transparent Retrieval-Augmented Generation pipeline using synthetic CRM
documents. The output must be grounded and cite its source chunks.

## Intended design

```text
Document -> parse -> chunk -> embed -> vector store
Question -> embed -> similarity search -> selected chunks -> LLM answer + citations
```

Documents will include fictional customer notes, emails, call summaries, support
conversations, and product information. This is document knowledge only; direct
CRM database queries remain outside this stage.

## Learning boundaries

- Explain and implement chunk size, overlap, embeddings, similarity scoring,
  retrieval, context construction, and citations explicitly.
- Keep document ingestion distinct from query-time retrieval.
- Add a way to inspect chunks and retrieved sources for debugging.
- Do not use tools/agent loops or hide the pipeline behind a broad framework.

## Acceptance criteria

A developer can ingest sample documents, ask a document-supported question, see
the answer’s citations, and verify the cited source text.

## Developer note

Expected files/modules for this increment (names may be refined during design):

- `db/migrations/...` — document, chunk, ingestion-run, and citation metadata.
- `apps/api/src/rag/ingest.ts` — parse/chunk/embed ingestion pipeline.
- `apps/api/src/rag/retrieve.ts` — similarity retrieval and source formatting.
- `apps/api/src/rag/chunking.ts` — explicit chunk-size and overlap policy.
- `apps/api/src/routes/documents.ts` and `apps/api/src/routes/chat.ts` —
  ingestion and grounded-chat endpoints.
- `sample-data/documents/` — synthetic emails, notes, calls, support, and
  product material.
- `apps/web/src/...` — document-ingestion status and answer citation display.

Stage 3 will choose and document the vector-store integration before these files
are implemented.
