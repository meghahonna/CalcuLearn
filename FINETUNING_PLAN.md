# CalcuLearn: Specialized Calculus SLM — Finetuning & Edge Deployment Plan

Goal: an open-source, calculus-expert small model that runs on low-compute edge devices (Raspberry Pi 5, old laptops, phones) and drops into CalcuLearn's existing local-inference pipeline.

## Why this codebase is unusually ready

CalcuLearn already runs a local GGUF model (`models/gemma4-e4b-Q8.gguf`) via `node-llama-cpp`, wired through the `DialogueModelBackend` interface in `src/components/dialogueGenerator.ts`. A finetuned model is a **drop-in swap**: place the GGUF in `models/`, register its SHA-256, done. No architecture changes.

It also contains high-quality seed training data:

| Source | Location | Yields |
|---|---|---|
| 20 concept files (tiered explanations, worked examples with why-steps) | `content/concepts/*.json` | explanation + worked-example pairs |
| Misconception → Socratic-response pairs | same files, `misconceptions[]` | ideal tutor-turn training pairs |
| 99 problems × 4 tiers with step solutions + hints | `src/data/problems.ts`, `scripts/seed_problems.sql` | problem/solution/hint chains |
| Authoring + critique pipeline (Claude Opus) | `scripts/authoring/` | synthetic data generator, already built |
| AP study guides / CED | `resources/*.pdf` | grounding for coverage + eval design |

## Base model evaluation

### SmolLM2-1.7B (your candidate)

**Pros:** Apache 2.0; one of the very few *fully* open models — training data (11T tokens), recipe, and code all released, which matches the equity/open-source mission; small (~1GB at Q4); well supported in llama.cpp and MLX.

**Cons — the important part:** math is its weak spot. Base GSM8K (5-shot) is **31.0** vs Qwen2.5-1.5B's **61.3**; instruct version 48.2 vs 63.3 for Qwen2.5-1.5B-Instruct. Finetuning improves task behavior far more than it adds missing math reasoning — you want the strongest math prior you can get at the size. It's also English-only (fine here, since translation is a separate NLLB layer). Independent finetuning benchmarks (distil labs, 12-model comparison) also rank SmolLM2 behind Qwen3 and Llama 3.2 families for tunability.

**Verdict:** viable, but not the best base. Choose it only if full training-data transparency is a hard requirement for the open-source story.

### Recommended candidates to benchmark (all Apache 2.0, all fit edge)

1. **Qwen3-1.7B-Base** — primary recommendation. STEM/math performance comparable to Qwen2.5-3B; distilled reasoning; Qwen3 family tops small-model finetuning benchmarks.
2. **Qwen2.5-Math-1.5B** — math-specialized pretrain; strongest calculus prior per parameter; narrower general/dialogue ability (matters for Socratic tone).
3. **SmolLM2-1.7B** — fallback for maximal openness.
4. **Gemma 3 1B** — smallest footprint; continuity with current Gemma prompts; Gemma license (not Apache) is slightly more restrictive for redistribution.

Decision method: before any training, run all four on a ~200-item calculus eval built from held-out `problems.ts` items + concept `checks` (see Phase 3). Pick the winner on accuracy + JSON-format compliance + tokens/sec at Q4 on a Pi 5.

## Your Mac (Apple M5, 32GB unified memory)

More than enough. LoRA on a 1.7B model needs roughly 8–12GB; even **full-parameter** finetuning of 1.7B (~3.4GB weights + ~14GB AdamW states + activations) fits in 32GB with gradient checkpointing. Use **MLX (`mlx-lm`)** — native Apple Silicon, unified memory, and the M5's improved GPU/neural accelerators make training runs on a 30–50k-example dataset a matter of hours. Escape hatches if memory-tight: quantized base (QLoRA), smaller batch, `--grad-checkpoint`, fewer tuned layers.

## Plan

### Phase 1 — Dataset construction (~1 week)
- Export existing content into instruction/response pairs formatted **exactly** like the runtime prompts in `dialogueGenerator.ts` (`generateHint`, `generateFeedback`, `evaluateSemanticAnswer` JSON, `generateProblemVariant` JSON, Socratic intro) and the classifier LLM tier in `responseClassifier.ts`. Format fidelity is what makes the finetune drop-in.
- Estimated native yield: ~3–5k high-quality pairs.
- Augment to 30–50k: filter public math sets to calculus (OpenMathInstruct-2, MetaMathQA, MathInstruct — check per-set licenses before redistribution) + synthesize AP-style Socratic dialogues using the existing `scripts/authoring/` Claude pipeline. Note: check Anthropic/other provider terms for using outputs to train a released model; generate misconception-driven wrong-answer → correction pairs (the app's core interaction).
- Hold out ~10% + 20 full problems as the eval set. Dataset itself becomes part of the open-source release.

### Phase 2 — Base model selection ✅ DECIDED (2026-07-07): **Qwen3-1.7B**
Bake-off run via `scripts/finetune/evalBaseModels.py` (results in `data/finetune/eval_report.md`):

| Model | Solver (63 problems) | Sem-eval agree | Notes |
|---|---|---|---|
| **Qwen3-1.7B** | **52%** | 95% | Winner. Apache 2.0. Consistent across all 20 concepts. |
| Gemma 3 1B | 33% | 100% | Fastest (99 tok/s) but collapses on implicit diff, related rates, ODEs, Riemann. Non-Apache license. |
| Qwen2.5-Math-1.5B | 57% (7-problem subset) | 0% JSON | Best math prior but ignores instructions entirely (0% classifier, 0% JSON). |
| SmolLM2-1.7B | 29% (7-problem subset) | 69% | Weakest math, slowest. Eliminated. |

Augmentation targeting (from failure analysis): overweight **proof-sketch problems and ODE first-order-linear** — Qwen3's weakest areas.

### Phase 3 — Training ✅ v1 TRAINED (2026-07-08)

v1 = Qwen3-1.7B + LoRA, 1 epoch over 27.8k mixed records (native ×2 + 616 synthetic
+ 20k OpenMathInstruct-2 calculus + 15% smoltalk). Val loss 0.399, no overfit.

Held-out results (7 auto-scorable problems, **symbolic-equivalence scoring** via
`rescoreSolver.py` — string matching under-counted equivalent forms):

| Metric | Zero-shot | v0 (native only) | v1 (full mix) |
|---|---|---|---|
| Solver (held-out, symbolic) | 4/7 | 4/7 | **5/7** (5/5 on computational; 2 fails are prose proof-sketches, manual review) |
| Semantic-eval JSON / agree | 95% / 95% | 100% / 100% | 100% / 100% |
| Classifier (hard shuffled set) | — | — | 52% — remaining weakness |
| ≤150 words | 98% | 100% | 98% |

**v1.1 priorities:**
1. Classifier misconception-index matching (all 45 misses are wrong-index; model
   defaults to :1/:3). Needs dedicated synthetic classifier data with varied
   student answers + shuffled lists (add classifier task to augment.ts), and
   finish the interrupted synthetic run (12 concepts remaining, incl. overweighted ODEs).
   Mitigating factor: runtime tier-6 classifier only fires on ambiguous cases and
   falls back to partial_correct, so 52% is degraded-graceful, not broken.
2. Pre-split/drop >2048-token records in mixDataset.py (truncation warning).
3. Variant JSON at 50% on n=4 — too small to read; expand variant eval set.

### Phase 3 (original notes) — Training on the M5 (1–2 weeks of iterations)
- `mlx_lm.lora`: LoRA r=16–32 on all linear layers, 2–3 epochs, lr ~1e-5–5e-5, sequence length 2048.
- Two-stage: (1) SFT on the full mix; (2) optional DPO using preference pairs mined from `content/critiques/` (critiqued-bad vs approved-good responses).
- Guard against catastrophic forgetting of instruction-following: keep ~15% general instruction data (e.g., smoltalk subset) in the mix.

### Phase 4 — Evaluation
- Held-out calculus set (primary), GSM8K subset (sanity), JSON-format compliance rate (must be ~100% — `answerEvaluator.ts` and variant generation depend on it), refusal/safety spot checks, regression vs the current Gemma model on real session transcripts.

### Phase 5 — Quantize & deploy
- `mlx_lm.fuse` → HF safetensors → `llama.cpp convert_hf_to_gguf.py` → quantize **Q4_K_M** (~1.1GB, Pi 5 target) and **Q8_0** (~1.9GB).
- Drop into `models/`, run `npm run hash > .env` (tamper-check in `src/bootstrap.ts` — its RAM-based Q4/Q8 selection already handles both).
- Measure tokens/sec on Pi 5; tune `DEFAULT_TIMEOUT_MS` in `dialogueGenerator.ts` (currently 120s, docs say 10–30s).
- Win vs today: a 1.7B Q4 model is ~5× smaller than the current Gemma Q8, directly lowering the hardware floor — the equity goal.

### Phase 6 — Open-source release
- HF repo: model card (base, data sources, eval table, limitations), Apache 2.0, GGUF + MLX + safetensors artifacts, the dataset, and the eval harness.
- CalcuLearn app already bundles for offline edge use (`scripts/bundle.ts`); ship a release with the new default model. Optional later: iOS/Android via llama.cpp or MLX Swift.

## Risks
- **1.7B ceiling:** even finetuned, it will make algebra slips. Mitigation: the app's symbolic-first `answerEvaluator.ts` cascade already catches this — keep LLM as tutor-voice, not source of truth; constrain generation with the existing prompt templates.
- **Data licensing:** verify each public dataset's license permits redistribution in an Apache 2.0 release.
- **Format drift:** finetune must preserve JSON output modes; include JSON tasks in every training mix and eval gate on compliance.
