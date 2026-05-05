---
name: athena-typescript-sdk
description: Use the @athenaintel/sdk TypeScript client to fetch assets, run AOPs, query databases, and invoke agents
---

# @athenaintel/sdk — TypeScript / Node Client

The official Athena TypeScript SDK. Use this when you want a typed client instead of raw `fetch` calls. Works in Node and the browser (browser ESM build supported).

For raw HTTP examples (curl/fetch), see `/athena-api-endpoints`.
For the endpoint catalog (every URL the API exposes), see `/athena-api-endpoints`.
For the Python equivalent, see `/athena-python-sdk`.

---

## Install

```bash
pnpm add @athenaintel/sdk
# or: npm install @athenaintel/sdk
```

---

## Authenticate

`ATHENA_API_KEY` is pre-injected into this sandbox's environment. Read it directly:

```ts
import AthenaIntelligence from '@athenaintel/sdk';

const client = new AthenaIntelligence({
  apiKey: process.env.ATHENA_API_KEY!,
});
```

The default base URL is `https://api.athenaintel.com`. In this sandbox, the env var `$ATHENA_API_URL` (e.g. `https://api.athenaintel.com/api/v0` on prod, `https://staging-api.athenaintel.com/api/v0` on staging) holds the right REST base URL. The TypeScript SDK appends `/api/v0` itself, so strip the suffix before passing it as `baseURL`:

```ts
import { AthenaIntelligence } from '@athenaintel/typescript';

const apiUrl = process.env.ATHENA_API_URL ?? 'https://api.athenaintel.com/api/v0';
const baseURL = apiUrl.replace(/\/api\/v0$/, '');
const client = new AthenaIntelligence({
  apiKey: process.env.ATHENA_API_KEY!,
  baseURL,  // SDK appends /api/v0 itself
});
```

---

## Assets

### List

```ts
const assets = await client.assets.list({ limit: 20, offset: 0 });
for (const asset of assets.items) {
  console.log(asset.id, asset.title, asset.media_type);
}
```

Filter and sort with JSON-encoded params:

```ts
const filtered = await client.assets.list({
  limit: 50,
  filters: JSON.stringify({
    is_archived: false,
    tags: { project: 'alpha' },
    created_after: '2024-01-01T00:00:00Z',
  }),
  sort: JSON.stringify([{ field: 'updated_at', direction: 'desc' }]),
});
```

### Get one

```ts
const asset = await client.assets.get({ asset_id: 'asset_abc123' });
console.log(asset.title, asset.media_type, asset.created_at);
```

### Create

```ts
const result = await client.assets.create({
  asset_type: 'document',          // 'document' | 'spreadsheet' | 'sheet' | 'doc' | 'folder'
  title: 'Q1 Report',
  parent_folder_id: 'folder_xyz',  // optional
});
console.log(result.asset_id);
```

### Create a project (asset with metadata + sharing)

```ts
const project = await client.assets.createProject({
  title: 'Acme Corp Deal',
  project_type: 'company',
  custom_metadata: { industry: 'tech', stage: 'Series B' },
  share_with_emails: ['analyst@company.com'],
  tags: ['active', 'priority'],
});
```

### Archive

```ts
await client.assets.archive({ asset_id: 'asset_abc123' });
```

---

## File operations (`client.tools.*`)

### List folder contents

```ts
// Specific folder
const contents = await client.tools.listContents({ asset_id: 'folder_xyz' });

// Workspace root — omit asset_id
const root = await client.tools.listContents({});
```

### Get extracted text content

```ts
const text = await client.tools.getAssetContent({ asset_id: 'asset_abc123' });
```

### Get file as raw bytes (streaming)

```ts
const stream = await client.tools.rawData({ asset_id: 'asset_abc123' });
// Process stream chunks
```

### Get file as a DataFrame-like object

```ts
const df = await client.tools.dataFrame({
  asset_id: 'asset_abc123',
  columns: ['Name', 'Revenue', 'Status'],
  row_limit: 100,
  sheet_name: 'Sheet1',
});
```

### Save / upload a file

```ts
import { Blob } from 'buffer';

await client.tools.fileSave({
  file: new Blob(['col1,col2\n1,2\n'], { type: 'text/csv' }),
  filename: 'data.csv',
  parent_folder_id: 'folder_xyz',
});
```

For binary uploads, pass a `Blob`/`File`/`Buffer` directly. Don't try to send JS objects — convert them first (`JSON.stringify`, `csv-stringify`, etc.).

### Get a screenshot of an asset page

```ts
const screenshot = await client.tools.getAssetScreenshot({
  asset_id: 'asset_abc123',
  page_number: 1,
});
```

### Asset chunks (for RAG / inspection)

```ts
const chunks = await client.tools.assetChunks({ asset_id: 'asset_abc123' });
```

---

## Databases

```ts
// List tables in a database asset
const tables = await client.databases.listTables({ asset_id: 'db_asset_id' });

// SELECT with PostgREST-style filters
const rows = await client.databases.select({
  asset_id: 'db_asset_id',
  table_name: 'customers',
  select: 'name,email,revenue',
  order: 'revenue.desc',
  limit: 50,
  // Filter operators: eq, neq, gt, gte, lt, lte, like, ilike, in, is.null
  // Pass as raw query params: { status: 'eq.active' }
});

// INSERT
await client.databases.insert({
  asset_id: 'db_asset_id',
  table_name: 'customers',
  data: { name: 'Alice', email: 'alice@example.com', revenue: 50000 },
  return_representation: true,
});

// UPDATE — filters required (or force=true)
await client.databases.update({
  asset_id: 'db_asset_id',
  table_name: 'customers',
  data: { status: 'active' },
  // filters via query params, e.g. ?revenue=gt.10000
});

// DELETE — filters required
await client.databases.delete({
  asset_id: 'db_asset_id',
  table_name: 'customers',
});

// Schema
const schema = await client.databases.getTableSchema({
  asset_id: 'db_asset_id',
  table_name: 'customers',
});

// Raw SQL
const result = await client.databases.sql({
  asset_id: 'db_asset_id',
  sql: 'SELECT name, COUNT(*) AS cnt FROM orders GROUP BY name ORDER BY cnt DESC LIMIT 10',
});
```

---

## SQL snippets

```ts
const result = await client.query.executeSnippet({ snippet_asset_id: 'snippet_abc' });
```

---

## Agents

```ts
// Research agent
const research = await client.agents.research.invoke({
  config: { search_depth: 'deep' },
  messages: [{ role: 'user', content: 'Market trends in AI infrastructure' }],
});

// SQL agent
const sql = await client.agents.sql.invoke({
  config: { database_ids: ['db_123'] },
  messages: [{ role: 'user', content: 'Count active users by region' }],
});

// Drive agent
const drive = await client.agents.drive.invoke({
  config: { folder_path: '/documents' },
  messages: [{ role: 'user', content: 'Find all PDF files modified this week' }],
});

// Custom agent by ID
const custom = await client.agents.invokeById({
  agent_id: 'agent_123',
  config: {},
  messages: [{ role: 'user', content: 'Run analysis' }],
});
```

---

## AOPs (Agent Operating Procedures)

### Execute async (recommended)

```ts
const response = await client.aop.executeAsync({
  asset_id: 'aop_asset_id',
  user_inputs: { company: 'Acme Corp', quarter: 'Q1 2024' },
});
const threadId = response.thread_id;
```

### Poll for completion

```ts
let status = 'running';
while (status === 'running') {
  await new Promise((r) => setTimeout(r, 2000));
  const result = await client.threads.getStatus({ thread_id: threadId });
  status = result.status;        // 'running' | 'completed' | 'failed'
}
```

### Stop a running thread

```ts
await client.threads.stop({ thread_id: threadId });
```

### Discovering AOPs in the workspace

There's no dedicated `/aop/list` endpoint. AOPs are stored as assets — query `client.assets.list` with a filter on `athena_converted_type`:

```ts
const aops = await client.assets.list({
  limit: 100,
  filters: JSON.stringify({ athena_converted_type: 'aop', is_archived: false }),
});
for (const aop of aops.items) {
  console.log(aop.id, aop.title);
}
```

See `/athena-api-endpoints` for more discovery recipes.

---

## Error handling

```ts
import {
  AthenaError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
  UnprocessableEntityError,
  InternalServerError,
} from '@athenaintel/sdk';

try {
  const asset = await client.assets.get({ asset_id: 'invalid' });
} catch (err) {
  if (err instanceof NotFoundError) {
    console.error('Asset not found');
  } else if (err instanceof UnauthorizedError) {
    console.error('Check your API key');
  } else if (err instanceof AthenaError) {
    console.error('Athena API error:', err.status, err.message);
  } else {
    throw err;
  }
}
```

---

## Use inside an Athena React frontend tool

The TS SDK runs in the browser (ESM build). You can call it directly from a `frontendTools` definition in `@athenaintel/react`:

```tsx
import type { Toolkit } from '@athenaintel/react';
import AthenaIntelligence from '@athenaintel/sdk';

const athena = new AthenaIntelligence({ apiKey: import.meta.env.VITE_ATHENA_API_KEY });

const DATA_TOOLS: Toolkit = {
  fetch_asset_summary: {
    description: 'Fetch metadata + summary for an Athena asset by ID',
    parameters: {
      type: 'object',
      properties: { asset_id: { type: 'string', description: 'The asset ID' } },
      required: ['asset_id'],
    },
    execute: async ({ asset_id }) => {
      const asset = await athena.assets.get({ asset_id });
      return {
        title: asset.title,
        type: asset.media_type,
        created: asset.created_at,
        summary: asset.summary,
      };
    },
  },
  list_folder: {
    description: 'List contents of an Athena folder',
    parameters: {
      type: 'object',
      properties: {
        folder_id: { type: 'string', description: 'Folder asset ID (omit for workspace root)' },
      },
    },
    execute: async ({ folder_id }) => {
      return athena.tools.listContents({ asset_id: folder_id || undefined });
    },
  },
};
```

Wire it up: `<AthenaProvider frontendTools={DATA_TOOLS} ... />`. See `/athena-react-sdk` for the full provider config.

---

## Common gotchas

- **Use `executeAsync` for AOPs**, not `execute`. Sync execution is deprecated and has no advantages.
- **`filters` and `sort` are JSON strings**, not objects. The list endpoint reads them as query params (`?filters={...}`).
- **Browser usage requires CORS-friendly endpoints**. Athena's API is fine for cross-origin calls, but if you proxy through your own backend you'll need to forward `X-API-KEY`.
- **Don't retry on 4xx.** Retry only `5xx` and network errors. The SDK does not retry by default.
