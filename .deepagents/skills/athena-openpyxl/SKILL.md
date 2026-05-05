---
name: athena-openpyxl
description: Use this skill any time the task involves authoring, editing, or programmatically generating an Excel workbook through Athena's hosted XLSX Studio. Trigger on requests like "build a spreadsheet about X", "fill in this XLSX template", "edit sheet N of this workbook", "athena-openpyxl", "xlsx-studio", `execute_spreadsheet_code`, or any Python that produces or modifies an `.xlsx` for an asset that lives on Athena — even when the user doesn't name the package. Prefer this skill over plain openpyxl for any workbook that lives on a Spreadsheet asset, since edits round-trip through XLSX Studio's Y.Doc/Keryx pipeline for live collaboration with Olympus's `@rowsncolumns/y-spreadsheet` renderer.
---

# athena-openpyxl

Athena's drop-in `openpyxl` replacement. Imports look identical (`from openpyxl import Workbook`), but every cell mutation flushes through XLSX Studio's command bus into a Y.Doc — so collaborators see edits live in Olympus, and the Y.Doc state is the source of truth.

## Setup

```bash
pip install athena-openpyxl
```

Two env vars need to be set for the SDK to run by default:

| Env var | Value |
|---|---|
| `ATHENA_XLSX_API_KEY` | Same as `ATHENA_API_KEY` — your Athena API key works for both. In the Daytona computer-asset sandbox both vars are injected directly into the process env at `/initialize` time, so any subprocess (`langgraph dev`, terminals, ad-hoc Python execs) inherits them automatically. Outside the sandbox, set it explicitly: `export ATHENA_XLSX_API_KEY="$ATHENA_API_KEY"`. |
| `ATHENA_XLSX_BASE_URL` | `https://xlsx-studio.stg.athenaintel.com` (staging) or `https://xlsx-studio.athenaintel.com` (prod). Set automatically in the Daytona sandbox based on agora's deployment environment. |

You can also pass `base_url=` / `api_key=` to the `Workbook` constructor / class methods if you don't want to set env vars. The xlsx-studio API resolves the caller's workspace from their API key by calling agora's `GET /api/xlsx-studio/assets/:id/access` (same pattern as docx-studio) — you do **not** need to pass a workspace id for Athena assets. `ATHENA_ORG_ID` and the `org_id=` arg are kept as a back-compat fallback for older API builds; new code should leave them unset.

## Three entry points — pick by what's available

| You have | Use | Resulting workbook id |
|---|---|---|
| An Athena spreadsheet asset (`asset_<uuid>`) | `Workbook(workbook_id="asset_…")` | the existing `asset_<uuid>` |
| A local `.xlsx` template | `Workbook.upload("template.xlsx")` (or `load_workbook("template.xlsx")`) | `wb_<id>` (uploaded to xlsx-studio) |
| Nothing — start blank | `Workbook.create(name="…")` | a brand-new `asset_<uuid>` registered in the caller's Athena workspace |

`Workbook.create()` registers a real Athena Spreadsheet asset (the workbook shows up in the user's workspace immediately). It accepts the same workspace-resolution semantics as docx-studio's `Document.create()` — pass `workspace_id=` / `parent_folder_id=` to override placement; otherwise the caller's `current_workspace_id` is used.

If you need a standalone xlsx-studio workbook that does *not* land in the workspace (rare — testing/scratch only), use `Workbook.create_standalone(name="…")` which keeps the legacy `wb_<id>` Fastify-stub semantics.

## The core loop

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

with Workbook.create(name="Q4 Forecast") as wb:
    ws = wb.active
    ws.title = "Forecast"

    ws["A1"] = "Quarter"
    ws["B1"] = "Revenue"
    ws["A2"] = "Q1"
    ws["B2"] = 120000
    ws["B3"] = "=SUM(B2:B2)"        # leading "=" → SetCellFormula
    ws["A1"].font = Font(bold=True)  # any styled-property setter → SetCellStyle
    # save flushes the buffer and downloads the export
    wb.save("forecast.xlsx")
```

Three command paths that the server applies on top of the same Y.Doc:

| Setter shape | Server command | Notes |
|---|---|---|
| `ws[...] = "text" / number / bool / None` | `SetCellValue` | type inferred from the Python value |
| `ws[...] = "=…"` | `SetCellFormula` | leading `=` triggers the formula path |
| `cell.font / fill / border / alignment / number_format = ...` | `SetCellStyle` | _any_ style setter re-emits the full style dict for that cell — the Cell proxy holds onto every prior style locally and re-sends them all together, so the last write wins per cell across any property |

Reads (`cell.value`, `iter_rows`, `max_row`, `merged_cells`) are served from the in-memory snapshot loaded at `Workbook(...)` open time. **The proxy does not auto-refresh after a write** — the snapshot only updates on `create_sheet` / `copy_worksheet` (which re-`_load_snapshot()` after flushing). If you need to read your own writes, call `wb._load_snapshot()` explicitly or just trust the values you set.

## Buffering and `wb.batch()`

`CommandBuffer` defaults to `auto_batch=True` with a 2.0s idle auto-flush timer. Practical effects:

- Many writes in a tight loop coalesce into one HTTP round-trip.
- After ~2s of idle, the timer fires and ships whatever's pending.
- `wb.save()` and `wb.close()` flush synchronously, as do `create_sheet`, `copy_worksheet`, and the `with wb.batch():` exit.

`with wb.batch():` is **not** for atomicity (it's not transactional on the server side) — it's for grouping mutations into one logical activity-log entry and one HTTP round-trip. Use it when you're authoring a hundred cells and don't want to wait on the auto-flush timer:

```python
with wb.batch():
    for row in data:
        ws.append(row)
# all SetCellValue commands ship in one /commands POST when the with-block exits
```

`openpyxl.flush_all()` is invoked by the Daytona sandbox prelude at end-of-execution — every still-open Workbook gets its pending buffer flushed, so you don't lose writes when user code returns without calling `wb.save()` / `wb.close()`.

## Save / export

`wb.save("out.xlsx")` calls `POST /workbooks/{id}/export`, polls `GET /workbooks/{id}/export/{job}` until the job is `completed`, then downloads the presigned URL. The export route is implemented by xlsx-studio's hosted API in staging/prod (the local Fastify stub does **not** ship `/export` yet — see "Local development" below).

`save()` always flushes the buffer first, so you do not need a manual `wb._buffer.flush()` before it.

## Sheet operations

```python
notes = wb.create_sheet(title="Notes")   # appends; flushes immediately
notes.title = "Notes (final)"            # rename → RenameSheet
copy = wb.copy_worksheet(notes)          # → CloneSheet, flushes
wb.move_sheet(notes, offset=-1)          # → ReorderSheets (buffered)
wb.remove(copy)                          # → DeleteSheet (buffered)
```

`create_sheet` and `copy_worksheet` flush + re-load the snapshot so you can immediately use the returned `Worksheet`. `remove` / `move_sheet` are buffered.

## Range and bulk reads

```python
ws["A1:C3"]                # tuple of tuples of Cells (read-only — you cannot assign to a range)
ws["A"]                    # column slice, tuple of Cells
ws[1]                      # row 1, tuple of Cells
for row in ws.iter_rows(min_row=2, values_only=True):
    print(row)
ws.append(["Q5", 240000, 120000])   # inserts at max_row+1
```

`ws[range_str] = ...` is **not implemented** — assignments must be per-cell. Use `ws.append`, a tight loop, or `with wb.batch():` for bulk writes.

## Styles

Five descriptor classes live at `openpyxl.styles`, mirroring stock openpyxl:

```python
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment

cell.font = Font(name="Inter", size=12, bold=True, color="#FFFFFF")
cell.fill = PatternFill(fill_type="solid", fgColor="#1F4E78")
cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
cell.border = Border(
    left=Side(style="thin", color="#999"),
    right=Side(style="thin", color="#999"),
    top=Side(style="thin", color="#999"),
    bottom=Side(style="thin", color="#999"),
)
cell.number_format = '"$"#,##0.00'
```

Color shorthand: pass `"#RRGGBB"` (the SDK normalizes it). For number formats, the constants at the top of `openpyxl/__init__.py` (`FORMAT_CURRENCY_USD`, `FORMAT_PERCENTAGE`, `FORMAT_DATE_YYYYMMDD2`, etc.) match openpyxl's `numbers` module.

`Alignment.vertical="center"` is silently rewritten to the API's `"middle"` — that's deliberate, the rendered output ends up identical.

## Things that work end-to-end today (v0.6.1)

- Single-cell I/O: strings, numbers, bools, formulas, None.
- Range reads, `iter_rows`, `iter_cols`, `append`.
- Sheet CRUD: `create_sheet`, `remove`, `move_sheet`, `copy_worksheet`, `ws.title = …`.
- Cell styling (font, fill, border, alignment, number_format) — last-write-wins per cell.
- `merge_cells` / `unmerge_cells` (string range or explicit row/col).
- `wb.batch()` context manager.
- Workbook properties (`wb.properties.title / creator / subject / keywords / description`).
- **Conditional formatting** — `ws.conditional_formatting.add(range, rule)` with
  `CellIsRule`, `FormulaRule`, `ColorScaleRule`, `TopRule`, `UniqueRule`, `DuplicateRule`
  (all six rule classes from `openpyxl.formatting.rule` / `openpyxl.conditional_formatting`).
- **Data validations** — `ws.add_data_validation(DataValidation(...))` with the
  full openpyxl rule set (NUMBER_BETWEEN, ONE_OF_LIST, CUSTOM_FORMULA, etc.).
- **Tables** — `ws.add_table(Table(...))`, `ws.remove_table(name_or_id)`. Style
  via `TableStyleInfo`. Round-trips via `Table.from_table_view`.
- **Charts** — `ws.add_chart(LineChart() / BarChart() / PieChart() / ScatterChart() / AreaChart())`.
  Use `Reference` for domain + series (matches stock openpyxl).
- **Pivot tables** — `wb.pivot_tables.append(PivotTable(...))` with `PivotField` + `PivotValue`.
- **Named ranges** — `wb.create_named_range(...)` / `wb.defined_names`.
- **Cell comments** — `cell.comment = Comment("text", "author")`.

## Things that are rough or unimplemented in v0.6.1

The SDK API surface compiles for these, but the server-side applier or route is incomplete or buggy on the current staging branch — flag and confirm with the user before relying on them in agent code.

| Surface | Status | Symptom / workaround |
|---|---|---|
| `ws.column_dimensions["A"].width = …` | broken on staging | `SetColumnWidth` / `SetRowHeight` apply against a frozen rowsncolumns proxy and reject with "Attempting to define property on object that is not extensible." Width / height **read** still works. Workaround: leave widths default and let the renderer auto-fit, or set them after export by post-processing the `.xlsx` with stock openpyxl. |
| `ws.freeze_panes = "A2"` | broken on staging | Same frozen-proxy issue on `SetSheetProperties`. Workaround: same as above. |
| `ws.auto_filter.ref = "A1:D10"` | command path exists but applier fidelity is unverified |
| `wb.save("out.xlsx")` against the local Fastify stub | route `/workbooks/{id}/export` is not implemented in `apps/api` | The hosted staging/prod service implements export; locally, see "Local development" for the snapshot-replay workaround. |
| Hyperlinks, images, sheet/workbook protection writes, macros, page setup writes | not in v0.6.1 surface | Tier C — read [`xlsx-studio/python-sdk/CLAUDE.md`](../../xlsx-studio/python-sdk/CLAUDE.md) and `API_PARITY_REPORT.md` for the current state before touching these. |

The intentional deviations from stock openpyxl are pinned in [`xlsx-studio/python-sdk/docs/API_PARITY_EXCEPTIONS.md`](../../xlsx-studio/python-sdk/docs/API_PARITY_EXCEPTIONS.md). The SDK's MANDATORY rule is "100% openpyxl parity" — do **not** add convenience methods, kwargs, or aliases that don't exist in stock openpyxl.

## Authoring against an Athena asset

For the Daytona sandbox path, the workbook id is the `asset_<uuid>` string and you also need the workspace id:

```python
from openpyxl import Workbook

wb = Workbook(workbook_id="asset_3a9328bc-9c1c-4498-be8f-bda3883276f5")
# No workspace id needed — xlsx-studio resolves it from your API key.
ws = wb.active
ws["A1"] = "live edit"
wb.close()   # flushes pending → /commands → Keryx → Olympus
```

The `apps/api` resolves the workspace from your API key by calling agora's `GET /api/xlsx-studio/assets/:id/access` (an `ownershipPreHandler` runs before every per-asset route), then connects to keryx-staging using the room `{workspace_id}/{asset_id}` (no `xlsx/` prefix — that's the user-workbook room format, while Athena assets go under their workspace). The user sees the edit live in `@rowsncolumns/y-spreadsheet`.

## Local development

If you need to exercise the SDK without a working hosted xlsx-studio:

1. Set `KERYX_WS_URL=wss://keryx-staging.athenaintel.com` and `KERYX_AUTH_PRIVATE_KEY=<JWK from Infisical>` in `xlsx-studio/apps/api/.env.local`.
2. `cd xlsx-studio/apps/api && bun run start` (defaults to port 3000, set `PORT=3001` in env if you want).
3. Point the SDK at it: `ATHENA_XLSX_BASE_URL=http://localhost:3001 ATHENA_XLSX_API_KEY=anything-nonempty` (NODE_ENV=development bypasses PropelAuth validation in `apps/api/src/auth.ts`).
4. The local stub does NOT implement `/workbooks/{id}/export`. To produce a real `.xlsx`, fetch `GET /workbooks/{id}/snapshot` and replay it through stock openpyxl — `scripts/snapshot_to_xlsx.py` does exactly this.

## Errors

Catch `openpyxl.XlsxSdkError` for everything from this SDK. Common subclasses: `RemoteError, ValidationError, ConflictError, AuthenticationError, ConnectionError, UploadError, ExportError, RenderError, UnsupportedFeatureError`. The `RemoteError` `.message` typically wraps the server's per-command failure list (one entry per command index in the batch) — useful for finding which command in a batched flush failed.

## Reference files

- `references/api-reference.md` — full v0.6.1 surface (entry points, sheets, cells, styles, ranges, errors, commands)
- `references/troubleshooting.md` — the staging/prod gotchas, frozen-proxy bugs, snapshot caching, batch ordering, dual-venv local dev

## Helper scripts

- `scripts/smoke_test.py` — verifies `ATHENA_XLSX_BASE_URL` + `ATHENA_XLSX_API_KEY` against an existing workbook id (read-only).
- `scripts/demo_workbook.py` — authors a four-sheet reference example covering values, formulas, styles, merges, batches.
- `scripts/snapshot_to_xlsx.py` — fetches a workbook snapshot from `apps/api` and writes a real `.xlsx` via stock openpyxl. Useful for local dev when `/export` isn't wired up yet.

All three read `ATHENA_XLSX_BASE_URL` and `ATHENA_XLSX_API_KEY` from the environment. `snapshot_to_xlsx.py` requires a stock-openpyxl venv on the side (the SDK's editable install displaces stock openpyxl in the same site-packages).
