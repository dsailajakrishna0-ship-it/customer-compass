# Chat Request Flow (current implementation)

This document replaces the old Stage-2-only version
(`docs/part-1-foundations/02-request-flow.md`), which described a single
`POST /api/chat` call straight out of a monolithic `main.tsx`. Since the
[frontend refactor](./fe-architecture-overview.md) and later backend stages,
the flow goes through dedicated hooks/context/api layers on the frontend and
three chat endpoints on the backend. It now lives in `docs/fe/` because most
of what changed is how the **frontend** builds and sends the request, not the
model-calling logic itself.

## Where each responsibility lives today

| Responsibility | File |
| --- | --- |
| Chat input + submit handling | `apps/web/src/components/chat/ChatInput.tsx` |
| Chat history, mode/provider/model state | `apps/web/src/context/ChatSessionContext.tsx` |
| Building the request + calling the API | `apps/web/src/hooks/useChat.ts` |
| Picking the right endpoint for the mode | `apps/web/src/api/chat.ts` |
| Shared `fetch` wrapper | `apps/web/src/api/client.ts` |
| Mounting the chat routes | `apps/api/src/app.ts` |
| General / RAG / CRM route handlers | `apps/api/src/routes/chat.ts` |
| Picking local (Ollama) vs. cloud (OpenRouter) | `apps/api/src/llm/provider.ts` |
| Document retrieval for grounding | `apps/api/src/rag/retrieve.ts` |
| Structured CRM facts + mode classification | `apps/api/src/crm/queries.ts`, `apps/api/src/chat/router.ts` |

## Pictorial flow — frontend side

```text
┌───────────────┐   submit    ┌──────────────────┐
│  ChatInput.tsx │ ──────────▶ │  useChat() hook   │
└───────────────┘             └─────────┬─────────┘
                                         │ reads chatMode / provider / cloudModel
                                         ▼
                              ┌────────────────────────┐
                              │ ChatSessionContext      │
                              │  (chatMode, provider,   │
                              │   cloudModel, messages)  │
                              └─────────┬──────────────┘
                                         │ sendChat(chatMode, body)
                                         ▼
                              ┌────────────────────────┐
                              │  api/chat.ts             │
                              │  picks endpoint by mode: │
                              │   general → /api/chat    │
                              │   rag     → /api/chat/rag│
                              │   crm     → /api/chat/crm│
                              └─────────┬──────────────┘
                                         │ apiPost()
                                         ▼
                              ┌────────────────────────┐
                              │  api/client.ts           │
                              │  (fetch + JSON wrapper)  │
                              └─────────┬──────────────┘
                                         ▼
                                 Express API (see below)
                                         │
                                         ▼
                         useChat() appends the ChatMessage
                         (content, provider, citations, facts)
                         to ChatSessionContext → MessageList
                         → MessageBubble re-renders
```

## Pictorial flow — backend side (per chat mode)

```text
POST /api/chat            POST /api/chat/rag               POST /api/chat/crm
     │                          │                                 │
     ▼                          ▼                                 ▼
validateMessages()        validateMessages()                validateMessages()
     │                          │                                 │
     │                    retrieveRelevantChunks()          classifyQuery(question)
     │                          │                            ├─ wantsStructured? → getCompanySummary()
     │                          │                            └─ wantsRag?        → retrieveRelevantChunks()
     │                    buildContext(chunks)                     │
     │                          │                            builds combined prompt
     │                          │                            (facts block + cited sources block)
     ▼                          ▼                                 ▼
          generate(systemPrompt, messages, provider, model)
                    │
         ┌──────────┴───────────┐
         ▼                      ▼
   Ollama (local)        OpenRouter (cloud)
   qwen2.5:3b            user-picked free model
         │                      │
         └──────────┬───────────┘
                     ▼
     { message, provider, citations?, facts?, scopedCompany? }
```

## 1. User submits a question

`ChatInput` (`components/chat/ChatInput.tsx`) is a thin, controlled input —
it only owns the text box value and calls `onSubmit` on form submit. All
logic lives in `useChat()`:

```ts
// apps/web/src/hooks/useChat.ts
function askQuestion(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const text = question.trim();
  if (!text || isAsking) return;

  const history = [...messages, { role: "user" as const, content: text }];
  setMessages(history);
  setQuestion("");
  setIsAsking(true);

  const requestBody = { messages: history.slice(-12), provider };
  if (provider === "cloud" && cloudModel) requestBody.model = cloudModel;

  sendChat(chatMode, requestBody)
    .then((body) => setMessages((current) => [...current, {
      role: "assistant",
      content: body.message ?? body.error ?? "Something went wrong.",
      citations: body.citations,
      facts: body.facts,
      scopedCompany: body.scopedCompany,
      provider: body.provider,
    }]))
    .catch(() => setMessages((current) => [...current, {
      role: "assistant",
      content: "I could not reach the API. Check that the local services are running.",
    }]))
    .finally(() => setIsAsking(false));
}
```

`chatMode`, `provider`, and `cloudModel` come from `useChatSession()`
(`context/ChatSessionContext.tsx`) — the same values the user picked in
`ChatModeSelector` and that are persisted to `localStorage`.

## 2. The frontend picks an endpoint by chat mode

```ts
// apps/web/src/api/chat.ts
export function sendChat(mode: ChatMode, body: ChatRequestBody) {
  const path = mode === "rag" ? "/api/chat/rag" : mode === "crm" ? "/api/chat/crm" : "/api/chat";
  return apiPost<ChatResponse>(path, body);
}
```

There are three modes, each hitting a different Express route:

| Mode | Endpoint | Behavior |
| --- | --- | --- |
| `general` | `POST /api/chat` | Plain LLM chat, no CRM/document grounding (original Stage 2 behavior) |
| `rag` | `POST /api/chat/rag` | Retrieves cited document chunks and grounds the answer in them |
| `crm` | `POST /api/chat/crm` | Classifies the question, pulls structured CRM facts and/or cited documents, and combines both in the prompt |

## 3. Express validates and routes the request

Every route shares the same guard before calling any model:

```ts
function validateMessages(messages: unknown): messages is ChatMessage[] {
  return (
    Array.isArray(messages) &&
    messages.length > 0 && messages.length <= 12 &&
    messages.every((m) =>
      (m?.role === "user" || m?.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0 && m.content.length <= 4_000)
  );
}
```

- **`/api/chat`** calls `generate(generalSystemPrompt, messages, provider, model)` directly.
- **`/api/chat/rag`** calls `retrieveRelevantChunks(question)`, builds a numbered source context with `buildContext()`, and asks the model to cite `[1]`, `[2]`, etc.
- **`/api/chat/crm`** calls `classifyQuery(question)` first to decide whether the question needs structured facts (`getCompanySummary()`), document retrieval, or both, then combines a "Verified CRM facts" block (never needs a citation) with a "Source documents" block (always needs one).

## 4. `generate()` picks the LLM provider

```ts
// apps/api/src/llm/provider.ts (conceptually)
generate(systemPrompt, messages, provider, model)
  // provider === "ollama" → calls http://localhost:11435 (qwen2.5:3b)
  // provider === "cloud"  → calls OpenRouter with the user-picked free model
```

`provider` and `model` are optional per-request overrides sent from the UI's
provider/model selectors; if omitted, the API falls back to
`DEFAULT_LLM_PROVIDER`.

## 5. The response flows back up

The API always responds with the same shape, with optional fields depending
on mode:

```json
{
  "message": "…",
  "provider": "ollama",
  "citations": [{ "number": 1, "title": "…", "similarity": 0.83 }],
  "facts": { "name": "Acme Fabrication", "openDeals": [] },
  "scopedCompany": "Acme Fabrication"
}
```

`useChat()` appends this as a new `ChatMessage` to `ChatSessionContext`,
which re-renders `MessageList` → `MessageBubble`, conditionally showing
`CrmFactsPanel` (for `facts`) and `CitationList` (for `citations`).

## Why this moved out of `docs/part-1-foundations/`

The original `02-request-flow.md` was accurate for Stage 2 only — it quoted
`useState` and `askQuestion` living directly inside `main.tsx`, which no
longer exists after the [frontend layering refactor](./fe-architecture-overview.md).
Keeping a stage-numbered doc that described stale frontend code was more
confusing than useful, so this rewritten version lives alongside the other
frontend docs in `docs/fe/` instead.
