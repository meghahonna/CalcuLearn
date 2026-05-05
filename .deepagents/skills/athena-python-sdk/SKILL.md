---
name: athena-python-sdk
description: Use the athena-intelligence Python client to fetch assets, run AOPs, query databases, work with sheets, and invoke agents
---

# athena-intelligence — Python Client

The official Athena Python SDK. Use this when you want a typed client instead of raw `requests` calls. Includes sync (`Athena`) and async (`AsyncAthena`) variants.

For raw HTTP examples (curl/fetch), see `/athena-api-endpoints`.
For the endpoint catalog (every URL the API exposes), see `/athena-api-endpoints`.
For the TypeScript equivalent, see `/athena-typescript-sdk`.

---

## Install

```bash
pip install athena-intelligence
# or with uv:
uv add athena-intelligence
```

---

## Authenticate

`ATHENA_API_KEY` is pre-injected into this sandbox's environment. The client picks it up automatically:

```python
from athena import Athena, AsyncAthena

# Reads ATHENA_API_KEY from env (recommended)
client = Athena()

# Explicit
client = Athena(api_key="sk-...")

# Async variant
aclient = AsyncAthena(api_key="sk-...")
```

The default base URL is `https://api.athenaintel.com`. In this sandbox, the env var `$ATHENA_API_URL` (e.g. `https://api.athenaintel.com/api/v0` on prod, `https://staging-api.athenaintel.com/api/v0` on staging) holds the right REST base URL. The Athena Python SDK appends `/api/v0` itself, so strip the suffix before passing it as `base_url=`:

```python
import os
from athena_intelligence import Athena

api_url = os.environ.get("ATHENA_API_URL", "https://api.athenaintel.com/api/v0")
base_url = api_url.removesuffix("/api/v0")
client = Athena(base_url=base_url)  # client appends /api/v0 itself
```

---

## Assets

### List

```python
assets = client.assets.list(limit=20, offset=0)
for asset in assets.data:
    print(asset.id, asset.title, asset.media_type)
```

Filter and sort with JSON-encoded params:

```python
import json

filtered = client.assets.list(
    limit=50,
    filters=json.dumps({
        "is_archived": False,
        "tags": {"project": "alpha"},
        "created_after": "2024-01-01T00:00:00Z",
    }),
    sort=json.dumps([{"field": "updated_at", "direction": "desc"}]),
)
```

### Get one

```python
asset = client.assets.get(asset_id="asset_abc123")
print(asset.title, asset.media_type, asset.created_at)
```

### Create

```python
result = client.assets.create(
    asset_type="document",          # 'document' | 'spreadsheet' | 'sheet' | 'doc' | 'folder'
    title="Q1 Report",
    parent_folder_id="folder_xyz",  # optional
)
print(result.asset_id)
```

### Create a project (asset with metadata + sharing)

```python
project = client.assets.create_project(
    title="Acme Corp Deal",
    project_type="company",
    custom_metadata={"industry": "tech", "stage": "Series B"},
    share_with_emails=["analyst@company.com"],
    tags=["active", "priority"],
)
```

### Archive

```python
client.assets.archive(asset_id="asset_abc123")
```

---

## File operations (`client.tools.*`)

### List folder contents

```python
# Specific folder
contents = client.tools.list_contents(asset_id="folder_xyz")

# Workspace root — omit asset_id
root = client.tools.list_contents()
```

### Download as bytes (returns BytesIO)

```python
file_bytes = client.tools.get_file(asset_id="asset_abc123")
with open("local-copy.pdf", "wb") as f:
    f.write(file_bytes.read())
```

### Read directly into a DataFrame

```python
import pandas as pd

# Generic asset → DataFrame for tabular data, AthenaAsset otherwise
df = client.tools.get_asset(asset_id="asset_abc123")

# Spreadsheet/CSV → DataFrame with column/row controls
df = client.tools.data_frame(
    asset_id="asset_abc123",
    columns=["Name", "Revenue", "Status"],
    row_limit=100,
    sheet_name="Sheet1",
)

# Excel/CSV/Parquet → DataFrame with kwargs forwarded to pandas
df = client.tools.read_data_frame(asset_id="asset_abc123")
```

### Stream large files

```python
for chunk in client.tools.raw_data(asset_id="asset_abc123"):
    process(chunk)
```

### Save / upload assets

`save_asset` takes a tuple of `(filename, data, content_type)`:

```python
import io
import json
import pandas as pd

# DataFrame → CSV upload
df = pd.DataFrame({"Name": ["Alice", "Bob"], "Score": [95, 87]})
csv_bytes = df.to_csv(index=False).encode("utf-8")
result = client.tools.save_asset(
    file=("scores.csv", csv_bytes, "text/csv"),
    parent_folder_id="folder_xyz",  # optional
)

# DataFrame → Parquet upload
parquet_buffer = io.BytesIO()
df.to_parquet(parquet_buffer, index=False)
result = client.tools.save_asset(
    file=("data.parquet", parquet_buffer.getvalue(), "application/octet-stream"),
)

# Raw bytes (PDF, image, etc.)
with open("report.pdf", "rb") as f:
    result = client.tools.save_asset(
        file=("report.pdf", f.read(), "application/pdf"),
    )

# JSON
data = {"key": "value", "items": [1, 2, 3]}
result = client.tools.save_asset(
    file=("data.json", json.dumps(data).encode("utf-8"), "application/json"),
)
```

**Important:** Always convert DataFrames to bytes (CSV or Parquet) before passing to `save_asset`. Passing a `DataFrame` object directly fails with a serialization error.

### Get extracted text content

```python
text = client.tools.get_asset_content(asset_id="asset_abc123")
```

### Get a screenshot of an asset page

```python
screenshot = client.tools.get_asset_screenshot(
    asset_id="asset_abc123",
    page_number=1,
)
```

### `display()` gotcha for DataFrames

The sandbox `display()` helper does **not** handle pandas `DataFrame`/`Series` directly — it crashes with `TypeError: Object of type Series is not JSON serializable`.

```python
# WRONG — crashes
display(df)

# Use print for DataFrames
print(df.to_string())

# Or convert to records for JSON-safe display
display(df.to_dict(orient="records"))

# Plotly figures work directly
import plotly.graph_objects as go
fig = go.Figure(...)
display(fig)
```

**Rule:** Use `display()` only for Plotly figures and JSON-serializable objects. For DataFrames, use `print(df.to_string())` or `print(df.to_markdown())`.

---

## Spreadsheets

```python
sheets = client.tools.sheets

# Update a single cell (1-based indexing)
sheets.update_cell(asset_id="asset_abc", column=1, row=2, value="Hello")

# Update a range
sheets.update_sheet_range(
    asset_id="asset_abc",
    sheet_id=0,
    grid_range={"startRow": 0, "endRow": 5, "startCol": 0, "endCol": 3},
    values=[["A", "B", "C"], [1, 2, 3], [4, 5, 6]],
)

# Get table data
table = sheets.get_table(asset_id="asset_abc", table_name="Sales")

# Insert row
sheets.insert_table_row(
    asset_id="asset_abc",
    table_name="Sales",
    row_data={"Product": "Widget", "Revenue": 5000},
)

# Create new sheet tab
sheets.create_new_sheet_tab(asset_id="asset_abc", sheet_title="Summary")

# Format cells
sheets.format_sheet_range(
    asset_id="asset_abc",
    sheet_id=0,
    grid_range={"startRow": 0, "endRow": 1, "startCol": 0, "endCol": 5},
    text_format={"bold": True},
    cell_format={"backgroundColor": {"red": 0.9, "green": 0.9, "blue": 1.0}},
)
```

---

## Databases

```python
db = client.databases

# List tables
tables = db.list_tables(asset_id="db_asset_id")

# SELECT with PostgREST-style filters
# Operators: eq, neq, gt, gte, lt, lte, like, ilike, in, is.null
data = db.select(
    asset_id="db_asset_id",
    table_name="customers",
    select="name,email,revenue",
    order="revenue.desc",
    limit=50,
)

# INSERT
db.insert(
    asset_id="db_asset_id",
    table_name="customers",
    data={"name": "Alice", "email": "alice@example.com", "revenue": 50000},
    return_representation=True,
)

# UPDATE — filters required (or force=True)
db.update(
    asset_id="db_asset_id",
    table_name="customers",
    data={"status": "active"},
    # filters via query params, e.g. ?revenue=gt.10000
)

# DELETE
db.delete(
    asset_id="db_asset_id",
    table_name="customers",
)

# Schema
schema = db.get_table_schema(asset_id="db_asset_id", table_name="customers")
# Returns column names, types, nullability, defaults

# Raw SQL
result = db.sql(
    asset_id="db_asset_id",
    sql="SELECT name, COUNT(*) AS cnt FROM orders GROUP BY name ORDER BY cnt DESC LIMIT 10",
)
```

---

## SQL snippets

```python
result = client.query.execute_snippet(snippet_asset_id="snippet_abc")
```

---

## Agents

```python
from athena import GeneralAgentRequest, GeneralAgentConfig, InputMessage

# General agent
response = client.agents.general.invoke(
    request=GeneralAgentRequest(
        config=GeneralAgentConfig(enabled_tools=["search", "web_browse"]),
        messages=[InputMessage(content="Latest Tesla news?", role="user")],
    )
)

# Research agent
response = client.agents.research.invoke(
    config={"search_depth": "deep"},
    messages=[{"role": "user", "content": "Market trends in AI infrastructure"}],
)

# SQL agent
response = client.agents.sql.invoke(
    config={"database_ids": ["db_123"]},
    messages=[{"role": "user", "content": "Count active users by region"}],
)

# Drive agent
response = client.agents.drive.invoke(
    config={"folder_path": "/documents"},
    messages=[{"role": "user", "content": "Find all PDF files"}],
)

# Custom agent by ID
response = client.agents.invoke_by_id(
    agent_id="agent_123",
    config={},
    messages=[{"role": "user", "content": "Run analysis"}],
)
```

---

## AOPs (Agent Operating Procedures)

### Execute async (recommended)

```python
from athena import AopExecuteRequestIn

response = client.aop.execute_async(
    request=AopExecuteRequestIn(
        asset_id="aop_asset_id",
        user_inputs={"company": "Acme Corp", "quarter": "Q1 2024"},
    )
)
thread_id = response.thread_id
```

### Poll for completion

```python
import time

status = "running"
while status == "running":
    time.sleep(2)
    result = client.threads.get_status(thread_id=thread_id)
    status = result.status        # 'running' | 'completed' | 'failed'

print(f"AOP finished: {status}")
```

### Stop a running thread

```python
client.threads.stop(thread_id=thread_id)
```

### Discovering AOPs in the workspace

There's no dedicated `/aop/list` endpoint. AOPs are stored as assets — query `client.assets.list` with a filter on `athena_converted_type`:

```python
import json

aops = client.assets.list(
    limit=100,
    filters=json.dumps({
        "athena_converted_type": "aop",
        "is_archived": False,
    }),
)
for aop in aops.data:
    print(aop.id, aop.title)
```

See `/athena-api-endpoints` for more discovery recipes.

---

## Async client

Everything above works with `AsyncAthena` too — just `await` the calls:

```python
import asyncio
from athena import AsyncAthena

async def main():
    client = AsyncAthena()
    asset = await client.assets.get(asset_id="asset_abc123")
    print(asset.title)

asyncio.run(main())
```

---

## Error handling

```python
from athena import (
    AthenaError,
    UnauthorizedError,
    NotFoundError,
    BadRequestError,
    UnprocessableEntityError,
    InternalServerError,
)

try:
    asset = client.assets.get(asset_id="invalid")
except NotFoundError:
    print("Asset not found")
except UnauthorizedError:
    print("Check your API key")
except AthenaError as e:
    print(f"Athena API error: {e.status_code} {e.message}")
```

---

## Common gotchas

- **Use `execute_async` for AOPs**, not `execute`. Sync execution is deprecated.
- **`filters` and `sort` are JSON strings**, not dicts. Use `json.dumps(...)`.
- **DataFrames must be serialized before upload** — convert to CSV bytes or Parquet bytes; never pass a `DataFrame` object directly to `save_asset`.
- **Don't `display()` DataFrames** — use `print(df.to_string())` or convert to records first.
- **Don't retry on 4xx.** Retry only `5xx` and network errors.
