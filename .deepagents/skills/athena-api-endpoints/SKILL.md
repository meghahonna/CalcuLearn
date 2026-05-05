---
name: athena-api-endpoints
description: Catalog of every Athena Public API endpoint with discovery recipes for AOPs, assets, threads, databases, and tools
---

# Athena Public API — Endpoint Catalog

A flat reference for every public REST endpoint. Use this when you know **what** you want to do but not **which URL** to hit. For SDK code examples, see `/athena-typescript-sdk` or `/athena-python-sdk`.

---

## Base URL + auth

```
Base URL:  $ATHENA_API_URL    (often https://api.athenaintel.com/api/v0)
Auth:      X-API-KEY: $ATHENA_API_KEY
```

Both `ATHENA_API_URL` and `ATHENA_API_KEY` are pre-injected into this sandbox's environment. Read `$ATHENA_API_URL` from env rather than hardcoding the host — its value resolves to the right backend whether the workspace runs against production, staging, or a preview deployment.

### Building request URLs in JavaScript / TypeScript

**Don't use `new URL(path)` to build request URLs against a relative or proxy base.** The browser's `URL` constructor requires a full absolute URL — passing a relative path (`new URL('/aop/execute-async')`) or a path against a Vite-proxied base (`new URL('/api/v0/aop/execute-async')`) throws `TypeError: URL constructor: ... is not a valid URL`. This is a common JS gotcha that's easy to miss when migrating between dev (proxy) and prod (full host).

Use template strings instead:

```ts
// ❌ Wrong — throws in the browser if base is relative
const u = new URL(`/aop/execute-async`);

// ❌ Also wrong — same problem
const u = new URL(`/aop/execute-async`, '/api/v0');

// ✅ Right — template string against $ATHENA_API_URL
const url = `${process.env.ATHENA_API_URL}/aop/execute-async`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'X-API-KEY': process.env.ATHENA_API_KEY!,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ asset_id, user_inputs }),
});

// ✅ Or, if you DO need a URL object (e.g. for query string building),
// pass an absolute base as the second argument:
const u = new URL('aop/execute-async', `${process.env.ATHENA_API_URL}/`);
```

The trailing slash on the base in the second example matters — without it, `URL` strips the last path segment when resolving the relative argument.

---

## AOPs (Agent Operating Procedures)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/aop/execute-async` | Start an AOP execution. Returns `thread_id` immediately. **Recommended.** |
| `POST` | `/aop/execute` | Sync execution. **Deprecated** — use `execute-async`. |
| `POST` | `/aop/retry` | Retry a failed AOP execution. |

**Request body** for `execute-async`:
```json
{
  "asset_id": "asset_<uuid>",
  "user_inputs": { "company": "Acme Corp", "quarter": "Q1 2024" }
}
```

**Response**:
```json
{
  "status": "started",
  "thread_id": "thread_abc123",
  "aop_title": "Q1 Report Generator"
}
```

### Discovering AOPs in the workspace

There's no `/aop/list` endpoint. AOPs are stored as assets — list them via `/assets` with a filter on `athena_converted_type`:

```bash
curl -G "$ATHENA_API_URL/assets" \
  -H "X-API-KEY: $ATHENA_API_KEY" \
  --data-urlencode 'filters={"athena_converted_type":"aop","is_archived":false}' \
  --data-urlencode 'sort=[{"field":"updated_at","direction":"desc"}]' \
  --data-urlencode 'limit=100'
```

The returned `items[*].id` is the `asset_id` you pass to `/aop/execute-async`.

### Before executing: read the AOP first

**Always read the AOP's content before calling `/aop/execute-async`.** The content endpoint returns the AOP's full configuration — prompt, input schema, output schema, agent config — in a single call. This tells you exactly what `user_inputs` to pass and what response format to expect.

```bash
curl -G "$ATHENA_API_URL/tools/asset/content" \
  -H "X-API-KEY: $ATHENA_API_KEY" \
  --data-urlencode "asset_id=$AOP_ASSET_ID"
```

The response is a text document with labeled sections. The two most useful for programmatic integration:

**`=== STRUCTURED INPUTS SCHEMA ===`** — a JSON Schema describing the `user_inputs` payload the AOP expects. Use the exact field names from `properties` when constructing your `user_inputs` object for `/aop/execute-async`. Example content:

```json
{
  "type": "object",
  "properties": {
    "Company": { "type": "string" },
    "Quarter": { "type": "string" }
  },
  "required": ["Company", "Quarter"]
}
```

If this section is absent, the AOP takes no user inputs — call `/aop/execute-async` with `user_inputs: {}` or omit it entirely.

**`=== STRUCTURED OUTPUT SCHEMA ===`** — a JSON Schema constraining the AOP's response format. When present, the AOP returns structured data matching this schema (useful for building UI parsers or downstream integrations). When absent, the AOP returns freeform text.

The response also includes the AOP's full prompt template (with `[[ Variable_Name ]]` placeholders visible), the assigned agent ID, and any custom agent configuration overrides — all useful context for understanding what the AOP does before executing it.

**Recommended workflow:**
1. Read the AOP: `GET /tools/asset/content?asset_id=<aop_id>`
2. Parse the input schema from the `=== STRUCTURED INPUTS SCHEMA ===` section
3. Build your `user_inputs` payload with the correct field names
4. Execute: `POST /aop/execute-async` with the `asset_id` and `user_inputs`
5. Poll `GET /threads/{thread_id}/status` until `status` is `completed`
6. If the AOP has a structured output schema, parse the result accordingly

---

## Threads

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/threads/{thread_id}/status` | Poll execution status. |
| `POST` | `/threads/{thread_id}/stop` | Cancel a running thread. |
| `POST` | `/threads/stop` | Stop multiple threads (body: `{ "thread_ids": [...] }`). |
| `POST` | `/threads/batch-stop` | Bulk stop variant. |

**Status response**:
```json
{
  "thread_id": "thread_abc123",
  "status": "running",
  "conversation_asset": {
    "num_messages": 5,
    "last_message": { "role": "assistant", "content": "..." }
  }
}
```

**Status values:** `running`, `completed`, `failed`.

### Polling pattern

```bash
while [ "$status" = "running" ]; do
  sleep 2
  status=$(curl -s -H "X-API-KEY: $ATHENA_API_KEY" \
    "$ATHENA_API_URL/threads/$THREAD_ID/status" | jq -r .status)
done
```

---

## Assets

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/assets` | Paginated list with filters + sort. |
| `GET` | `/assets/{asset_id}` | Get one asset by ID. |
| `POST` | `/assets/create` | Create a new asset (document, sheet, folder, etc.). |
| `POST` | `/assets/{asset_id}/archive` | Soft-delete an asset. |
| `POST` | `/assets/create_project` | Create a project asset with metadata + sharing. |
| `POST` | `/assets/edit_project` | Update project metadata. |

### `GET /assets` query params

| Param | Type | Notes |
|---|---|---|
| `limit` | int (1-500) | Page size, default 50. |
| `offset` | int | Pagination offset. |
| `filters` | JSON string | See filter recipes below. |
| `sort` | JSON string | `[{"field":"updated_at","direction":"desc"}]` |

### Filter recipes

Pass `filters` as a URL-encoded JSON string. Common keys:

| Key | Example | Use case |
|---|---|---|
| `athena_converted_type` | `"aop"`, `"document"`, `"spreadsheet"` | Filter by asset type |
| `media_type` | `"application/pdf"` | MIME-type filter |
| `tags` | `{"project": "alpha", "team": "ml"}` | Tag-based |
| `is_archived` | `false` | Hide soft-deleted |
| `is_hidden` | `false` | Hide hidden assets |
| `created_after` / `created_before` | `"2024-01-01T00:00:00Z"` | Date range |
| `updated_after` / `updated_before` | ISO date | Date range |
| `title_substring` | `"quarterly"` | Title search |
| `created_by_email` | `"alice@company.com"` | Owner filter |
| `summary_ready` | `true` | Only assets with generated summaries |

Admin users can also filter by `workspace_id` / `workspace_name`.

### Example: list all PDFs uploaded this week

```bash
curl -G "$ATHENA_API_URL/assets" \
  -H "X-API-KEY: $ATHENA_API_KEY" \
  --data-urlencode 'filters={"media_type":"application/pdf","created_after":"2024-04-01T00:00:00Z","is_archived":false}' \
  --data-urlencode 'sort=[{"field":"created_at","direction":"desc"}]'
```

---

## Databases

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/databases/{asset_id}/data` | List tables in the database. |
| `GET` | `/databases/{asset_id}/data/{table}` | Query rows (SELECT). |
| `POST` | `/databases/{asset_id}/data/{table}` | Insert rows. |
| `PATCH` | `/databases/{asset_id}/data/{table}` | Update rows (filters required). |
| `DELETE` | `/databases/{asset_id}/data/{table}` | Delete rows (filters required). |
| `GET` | `/databases/{asset_id}/schema/{table}` | Table schema (columns, types, nullability). |
| `GET` | `/databases/{asset_id}/compute-status` | Database compute health. |
| `POST` | `/databases/{asset_id}/sql` | Execute raw SQL. |

### PostgREST-style filters

Pass filters as query params on `/databases/{id}/data/{table}`:

| Operator | Example | Meaning |
|---|---|---|
| `eq` | `?status=eq.active` | equals |
| `neq` | `?status=neq.archived` | not equals |
| `gt` / `gte` | `?age=gt.18` | greater than (or equal) |
| `lt` / `lte` | `?revenue=lt.10000` | less than (or equal) |
| `like` / `ilike` | `?name=ilike.*alice*` | LIKE / case-insensitive LIKE |
| `in` | `?id=in.(1,2,3)` | IN list |
| `is.null` | `?deleted_at=is.null` | NULL check |

Combine with `select=col1,col2`, `order=col.desc`, `limit=N`, `offset=N`.

### UPDATE / DELETE require filters

To prevent accidental full-table writes, `PATCH` and `DELETE` require at least one filter param. To intentionally affect every row, add `?force=true`.

---

## SQL snippets

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/query/sql/snippet/execute` | Execute a saved SQL snippet by `snippet_asset_id`. |

---

## Agents

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/agents/research/invoke` | Research agent. |
| `POST` | `/agents/sql/invoke` | SQL agent. |
| `POST` | `/agents/drive/invoke` | Drive agent. |
| `POST` | `/agents/{agent_id}/invoke` | Custom agent by ID. |

**Request body** (shape varies by agent):
```json
{
  "config": { "search_depth": "deep" },
  "messages": [{ "role": "user", "content": "Market trends in AI" }]
}
```

---

## Tools (file + email + calendar + tasks)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/tools/contents` | List folder contents. |
| `GET` | `/tools/file/data-frame` | Get a tabular asset as a DataFrame-like object. |
| `GET` | `/tools/file/raw-data` | Stream a file's raw bytes. |
| `GET` | `/tools/raw-data` | Alternate raw-bytes endpoint. |
| `POST` | `/tools/asset/chunks` | Get chunked asset content (for RAG). |
| `GET` | `/tools/asset/content` | Get extracted plaintext from an asset. |
| `GET` | `/tools/asset/screenshot` | Render a page of an asset as a PNG. |
| `POST` | `/tools/file/save` | Upload a file as a new asset. |
| `GET` | `/tools/email/search` | Search the user's email. |
| `POST` | `/tools/email/draft` | Create an email draft. |
| `POST` | `/tools/email/send` | Send an email. |
| `GET` | `/tools/calendar/events` | List calendar events. |
| `POST` | `/tools/calendar/events` | Create a calendar event. |
| `POST` | `/tools/tasks/run` | Run a task. |
| `POST` | `/tools/execute` | Execute a generic tool by name. |

---

## Error response shapes

All endpoints return JSON errors with consistent shape:

| Status | Body | Meaning |
|---|---|---|
| `400` | `{ "detail": "..." }` | Bad request (invalid params, missing required field) |
| `401` | `{ "detail": "Unauthorized" }` | Missing or invalid `X-API-KEY` |
| `404` | `AssetNotFoundError` shape | Asset/thread/database not found |
| `422` | `{ "detail": [...] }` | Pydantic validation error |
| `500` | `{ "detail": "..." }` | Internal server error |

Retry only `5xx` and network errors. `4xx` errors will not succeed on retry.

---

## Authoritative reference

Full schemas, request/response models, and per-endpoint examples live at https://docs.athenaintel.com — fetch the docs site if you need exact field types or unfamiliar params.
