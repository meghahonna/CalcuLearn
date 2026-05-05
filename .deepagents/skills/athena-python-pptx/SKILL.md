---
name: athena-python-pptx
description: Use this skill any time the task involves authoring, editing, rendering, or programmatically generating a PowerPoint deck through Athena's hosted PPTX Studio. Trigger on requests like "build a deck about X", "fill in this PPTX template", "edit slide N of this deck", "render slide as PNG", "athena-python-pptx", "pptx-studio", or any Python that produces or modifies a .pptx file in this monorepo — even when the user doesn't name the package. Prefer this skill over plain python-pptx for any deck that lives on Athena, since it round-trips edits through PPTX Studio for live collaboration, server rendering, and proper master/theme preservation.
---

# athena-python-pptx

Athena's drop-in `python-pptx` replacement. Imports look identical (`from pptx import Presentation`), but every shape mutation flushes through PPTX Studio — so collaborators see edits live, the server preserves master/theme/layout perfectly, and you get extras like server-side PNG rendering and slide cloning.

## Setup

```bash
pip install athena-python-pptx
export ATHENA_PPTX_BASE_URL=https://pptx-studio.stg.athenaintel.com   # or pptx-studio-api.athenaintel.com for prod
export ATHENA_PPTX_API_KEY=<athena api key>
```

In the Daytona computer-asset sandbox both vars are injected directly into the process env at `/initialize` time, so any subprocess (`langgraph dev`, terminals, ad-hoc Python execs) inherits them automatically — you don't need to set them yourself.

Both env vars must be set, or pass `base_url=` / `api_key=` to `Presentation()`. The SDK has no separate workspace knob — workspace is derived from the API key (see `references/troubleshooting.md` for the staging caveat).

## Three entry points — pick by what's available

| You have | Use | Status |
|---|---|---|
| An Athena deck (`asset_<uuid>`) | `Presentation(deck_id="asset_…")` | ✅ Works everywhere |
| A local `.pptx` template | `Presentation.upload("template.pptx")` | ⚠️ Hits `POST /decks` — currently broken on staging (see troubleshooting) |
| Nothing — start blank | `Presentation.create(name="…")` | ⚠️ Hits `POST /decks/empty` — currently broken on staging |

**When in doubt, start from an existing deck.** Ask the user to create the deck shell in Olympus and pass you its asset id. The existing-deck path is fully functional on every environment.

## Default workflow: fill the template, don't recreate it

The big win of this SDK is that the deck's master, theme, layouts, and decorative shapes already look right. **Treat the deck as a form to fill in.** Don't add layouts from scratch, don't hardcode font names or colors, don't pixel-place text where placeholders already exist.

The full pattern lives in `references/template-workflow.md` — read it before authoring content. The five-step summary:

1. **Inspect** — list `prs.slide_layouts`, walk `prs.slides`, dump shape names + placeholder types per slide. (Run `scripts/inspect_deck.py <deck_id>` to do this in one shot.)
2. **Add slides** by layout: `prs.slides.add_slide(layout)` where `layout` comes from `{l.name: l for l in prs.slide_layouts}`.
3. **`prs.refresh()`** after adding slides so the proxy sees the inherited placeholders.
4. **Populate placeholders** — by **name** for original-deck slides, by **`placeholder_format.type`** for newly-added slides. Why the split is in `references/troubleshooting.md`.
5. **Save / render** — `prs.save("out.pptx")` for ground truth; `slide.render(scale=2, as_pil=True)` for previews. On staging, prefer the saved file — the server renderer has known sizing bugs.

## Writing text — the safe pattern

This pattern survives the SDK gaps documented in `agora/PPTX_SDK_DEPLOYMENT_GUIDE.md`:

```python
text_frame.text = "First paragraph"           # replaces all content with one paragraph
p = text_frame.add_paragraph()
p.text = "Second paragraph"
```

**Avoid** `text_frame.clear()` followed by `add_run()` — Gap-3 in the SDK; renders get unpredictable. **Avoid** setting `font.size` on runs *inside* placeholders unless you have a specific reason — the master/layout already specifies sizes per outline level, and overriding gets fought by the renderer. For **non-placeholder content** (custom textboxes, auto-shapes), explicit `Pt()` sizing is fine and necessary.

**`text_frame.word_wrap`, `text_frame.vertical_anchor`, and `text_frame.margin_*` work correctly end-to-end** as of pptx-studio's `bgeils/fix-sdk-textframe-bodypr` (#19108, merged 2026-04-28). The exporter now plumbs `textFrameProperties` through to `<a:bodyPr>`:

```python
tb = slide.shapes.add_textbox(left, top, width, height)
tf = tb.text_frame
tf.word_wrap = True                    # wraps at shape boundary; no longer overflows
tf.vertical_anchor = MSO_ANCHOR.MIDDLE # actually centers vertically
tf.margin_left = tf.margin_right = 0
```

If you're carrying workarounds around code that worked around the silent-drop bug, you can remove them.

## Borderless shapes

For autoshapes you want without a visible outline:

```python
shape.fill.solid()
shape.fill.fore_color.rgb = MY_FILL
shape.line.fill.background()    # OR: shape.line.width = Pt(0)
```

Either path now produces `<a:ln w="0"><a:noFill/></a:ln>` in the exported XML, overriding the theme's `accent1` default that used to leak through as a blue outline. Same fix PR (#19108). The old workaround of `line.color = fill_color; line.width = Pt(0)` still works but is no longer required.

## Batching

Wrap multi-op edits in `with prs.batch():` so they flush in one round-trip:

```python
with prs.batch():
    slide = prs.slides.add_slide(layout["Two Content"])
    # ... but reads of the new slide's placeholders won't return them yet.

prs.refresh()                # pull the layout-inherited placeholders into the proxy
title = ph_by_type(slide, 1) # PH_TITLE = 1

with prs.batch():
    title.text_frame.text = "..."
```

Reads outside `batch()` always return the latest server state. Inside `batch()`, your view is local-optimistic; **don't read placeholders that the server hasn't echoed back yet** — refresh first.

## Charts — what works today

Charts are now end-to-end through the SDK. Both editing existing charts **and authoring new charts from scratch** are supported on column / bar / line / area / pie / doughnut.

**Authoring a fresh chart:**

```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches

cd = CategoryChartData()
cd.categories = ["Q1", "Q2", "Q3", "Q4"]
cd.add_series("Revenue", [120, 150, 180, 210])
cd.add_series("Cost",    [ 80,  90, 100, 110])

gf = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    Inches(1), Inches(1), Inches(8), Inches(5),
    cd,
)
gf.chart.chart_title = "FY26 Revenue vs Cost"
gf.chart.has_legend = True
```

Under the hood, `add_chart()` emits an `AddChart` server command that creates a chart element with `provenance: 'sdk'` in Yjs. On the next export, `chart-ooxml/export/author.ts` materializes the chart-part XML, an embedded `.xlsx` workbook (so PowerPoint's "Edit Data" works), the chart `.rels`, the slide-level chart relationship, the `<p:graphicFrame>` on the slide, and the `[Content_Types].xml` overrides.

**Editing an existing (or just-authored) chart:**

```python
existing_chart = next(s for s in slide.shapes if s.has_chart)
existing_chart.chart.replace_data(cd)        # rewrites series values + names + categories
existing_chart.chart.chart_title = "Updated"  # SetChartTitle patch
existing_chart.chart.has_legend = False       # SetLegendVisible patch
```

`replace_data()` and the title/legend setters emit `UpdateChartData` commands that append `ChartPatch` intents to the chart element's `chartPatches` queue. The export-worker drains the queue via `chart-ooxml/export/patcher.ts` and embedded `.xlsx` cells stay in sync via `chart-ooxml/workbook/embed.ts`.

**Supported chart types for `add_chart()`:** `XL_CHART_TYPE.COLUMN_CLUSTERED`, `COLUMN_STACKED`, `COLUMN_STACKED_100`, `BAR_CLUSTERED`, `BAR_STACKED`, `BAR_STACKED_100`, `LINE`, `LINE_MARKERS`, `LINE_STACKED`, `LINE_STACKED_100`, `AREA`, `AREA_STACKED`, `AREA_STACKED_100`, `PIE`, `DOUGHNUT`. Other types (3-D variants, scatter, bubble, radar, stock, surface, combo) raise `UnsupportedFeatureError` because the authoring path doesn't emit those plot elements yet — extend `chart-ooxml/export/author.ts` to add them.

**Ingested-chart rendering** is fully covered through Phase 4: column/bar/line/area/pie/doughnut/scatter/bubble/radar/stock, combo charts with secondary axes, trendlines, error bars, data labels, advanced axis options. Read-only on the SDK side for the types the authoring path doesn't cover yet — but `replace_data()` on those works as long as the chart was originally ingested (the patcher operates on the existing OOXML).

**Caveats / known gaps**:

- Phase 5 ships without the Open XML SDK Validator gate from the refactor plan — authored chart packages have not been validated in CI yet. If PowerPoint shows a "repair" dialog on an exported deck, file a bug with the deck. The shape matches what PowerPoint emits for a fresh chart, but any deviation that triggers strict validation will surface here.
- Number-format strings on series (`number_format` arg to `CategoryChartData.add_series`) are accepted for python-pptx parity but currently dropped — the embedded workbook's general format applies.
- Per-point colors and series colors in `SeriesSpec` flow through to `<c:spPr>` but the Python-side API for setting them on `add_chart()` is not yet wired (use `SetSeriesColor` patches via `replace_data` follow-up if needed).

## Athena-only extensions to remember

```python
slide.render(format="png", scale=2, as_pil=False)  # server-side PNG (or PIL if Pillow installed)
slide.clone(target_index=None)                     # deep-copy slide
prs.slides.delete_slides([0, 2, 5])
prs.slides.keep_only([0, 4])                       # delete everything else
```

`pptx.generate_docs()` prints these with full signatures at runtime if you forget.

## Errors

Catch `pptx.PptxSdkError` for everything from this SDK. Common subclasses: `RemoteError, ValidationError, ConflictError, AuthenticationError, RenderError, ExportError, UploadError, ConnectionError, UnsupportedFeatureError`.

## Reference files

- `references/api-reference.md` — full API surface (entry points, slides, shapes, text, fill/line, units, color, MSO_SHAPE highlights)
- `references/template-workflow.md` — the template-as-form pattern; how to inspect, populate, and let the theme handle styling
- `references/troubleshooting.md` — known gotchas: workspaceId, name=None on new placeholders, Gap-3 text patterns, server renderer sizing, batch ordering, scale interpretation, staging vs prod URLs

## Helper scripts

- `scripts/inspect_deck.py <deck_id>` — dump layouts, slides, shapes, placeholders for an Athena deck
- `scripts/smoke_test.py <deck_id>` — verify env wiring + read/render/save round-trip
- `scripts/demo_deck.py <deck_id>` — five-slide reference example covering every common pattern

All three read `ATHENA_PPTX_BASE_URL` and `ATHENA_PPTX_API_KEY` from the environment.

## Baseline parity (regression suite)

`pptx-studio/tests/baseline-parity/` is a structural-diff harness that runs the same fixtures (textbox / shapes / mixed) through stock python-pptx and athena-python-pptx, then compares the OOXML structurally. Goldens are committed; the athena run hits a real staging asset.

```bash
# Regenerate goldens from python-pptx (stock):
/tmp/baseline-parity-venv/ppx/bin/python pptx-studio/tests/baseline-parity/run_python_pptx.py

# Run athena-python-pptx against staging:
ATHENA_PARITY_ASSET_ID=asset_... /tmp/parity-athena-venv/bin/python pptx-studio/tests/baseline-parity/run_athena_python_pptx.py

# Diff:
/tmp/baseline-parity-venv/ppx/bin/python pptx-studio/tests/baseline-parity/compare.py goldens/textbox.pptx athena-out/textbox.pptx
```

Use this when you change the exporter or SDK primitives and want a quick sanity check that the output shape (transform, fill, line, prst, text) didn't drift from python-pptx's reference.
