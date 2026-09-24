# Stage 4 — Cloud LLM provider option

**Part:** II — Grounded Intelligence
**Status:** Implemented

## Goal

Add one free-tier cloud LLM provider as a swappable alternative to local Ollama,
without replacing it. This turns the "future cloud-model providers" boundary
noted since Stage 2 into a real, working option, and gives later stages
(evaluation, production fallback) a second real provider to compare against
instead of a hypothetical one.

## Why this stage exists here

- Stages 1–3 already built the model-calling plumbing (`/api/chat`,
  `/api/chat/rag`) behind a server-side boundary — adding a second provider is
  a natural, low-risk extension of that same code path.
- Stage 6 (retrieval evaluation) benefits from comparing local vs. cloud
  answer quality/latency on the same benchmark.
- Stage 7's "model fallback" (production concerns) needs a real second
  provider to fall back to, not just a design placeholder.

## Chosen provider (free tier)

**OpenRouter** — OpenAI-compatible `/chat/completions` API with a rotating
catalog of `:free`-suffixed models. Chosen over Groq/Gemini for this stage
because its request/response shape matches Ollama's closely enough that one
thin adapter (`cloud.ts`) covers it, and its free-tier model list is fetchable
live (see `.env.example`) so the doc doesn't go stale when a model is retired.

Default model in use: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`.
OpenRouter's free models change often (promoted to paid, or temporarily
rate-limited under shared-pool contention) — if cloud requests start failing,
refresh the live list and swap the model in `.env` and `cloud.ts`'s fallback.

## Actual design (implemented)

```text
POST /api/chat, /api/chat/rag   { messages, provider?: "ollama" | "cloud" }
        |
        v
apps/api/src/llm/provider.ts   generate(systemPrompt, messages, provider?)
        |              \
        v               v
  ollama.ts          cloud.ts (OpenRouter)
```

- `apps/api/src/llm/provider.ts` exposes `generate()`, used by both chat
  routes. Provider is chosen **per request**, not just at server start:
  - If the request body includes `provider`, that value is used (validated
    server-side via `resolveProvider()` in `chat.ts`).
  - If omitted, it falls back to `DEFAULT_LLM_PROVIDER`, derived from the
    `LLM_PROVIDER` env var (defaults to `ollama`), so existing clients/tests
    that don't send `provider` see no behavior change.
- The web UI (`apps/web/src/main.tsx`) adds a "Model" `<select>` next to the
  RAG toggle — **Local (Ollama · qwen2.5:3b)** or **Cloud (OpenRouter, free
  tier)** — so the user can switch providers live, per message, with no
  restart. Each response is sent back with `provider: "ollama" | "cloud"` and
  the UI shows a small tag under the assistant message indicating which one
  answered.
- System prompts, validation, and message-history logic in the routes are
  unchanged; only the model-calling boundary is swapped.
- The cloud API key lives in `apps/api/.env` (gitignored), documented in
  `.env.example`.

## Non-goals (deferred to later stages)

- No automatic fallback logic between providers yet (Stage 7).
- No cost/latency benchmarking framework yet (Stage 6 covers evaluation).
- Only one cloud provider wired (OpenRouter); adding Groq/Gemini later is a
  matter of adding another file next to `cloud.ts` and a new `LlmProvider`
  union member — the UI `<select>` and `provider.ts` dispatch are already
  built to support more than two options.

## Acceptance criteria

The same `/api/chat` and `/api/chat/rag` requests produce a comparable answer
whether `provider: "ollama"` or `provider: "cloud"` is sent in the request
body (or omitted, defaulting to `ollama`), with no restart required to switch
between them.

## How to run the app

```bash
cd /home/devarapallim/Murali/git-personal/customer-compass
docker-compose up -d db ollama
cd apps/api
cp .env.example .env
# edit .env: set OPENROUTER_API_KEY to your own free key from
# https://openrouter.ai/keys (LLM_PROVIDER can stay "ollama" — it's just
# the default when a request omits `provider`)
cd ../..
npm install
npm run dev
```

This starts both the API (`http://localhost:3001`) and the web app
(`http://localhost:5173`). No env var changes or restarts are needed to
switch providers afterwards — that's done live from the UI or per request.

## How to test manually

1. **Browser walkthrough (recommended)** — open `http://localhost:5173`,
   pick **Local (Ollama)** in the "Model" dropdown, ask a question, then
   switch the dropdown to **Cloud (OpenRouter)** and ask again *without
   restarting anything*. Confirm the small provider tag under each answer
   matches your selection.
2. **Local provider via curl (default/no regression)**
   ```bash
   curl -s -X POST http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Say hi in 5 words."}]}'
   ```
   Expect `{"message": "...", "provider": "ollama"}` — same behavior as
   Stage 2/3, provider defaults to `ollama` when omitted.
3. **Cloud provider via curl, same server, no restart**
   ```bash
   curl -s -X POST http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Say hi in 5 words."}],"provider":"cloud"}'
   ```
   Expect `{"message": "...", "provider": "cloud"}`.
4. **Grounded RAG chat works with both providers**
   ```bash
   curl -s -X POST http://localhost:3001/api/chat/rag \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Does the Fleet Visibility package include alerting?"}],"provider":"cloud"}'
   ```
   Expect citations to still appear — retrieval is unaffected by provider
   choice; repeat with `"provider":"ollama"` and compare.
5. **Missing/invalid cloud API key fails clearly**
   Temporarily blank out `OPENROUTER_API_KEY` in `.env`, restart the API, and
   send a `provider: "cloud"` request — confirm a clear `5xx`/error message
   rather than a hang or silent crash. Restore the key afterwards.

## Developer note

Files/modules added or changed for this increment:

- `apps/api/src/llm/provider.ts` — `generate(systemPrompt, messages,
  provider?)`; per-request provider selection with env-var fallback.
- `apps/api/src/llm/types.ts` — shared `ChatMessage` type.
- `apps/api/src/llm/ollama.ts` — existing Ollama call, extracted unchanged.
- `apps/api/src/llm/cloud.ts` — OpenRouter client (OpenAI-compatible
  request/response mapping); holds the current default free model slug.
- `.env.example` — documents `LLM_PROVIDER`, `OLLAMA_URL`/`OLLAMA_MODEL`,
  `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`, and how to refresh the free-model
  list.
- `apps/api/src/routes/chat.ts` — both routes accept an optional `provider`
  field, validate it via `resolveProvider()`, and echo the resolved provider
  back in the response.
- `apps/web/src/main.tsx` / `styles.css` — "Model" `<select>` UI control and
  per-message provider tag.
