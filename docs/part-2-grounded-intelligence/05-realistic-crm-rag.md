# Stage 5 — Realistic CRM RAG

**Part:** II — Grounded Intelligence
**Status:** Planned

## Goal

Make the assistant feel like a CRM copilot by combining structured database facts
with unstructured customer history.

## Query-routing principle

| Request type | Primary mechanism |
| --- | --- |
| Open deals above a value | SQL query |
| What a customer said about pricing | RAG retrieval |
| Deal status plus past discussions | SQL + RAG + LLM synthesis |

## Intended design requirements

- Attach customer ID, document type, date, and ownership metadata to chunks.
- Filter retrieval by customer where the question identifies an account.
- Preserve citations for unstructured claims and label structured facts clearly.
- Use conversation history carefully; query rewriting is optional and must be
  observable if introduced.

## Acceptance criteria

Answers distinguish facts fetched from PostgreSQL from claims grounded in source
documents, and never retrieve another customer’s material for a scoped question.

## How to run the app

```bash
cd /home/devarapallim/Murali/git-personal/customer-compass
docker-compose up -d db ollama
npm install
npm run dev
```

Ensure Stage 3 documents are ingested (`POST /api/documents/ingest`) so
customer-scoped retrieval has data to filter.

## How to test manually

1. **DB-only question**
   Ask "What open deals does Acme Fabrication have?" and confirm the answer
   comes from a direct SQL lookup (structured facts, no citations).
2. **RAG-only question**
   Ask "What did Ravi say about the volume discount?" and confirm the answer
   is grounded with citations to the matching interaction document.
3. **Combined SQL + RAG question**
   Ask "What's the status of Acme's renewal deal, and what have we discussed
   with them recently?" and confirm the response clearly separates the
   structured deal fact from the cited discussion summary.
4. **Customer-scoping boundary**
   Ask a question naming one company (e.g. Acme) and confirm the retrieved
   citations only ever reference that company's documents, never another
   company's, even when phrasing is ambiguous.
5. **Browser walkthrough** — in the chat panel, confirm the UI visibly
   separates "facts" (from the database) from "citations" (from retrieved
   documents) rather than blending them into one undifferentiated answer.

## Developer note

Expected files/modules for this increment:

- `db/migrations/...` — customer/document metadata indexes and any new CRM
  fields required for scoped retrieval.
- `apps/api/src/crm/queries.ts` — parameterized structured CRM queries.
- `apps/api/src/rag/retrieve.ts` — metadata filtering by customer and document
  type, extending the Stage 3 module.
- `apps/api/src/chat/router.ts` — explicit DB-only, RAG-only, and combined-query
  routing/synthesis policy.
- `apps/api/src/chat/citations.ts` — presentation of structured facts versus
  retrieved source citations.
- `apps/web/src/...` — answer sections that show facts and citations separately.

The Stage 2 general chat endpoint will be extended rather than replaced so the
development history remains easy to follow.
