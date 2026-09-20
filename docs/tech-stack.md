# Tech stack and alternatives

This is a living, cross-cutting reference of the technology used in Customer
Compass — organized by **capability** (LLM inference, embeddings, vector
storage, tool calling, etc.) rather than by stage. It exists so a learner can
see, at a glance, what is currently active, what swappable alternative is
already wired in (or planned), and what other free options are worth exploring
next.

**Update this file whenever a new stage introduces a new technology choice or
a new swappable alternative.** Individual stage documents describe the
*implementation details and acceptance criteria*; this file is the map across
all of them.

## How swapping works

Where an alternative is available, it is wired in as an **additive, opt-in
toggle** — never a silent replacement (see `docs/conversation-progress.md` for
this project's standing strategy). Two mechanisms are used:

1. **Environment variable** (application-level choice, e.g. which LLM
   provider or vector store the API talks to).
2. **Commented-out Docker Compose service** — the alternative's service
   definition exists in `docker-compose.yml` but is commented out by default.
   Uncomment it, set the matching environment variable, and restart to try it;
   comment it back out to return to the default with no other changes.

## LLM inference (chat/completion)

| | Technology | Status |
| --- | --- | --- |
| **Active (default)** | Ollama, local, `qwen2.5:3b` | Stage 2 |
| **Swappable alternative** | Free-tier cloud provider (Groq / OpenRouter / Gemini), via `LLM_PROVIDER=cloud` | Stage 4 (planned) |

Free options worth exploring later:

- **Groq** — very low latency, OpenAI-compatible API, generous free tier.
- **OpenRouter** — aggregates many free-tier models behind one API.
- **Google Gemini (free tier)** — strong quality, own SDK shape.
- **Together.ai** — free credits, OpenAI-compatible.

## Embeddings

| | Technology | Status |
| --- | --- | --- |
| **Active (default)** | Ollama, local, `mxbai-embed-large` (1024-dim) | Stage 3 |
| **Swappable alternative** | Not yet planned | — |

Free options worth exploring later:

- **Cohere** — free-tier embed API, strong retrieval performance.
- **Google `text-embedding-004`** — free-tier via Gemini API.
- **Sentence-Transformers** (self-hosted, e.g. `all-MiniLM-L6-v2`) — fully
  free/local, smaller/faster than `mxbai-embed-large`, good for comparing
  embedding quality vs. speed trade-offs.

## Vector storage / retrieval database

| | Technology | Status |
| --- | --- | --- |
| **Active (default)** | PostgreSQL + `pgvector` extension (same DB as CRM tables) | Stage 3 |
| **Swappable alternative** | Qdrant (self-hosted, Docker), via `VECTOR_STORE=qdrant` | Planned |

`pgvector` is genuinely production-viable at this project's scale (see
discussion in `docs/conversation-progress.md`) — this is not a "toy vs. real"
comparison, but a "one database vs. a purpose-built vector database"
trade-off worth learning hands-on.

Free options worth exploring later:

- **Qdrant** — open-source, self-hosted via Docker, easy DX; the first
  alternative wired into `docker-compose.yml` (see below).
- **Chroma** — simplest to start with, embedded or server mode, common in RAG
  tutorials.
- **Weaviate** — built-in hybrid (BM25 + vector) search, directly relevant to
  Stage 6's hybrid-retrieval goal.
- **Milvus / Zilliz Cloud** — industry-standard at large scale; free cloud
  tier available.
- **pgvector + pgvectorscale** (Timescale extension) — adds StreamingDiskANN
  to pgvector itself, no separate database needed; worth trying before
  reaching for a dedicated vector DB.

## Tool calling protocol

| | Technology | Status |
| --- | --- | --- |
| **Planned (default)** | MCP (Model Context Protocol) | Stage 9 |
| **Alternative worth knowing** | Native provider function-calling (OpenAI/Anthropic/Gemini function-calling schemas) | Not wired in — reference only |

MCP is the standard used going forward because it is provider-agnostic and
matches how modern AI tools (including this CLI) expose tools today.

## Guardrails / prompt-injection defense

| | Technology | Status |
| --- | --- | --- |
| **Planned (default)** | Custom rule-based guard + delimited untrusted-content prompting | Stage 8 |
| **Alternatives worth exploring** | NeMo Guardrails, Llama Guard, Guardrails AI | Not yet wired in |

## Evaluation

| | Technology | Status |
| --- | --- | --- |
| **Planned (default)** | Custom benchmark (`evals/questions.json`) + LLM-as-judge | Stage 6 |
| **Alternatives worth exploring** | RAGAS, DeepEval, promptfoo | Not yet wired in |

## Relational / application database

| | Technology | Status |
| --- | --- | --- |
| **Active** | PostgreSQL 17 (Docker) | Stage 1 |

No alternative planned — this holds the core CRM data and is not swapped.

## Maintenance

- Add a new row/section here the same time a new stage introduces a
  swappable technology choice.
- Keep the "Active" column accurate — if a stage promotes an alternative to
  the new default, update this file and note the change in
  `docs/conversation-progress.md`.
