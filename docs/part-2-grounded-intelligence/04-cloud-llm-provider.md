# Stage 4 — Cloud LLM provider option

**Part:** II — Grounded Intelligence
**Status:** Planned

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

## Candidate providers (free tier)

Pick one to start; the abstraction should make adding a second trivial later.

| Provider | Notes |
| --- | --- |
| Groq | Free tier, very low latency, OpenAI-compatible API |
| OpenRouter | Free-tier models available, OpenAI-compatible API |
| Google Gemini (free tier) | Generous free quota, own SDK/API shape |

## Intended design

```text
POST /api/chat, /api/chat/rag
        |
        v
apps/api/src/llm/provider.ts   (selects backend by config/env var)
        |              \
        v               v
  ollama.ts          cloud.ts (Groq/OpenRouter/Gemini)
```

- Introduce `apps/api/src/llm/provider.ts` exposing one `generate()` function
  used by both chat routes, hiding provider-specific request/response shapes.
- Select the active provider via an environment variable
  (e.g. `LLM_PROVIDER=ollama|cloud`), defaulting to `ollama` so existing
  behavior is unchanged unless explicitly opted in.
- Keep the system prompts, validation, and message-history logic in the routes
  unchanged; only the model-calling boundary is swapped.
- Store the cloud API key in an environment variable, never committed, and
  document it in `.env.example`.

## Non-goals (deferred to later stages)

- No automatic fallback logic between providers yet (Stage 7).
- No cost/latency benchmarking framework yet (Stage 6 covers evaluation).
- No provider-selection UI; provider is chosen by server configuration only.

## Acceptance criteria

The same `/api/chat` and `/api/chat/rag` requests produce a comparable answer
whether `LLM_PROVIDER=ollama` or `LLM_PROVIDER=cloud` is set, with no other
code changes required to switch.

## How to run the app

```bash
cd /home/devarapallim/Murali/git-personal/customer-compass
docker-compose up -d db ollama
cp .env.example .env   # add your free-tier cloud API key here
npm install
npm run dev
```

To use the cloud provider instead of local Ollama for one run:

```bash
LLM_PROVIDER=cloud npm run dev
```

## How to test manually

1. **Local provider still works (default/no regression)**
   ```bash
   curl -s -X POST http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Say hi in 5 words."}]}'
   ```
   Expect a normal response, same as Stage 2/3 behavior.
2. **Cloud provider produces a comparable answer**
   Restart the API with `LLM_PROVIDER=cloud`, then repeat the same request.
   Expect a coherent response in a similar shape (`{"message": "..."}`).
3. **Grounded RAG chat works with the cloud provider too**
   ```bash
   curl -s -X POST http://localhost:3001/api/chat/rag \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Does the Fleet Visibility package include alerting?"}]}'
   ```
   Expect citations to still appear — retrieval is unaffected by provider choice.
4. **Missing/invalid cloud API key fails clearly**
   Unset or corrupt the API key with `LLM_PROVIDER=cloud` set, and confirm the
   API returns a clear `5xx` error rather than hanging or crashing silently.
5. **Browser walkthrough** — with each provider active in turn, ask the same
   question in the chat panel at `http://localhost:5173` and compare response
   time and answer quality by eye.

## Developer note

Expected files/modules for this increment:

- `apps/api/src/llm/provider.ts` — provider selection and shared `generate()`
  interface.
- `apps/api/src/llm/ollama.ts` — existing Ollama call, extracted unchanged.
- `apps/api/src/llm/cloud.ts` — new cloud-provider client (OpenAI-compatible
  request/response mapping).
- `.env.example` — documents `LLM_PROVIDER` and the cloud API key variable.
- `apps/api/src/routes/chat.ts` — updated to call `llm/provider.ts` instead of
  Ollama directly; no behavior change when `LLM_PROVIDER=ollama`.
