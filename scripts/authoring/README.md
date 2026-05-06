# Phase A — Concept Content Authoring

This directory contains the **authoring pipeline** that turns a hand-curated concept spec into rich, multi-tier learning content using Claude Opus, then loads that content into the on-device SQLite database for the SLM to retrieve at runtime.

## Architecture

```
scripts/authoring/conceptSpecs.ts         <- you curate this
       |
       v
scripts/authoring/authorConcept.ts        <- calls Opus N times
       |
       v
content/concepts/<concept_id>.json        <- versioned, diff-able
       |
       v
scripts/authoring/seedContent.ts          <- writes to SQLite
       |
       v
data/calculearn.sqlite                    <- runtime DB
```

The on-device SLM never invents math. It only paraphrases, probes, and transitions between content blocks pulled from these tables.

## Prerequisites

- `ANTHROPIC_API_KEY` set in env (Athena gateway key is auto-provided in the sandbox)
- `ANTHROPIC_BASE_URL` set if using a gateway
- `ANTHROPIC_MODEL` optional override (defaults to `claude-opus-4-6`)
- `npm install` already run

## Commands

```bash
# 1. Run the migration (idempotent; safe to re-run)
npm run migrate:phase-a

# 2. Author one concept
npm run author -- limits.definition

# Author with critique pass
RUN_CRITIQUE=1 npm run author -- deriv.chain-rule

# 3. Author all 5 starter concepts
npm run author:all-starter

# 4. Seed the authored JSON into SQLite
npm run seed:content
```

## Inspecting the result

```bash
# Count rows per content type
sqlite3 data/calculearn.sqlite "
  SELECT
    (SELECT COUNT(*) FROM concept_explanations) AS explanations,
    (SELECT COUNT(*) FROM concept_examples)     AS examples,
    (SELECT COUNT(*) FROM concept_misconceptions) AS misconceptions,
    (SELECT COUNT(*) FROM concept_checks)       AS checks,
    (SELECT COUNT(*) FROM concept_deep_dives)   AS deep_dives,
    (SELECT COUNT(*) FROM concept_applications) AS applications
"

# Show one concept's novice explanation
sqlite3 data/calculearn.sqlite "
  SELECT body_md FROM concept_explanations
  WHERE concept_id = 'deriv.chain-rule' AND tier = 'novice' AND framing_index = 0
"
```

## Files

| File | Purpose |
|---|---|
| `runMigration.ts` | Idempotent SQL migration runner for `migrations/002_concept_content.sql`. |
| `authoringPrompts.ts` | Six Opus prompts (one per content type) + per-tier guidance. |
| `conceptSpecs.ts` | Hand-curated spec for each starter concept. |
| `authorConcept.ts` | Pipeline that calls Opus, validates, writes JSON. |
| `seedContent.ts` | Loads JSON files into SQLite (idempotent). |
| `README.md` | This file. |

## Cost note

Authoring one concept makes ~13 Opus calls (4 explanations, 3 examples, 1 misconceptions batch, 3 check batches, 2 deep-dives, 2 applications). Five starter concepts ≈ 65 calls. Budget accordingly.
