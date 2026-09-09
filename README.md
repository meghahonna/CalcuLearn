# CalcuLearn

Offline-first adaptive calculus tutor for K-12 students. Runs entirely on-device
using Gemma 4 for Socratic dialogue and NLLB-200 for 200-language translation.
Student data, problem bank, and session history stay in local SQLite. Cloud
sync is strictly opt-in and anonymised.

## Requirements

- **Node.js ≥ 20** (uses `crypto.randomUUID`, `fs.cpSync`, ESM `NodeNext`)
- **~6 GB free disk** for the bundled GGUF model files
- **≥ 4 GB RAM** for the `Q4_K_M` Gemma quantisation; `Q8` needs ≥ 8 GB
- A modern browser (for the UI shell)

Reference hardware is a Raspberry Pi 5, 4 GB.

## Quick reference

| Command | What it does |
|---|---|
| `npm install` | Install runtime + dev dependencies |
| `npm test` | Run the full test suite (205 tests, ~1s) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | Run `tsc --noEmit` (no test runner) |
| `npm run seed` | Populate `./data/calculearn.sqlite` with 99 curated problems |
| `npm run install-model` | Interactive: pick + download a GGUF chat model from Hugging Face |
| `npm run hash` | Print SHA-256 hashes for every GGUF file in `./models/` (manual path) |
| `npm start` | Run the backend + static UI server on `http://localhost:3000` |
| `npm run smoke` | Launch the production wiring smoke test |
| `npm run build` | Compile TypeScript → `./dist/` |
| `npm run bundle` | Produce a self-contained `./dist/` (models, data, UI, KaTeX) |
| `npm run serve:ui` | Serve `dist/ui/` over HTTP for manual testing |

## First-time setup

### Easy path (downloads a model from Hugging Face)

```bash
npm install
npm run install-model     # interactive: pick from Gemma 2, Phi-3, Llama 3.1, Qwen 2.5
npm run seed              # populate ./data/calculearn.sqlite
npm run build
source .env && npm start  # run the backend + static UI server on localhost
```

If your machine is slow with `Q8`, force the smaller quantisation:

```bash
export GEMMA_QUANTISATION=Q4_K_M
export DIALOGUE_TIMEOUT_MS=20000
source .env && npm start
```

`install-model` shows a menu of curated GGUF chat models (sizes from 1.6 to
9.2 GB), downloads the one you pick into `./models/` under the canonical
filename, computes SHA-256 while streaming, and writes the right env var
into `./.env`. All URLs are public, non-gated, and verified live.

```bash
npm run install-model -- --list        # print options without downloading
npm run install-model -- --id gemma2-9b-q4   # non-interactive
```

### Manual path (you already have GGUF files)

```bash
npm install

# Place files at the canonical paths the bootstrap looks for.
mkdir -p models
cp /path/to/your-q4-model.gguf models/gemma4-e4b-Q4_K_M.gguf  # for <8 GB RAM
cp /path/to/your-q8-model.gguf models/gemma4-e4b-Q8.gguf      # for ≥8 GB RAM
cp /path/to/nllb-200.gguf       models/                       # optional translation

# Compute SHA-256 hashes (needed for tamper detection on every load).
npm run hash > .env
# Edit .env if any line starts with "#" — that means a filename didn't match
# the expected pattern.

npm run seed
source .env && npm start
```

A successful `npm start` prints something like:

```
[bootstrap] model=./models/gemma4-e4b-Q4_K_M.gguf quantisation=Q4_K_M ramGb=8.0 nllb=./models/nllb-200.gguf
[server] CalcuLearn backend running at http://localhost:3000
```

If hash verification fails, startup aborts with a `ModelTamperingError`.

## Running the test suite

The whole codebase is exercised by **205 tests** including all 7 design
properties. No real GGUF model file is needed — the test suite uses temp
fixtures and verified mock backends.

```bash
npm test                              # full suite
npm test -- tests/answerEvaluator.test.ts   # single file
npm test -- -t "Property 4"           # only Property 4 tests
```

Property tests live alongside the components they validate:

| Property | Where | Validates |
|---|---|---|
| 1: Mastery monotonicity on correct streaks | `knowledgeStateManager.test.ts` | Req 2.4 |
| 2: Prerequisite gate | `problemEngine.test.ts` | Req 3.4 |
| 3: BKT bounds | `knowledgeStateManager.test.ts` | Req 2.3 |
| 4: Evaluation consistency | `answerEvaluator.test.ts` | Req 5.5 |
| 5: Hint penalty | `knowledgeStateManager.test.ts` | Reqs 2.5, 1.3 |
| 6: Session persistence round-trip | `sessionEngine.test.ts` | Reqs 1.4, 2.1 |
| 7: LaTeX passthrough in translation | `translationLayer.test.ts` | Req 6.2 |

## Building the offline bundle

```bash
npm run build    # tsc → dist/
npm run bundle   # copies models/, data/, src/ui/, KaTeX → dist/
```

The bundle is self-contained — copy `dist/` to a Pi or air-gapped machine and
it runs without internet.

```
dist/
├── data/                     # seeded SQLite + concept/problem JSON
├── models/                   # Gemma + NLLB GGUF files
├── ui/
│   ├── index.html            # entry point
│   ├── app.js                # compiled controller + DOM bindings
│   └── katex/                # bundled KaTeX assets
└── components/, db/, …       # compiled .js for `node dist/main.js`
```

To try the UI locally:

```bash
npm run serve:ui
# open http://localhost:3000
```

## Configuration

`src/main.ts` reads these environment variables. All defaults are file-system
local — nothing escapes the device.

| Env var | Default | Purpose |
|---|---|---|
| `DB_PATH` | `./data/calculearn.sqlite` | SQLite file path |
| `MODEL_DIR` | `./models` | Directory containing GGUF files |
| `GEMMA_Q4_SHA256` | _(required)_ | SHA-256 of `gemma4-e4b-Q4_K_M.gguf` |
| `GEMMA_Q8_SHA256` | _(required)_ | SHA-256 of `gemma4-e4b-Q8.gguf` |
| `GEMMA_QUANTISATION` | _(auto)_ | `Q4_K_M` or `Q8` override for model selection |
| `DIALOGUE_TIMEOUT_MS` | `10000` | Gemma inference timeout in milliseconds |
| `NLLB_SHA256` | _(optional)_ | If set, bootstrap also verifies NLLB |
| `NLLB_FILE` | `nllb-200.gguf` | NLLB filename inside `MODEL_DIR` |
| `TARGET_LANGUAGE` | `en` | UI language code (NLLB-200 supports 200+) |

Generate a `.env` with `npm run hash > .env`.

## Project layout

```
src/
├── bootstrap.ts              # RAM-aware quantisation pick + hash verification
├── main.ts                   # production component wiring (createApp)
├── components/
│   ├── answerEvaluator.ts    # symbolic → numeric → LLM cascade
│   ├── dialogueGenerator.ts  # Gemma 4 wrapper, Socratic prompts, semantic eval
│   ├── knowledgeStateManager.ts  # BKT + frontier-concept selection
│   ├── problemEngine.ts      # FTS5-backed selection, variant generation
│   ├── sessionEngine.ts      # orchestrator
│   ├── syncService.ts        # opt-in anonymised cloud sync
│   └── translationLayer.ts   # NLLB-200 with LRU + LaTeX passthrough
├── data/
│   ├── concepts.ts           # 20 ConceptNode entries (DAG)
│   └── problems.ts           # 99 curated problems × 4 difficulty tiers
├── db/
│   ├── database.ts           # better-sqlite3 wrapper + recoverOrCreate
│   ├── schema.ts             # tables + FTS5 triggers
│   └── seedDatabase.ts       # idempotent seed script
├── models/
│   ├── constants.ts          # cross-component thresholds
│   ├── types.ts              # all shared interfaces
│   └── validation.ts         # DAG / mastery / problem invariants
├── security/
│   ├── modelVerifier.ts      # streaming SHA-256
│   └── studentIdentity.ts    # UUID-only profile creation
└── ui/
    ├── app.ts                # controller + DOM bindings + KaTeX render
    └── index.html            # static shell
scripts/
├── bundle.ts                 # offline bundle producer
└── computeModelHashes.ts     # hash printer for first-time setup
tests/                        # 12 files, 205 tests, all 7 properties covered
```

## Privacy and security

- **Local-only by default.** Nothing leaves the device unless `SyncService` is
  explicitly opted into. The integration test `runs a 5-turn offline session
  without fetch/network calls` overrides `globalThis.fetch` and asserts zero
  outbound calls.
- **Tamper-detection.** Every GGUF model file is SHA-256-verified before first
  load (`bootstrap.ts`). A mismatch throws `ModelTamperingError` and aborts.
- **UUID-only identity.** Students are identified by a locally-generated UUID
  (`security/studentIdentity.ts`). No PII is collected, stored, or transmitted.
  When opt-in sync is enabled, `anonymisePayload` whitelists fields to ensure
  email/name/dateOfBirth never leak.
- **Sanitised input.** `AnswerEvaluator.sanitiseInput` strips `__import__`,
  `eval`, `exec`, `;|&\``, and `$()` before passing to mathjs. The symbol set
  is restricted to known-safe variables and constants.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ModelTamperingError` on `npm start` | `.env` hashes don't match the GGUF files | `npm run hash > .env` and retry |
| `SQLITE_CANTOPEN` | `./data/` doesn't exist | `mkdir -p data` then `npm run seed` |
| `corrupt database detected` log line on first run | A prior run left a partial SQLite file | The runtime auto-recovers (deletes + recreates schema). The student profile resets to defaults. |
| `Inference timeout` on Pi 5 | Context window too large | Wait — `DialogueGenerator` halves the context and reloads on the next call (Req 11.2). Check logs. |
| UI shows raw `$x^2$` instead of rendered math | KaTeX not bundled | `npm run bundle` and reload `dist/ui/index.html` |

## Requirements traceability

`.kiro/specs/adaptive-calculus-tutor/requirements.md` defines 11 numbered
requirement groups (BKT, problem selection, dialogue, evaluation, translation,
offline, curriculum, performance, security, error handling). Each component
file lists the requirements it satisfies in its module-level JSDoc.
`tasks.md` tracks implementation through 31 tasks across two phases (build
+ post-review remediation), all marked complete.

## License

TBD — internal project.

pip install mlx-lm
python scripts/finetune/evalBaseModels.py            # full run (~128 records + 10 problems × 4 models)
python scripts/finetune/evalBaseModels.py --limit 10 # quick pass first

pip install "transformers>=5.7,<5.13"
python scripts/finetune/evalBaseModels.py --limit 10

npx tsx scripts/finetune/augment.ts        # generates classifier task + 12 remaining concepts
python scripts/finetune/mixDataset.py      # rebuild: new synthetic in, 83 over-length out
# train with the iters count the mixer prints, and:
#   --adapter-path adapters/calculearn-v1.1