# Conversation and progress log

This is a concise record of the decisions, implementation work, and verification
completed with the project owner. It is not a verbatim transcript.

## Project intent

Customer Compass is an original small-business CRM learning project. The goal is
to learn LLMs, RAG, retrieval evaluation, tool calling, and agentic patterns by
building a realistic application incrementally. It uses only synthetic CRM data.

## Decisions made

- Use VS Code as the primary IDE.
- Use a modern AI-oriented learning stack: TypeScript, React/Vite, Express,
  PostgreSQL, Docker Compose, Ollama, and a local Qwen2.5 3B model.
- Keep Docker for infrastructure (PostgreSQL and Ollama); run UI and API locally
  for fast edit/reload cycles.
- Work through eight stages, stopping after each verified stage.
- Keep a developer-facing design record for every stage in `docs/`.

## Stage 1 completed — CRM foundation

- Created `customer-compass/` project.
- Added React customer browser and Express REST API.
- Added PostgreSQL 17 Docker service, schema, and synthetic CRM data.
- Added companies, contacts, deals, and interactions.
- Verified the UI, API endpoints, production build, and API test.

Useful commands:

```bash
cd /home/devarapallim/Murali/git-personal/customer-compass
docker-compose up -d db
npm run dev
```

## Stage 2 completed — first local LLM chat

- Added a project-isolated Ollama Docker service on host port `11435`.
- Downloaded local model `qwen2.5:3b` (about 1.9 GB).
- Added `POST /api/chat`, with server-owned system prompt, input validation,
  bounded 12-message conversation history, low temperature, and output cap.
- Added an “Ask Compass” chat panel to the React UI.
- Verified a real response through the Customer Compass API, plus build and tests.
- Confirmed the model has **no CRM data access yet**. It supports general
  questions, explanations, and writing help only.

Useful commands:

```bash
docker-compose up -d db ollama
docker exec customer-compass-ollama ollama pull qwen2.5:3b
npm run dev
```

## Stage 3 completed — basic RAG

- Switched the PostgreSQL image to `pgvector/pgvector:pg17` and added
  `documents`, `document_chunks`, and `ingestion_runs` tables (`db/002-rag.sql`).
- Added 8 synthetic CRM documents (`sample-data/documents/`): calls, emails,
  support conversations, notes, and 2 product overviews, cross-referenced with
  the existing 3 companies.
- Built an explicit, framework-free pipeline: `chunking.ts` (600 char chunks,
  100 overlap, unit-tested), `embeddings.ts` (Ollama `mxbai-embed-large`,
  1024-dim), `ingest.ts` (parse → chunk → embed → store, re-runnable), and
  `retrieve.ts` (cosine similarity search + numbered, citable context).
- Added `POST /api/documents/ingest`, `GET /api/documents`,
  `GET /api/documents/ingestion-runs`, and `POST /api/chat/rag` (grounded
  chat returning an answer plus a `citations` array).
- Extracted chat handling out of `app.ts` into `routes/chat.ts` and
  `routes/documents.ts`; `POST /api/chat` (Stage 2, ungrounded) is unchanged.
- Added a UI toggle ("Use document knowledge (RAG)"), an ingest button, and
  numbered citation display under grounded answers.
- Fixed a pre-existing bug: the API `test` script's glob
  (`src/**/*.test.ts`) only matched one directory level without bash
  `globstar`, so `app.test.ts` was silently never executed. Now wrapped with
  `bash -O globstar`; all tests (including `app.test.ts`) run and pass.
- Verified end to end: ingested 8 documents into 16 chunks, asked a
  document-supported question through `/api/chat/rag`, and confirmed the
  answer was grounded with accurate citations to the correct source chunks.

Useful commands:

```bash
docker-compose up -d db ollama
docker exec -i customer-compass-db psql -U customer_compass -d customer_compass < db/002-rag.sql  # existing volumes only
docker exec customer-compass-ollama ollama pull mxbai-embed-large
npm run dev
curl -X POST http://localhost:3001/api/documents/ingest
```

## Documentation added

- `docs/README.md` — stage index and stack overview.
- `docs/01-foundation.md` through `docs/08-agentic-assistant.md` — completed
  implementation records and planned-stage contracts.
- Every documentation file ends with a **Developer note** listing actual changed
  files or expected incremental modules/files.

## Git and MCP setup

- Initialized `customer-compass` as a Git repository on branch `main`.
- No commits have been created yet.
- Installed `uv`/`uvx` in the user environment.
- Added global Codex MCP server `git-local`, scoped only to this repository:

```text
/home/devarapallim/.local/bin/uvx mcp-server-git --repository /home/devarapallim/Murali/git-personal/customer-compass
```

- Verify with `codex mcp list` and `codex mcp get git-local`.
- A new Codex session is needed before the new MCP server can appear as tools.

## Next step

Stage 4: connect RAG with the CRM database — DB-only, RAG-only, and
DB+RAG questions, metadata filtering, customer-specific retrieval,
conversation history, and query rewriting.

## Developer note

Update this file at the end of each stage with implementation decisions,
verification evidence, setup changes, and the next-stage boundary.
