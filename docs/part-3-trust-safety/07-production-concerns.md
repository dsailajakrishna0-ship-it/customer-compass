# Stage 7 — Production-style concerns

**Part:** III — Trust & Safety
**Status:** Planned

## Goal

Add the smallest set of controls that makes the demonstration credible without
turning a learning project into an enterprise platform.

## Scope categories

| Category | Planned focus |
| --- | --- |
| Must have | basic authentication, authorization-aware retrieval, audit events, safe errors |
| Nice to have | rate limiting, caching, structured logs, request tracing |
| Enterprise extension | model fallback, document versioning, incremental indexing, stale-content workflows |

## Security focus

Document metadata and retrieval filters must enforce user/customer access.
Untrusted content handling and prompt-injection defense are treated in depth in
Stage 8; this stage establishes the authorization/audit boundary they build on.
PII is identified and handled deliberately in logs and prompts.

## Acceptance criteria

The application demonstrates one protected access path, records auditable AI
operations, and has documented boundaries for features deliberately deferred.

## How to run the app

```bash
cd /home/devarapallim/Murali/git-personal/customer-compass
docker-compose up -d db ollama
npm install
npm run dev
```

## How to test manually

1. **Unauthenticated access is blocked**
   ```bash
   curl -i -s http://localhost:3001/api/companies
   # expect HTTP 401 without a valid session/token
   ```
2. **Authenticated access is scoped correctly**
   Log in as a user tied to one company/customer and confirm `/api/companies`
   and `/api/chat/rag` never return another customer's records or citations.
3. **Audit trail exists**
   Perform a chat/RAG request, then inspect the audit table/log and confirm an
   entry was recorded with user, action, and timestamp.
4. **Safe error responses**
   Trigger a server-side error (e.g. malformed request) and confirm the
   response is a generic safe message, not a stack trace or internal detail.
5. **Rate limiting (if implemented)**
   Send a burst of requests quickly and confirm the API returns `429` past the
   configured limit instead of degrading silently.

## Developer note

Expected files/modules for this increment:

- `apps/api/src/auth/` — identity extraction and authorization middleware.
- `apps/api/src/security/` — prompt-input handling and PII/logging policy.
- `apps/api/src/audit/` — audit-event model and writer.
- `apps/api/src/observability/` — structured request/model/retrieval logging.
- `apps/api/src/middleware/` — error responses and rate limiting.
- `db/migrations/...` — users/roles, document ACLs, and audit records as needed.
- `docs/security-model.md` — explicitly documented permissions and deferred
  enterprise extensions.

Existing retrieval APIs must receive authorization context rather than relying on
the UI alone to restrict visible customers.
