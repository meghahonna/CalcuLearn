# Tutorial plan: "Finetuning Small Language Models — A Complete Worked Example"

A technical tutorial built on the CalcuLearn exercise. Every concept is taught
through the real artifact that used it — actual numbers, actual failures, actual
fixes. Reader profile: engineer comfortable with Python/calculus-level math, new
to LLM training internals. Everything reproducible on one Apple Silicon Mac.

## Part 0 — What finetuning actually is
- A language model is a next-token distribution p(token | context) learned by
  gradient descent on cross-entropy. Finetuning is the SAME objective, same
  algorithm, continued on a narrow distribution — nothing mystical changes.
- The training landscape: pretraining (capability) → instruction tuning
  (behavior) → preference tuning (taste). Where SFT/LoRA sits and what each
  stage can and cannot add.
- **Behavior vs knowledge, mechanically:** why a few thousand gradient steps
  reliably reshape output format, tone, and task framing (high-probability-mass
  redistribution) but are a terrible way to add facts (sparse memorization,
  easily forgotten, hallucination-prone). This single idea explains most of the
  decisions in Parts 2–3.
- **The decision tree — when NOT to finetune:** prompting → few-shot examples
  → RAG → finetuning → pretraining, ordered by cost. Finetuning earns its place
  only when: the format/behavior must be baked in (no token budget for
  few-shot), latency/size constraints exclude bigger models, or the task
  distribution is stable and narrow. CalcuLearn hits all three — show why.
- **Hands-on in the first hour:** train a 135M model (SmolLM2-135M) on 50
  hand-written pairs in ~5 minutes on any laptop; watch it adopt the format and
  fail at the knowledge. The rest of the tutorial explains what you just saw.

## Part 1 — Why small models, and when specialization wins
- The economics: parameter count vs memory bandwidth vs latency; why a 1.7B
  model at Q4 (~1GB) runs on a Raspberry Pi and a 70B doesn't.
- Specialization hypothesis: a small model can match frontier behavior on ONE
  narrow task distribution. What "narrow" means formally (the runtime prompt
  formats ARE the distribution).
- Case study setup: CalcuLearn's 7 runtime tasks (hint, feedback, intro,
  worked-example, semantic-eval JSON, variant JSON, classifier label).

## Part 2 — Choosing a base model: evals over vibes
- Why public benchmarks (GSM8K, MMLU) don't answer "is this good at MY task."
- Building a domain eval from ground truth: auto-scorable vs manual-review
  items; answer-type taxonomy (numeric / symbolic / text).
- **The sample-size lesson (real data):** Gemma 3 1B looked tied with Qwen3 at
  4/7 vs 3/7, then collapsed 33% vs 52% on 63 problems. Binomial confidence
  intervals on small evals; why 7 problems can't separate models.
- Instruction-following vs raw capability: Qwen2.5-Math scored best on math and
  0% on format compliance — why "finetuning fixes format, not capability" drives
  the selection rule.
- Licensing as an engineering constraint (Apache 2.0 vs Gemma Terms; why
  SmolLM2's fully-open training data matters to some releases).

## Part 3 — The dataset: format fidelity and the data mix
- **Core principle: train on the exact distribution you serve.** Byte-matching
  runtime prompts (`buildPrompt` reproduction) so the model drops in with zero
  application changes.
- Converting structured domain content to instruction pairs: worked mappings
  from concept JSON → 7 task types (~1.8k pairs from existing content, zero new
  authoring).
- Synthetic augmentation: seeding a frontier model with gold anchors;
  quality gates (answer-leak detection, length caps, JSON validation); the
  intro-task leak we caught in review and the one-line prompt fix.
- Public data: filtering at scale (regex over 14M rows), the bare-`dx` false-
  positive bug (40% contamination caught by spot-checking), license vetting
  (why MetaMathQA was excluded).
- Mix design math: upweighting (native ×2), forgetting guard (~15% general
  data — brief note on catastrophic forgetting), dedup by content hash,
  held-out concept design for honest generalization measurement, and
  train-set contamination (why the 99-problem eval died after v1).

## Part 4 — LoRA: the math
- Tokenization & chat templates first (the practical stumbling block): what
  `apply_chat_template` actually emits, special tokens, why the template at
  training time must match inference time (our `enable_thinking=False` handling
  for Qwen3 as the example), and completion-only loss masking.
- Full finetuning memory arithmetic: bf16 weights (2 bytes/param) + Adam
  moments (8 bytes/param) + gradients + activations → why 1.7B full-FT is
  ~17GB+ and 7B doesn't fit a laptop.
- **Low-rank adaptation:** W′ = W + (α/r)·BA with B ∈ ℝ^{d×r}, A ∈ ℝ^{r×k}.
  The low intrinsic dimension hypothesis. Parameter count: our run trained
  **0.289% of weights (4.98M of 1.72B)** — derive that number from r, target
  layers, and layer count (16 of 28).
- Why B initialized to zero (identity start), α/r scaling, rank selection
  intuition (r=8–32 for behavior; higher for knowledge).
- The training objective: causal LM cross-entropy; completion-only masking
  (loss on assistant tokens, not the prompt); what "Train loss 0.313" is
  actually measuring.
- Gradient checkpointing: trade compute for memory (recompute activations in
  backward pass) — why our peak stayed at 15.9GB on batch 4 × 2048 tokens.
- QLoRA sketch: NF4 quantized frozen weights + bf16 adapters; when needed.
- Brief pointers: DoRA, full-FT-then-distill, DPO/preference math (Bradley-
  Terry loss) as the natural next step for tutor-tone preferences.

## Part 5 — Reading a training run (annotated real logs)
- Annotate the actual v0 and v1 logs: val 2.92 → 0.21 (v0, narrow data) vs
  0.399 (v1, diverse mix) — why the "worse" val loss is the healthier model;
  loss is only comparable on the same data distribution.
- Epochs vs iters vs batch arithmetic (the 3,000-iter = 0.2-epoch mistake we
  caught); lr choice (2e-5 small set → 1e-5 large mix); truncation warnings
  and why losing a solution's tail matters (the "Final answer" line).
- Checkpointing strategy and the adapter-overwrite incident (rescuing v1 from
  the 7000-iter checkpoint) — operational hygiene.

## Part 6 — Evaluation: where most tutorials lie to you
- **The scorer-bug case study (the tutorial's centerpiece):** v1 looked flat
  at 3/7 until symbolic-equivalence rescoring (sympy `simplify(a−b)=0`) showed
  5/7 — the model produced (x²/2)ln x, the scorer expected x²ln(x)/2.
  Lesson: your eval is code; it has bugs; grade the grader.
- Failure-mode analysis as data design: the classifier collapsing to
  "misconception:1" (position bias) → shuffled-list training data as the fix.
  Connects eval → data → retrain loop.
- Metrics per task type: exact-label accuracy, JSON parse + semantic agreement,
  constraint compliance, and what NOT to auto-score (prose proofs).
- Baselines and deltas: always eval zero-shot first; report before/after on the
  identical yardstick.

## Part 7 — Quantization and edge deployment
- Quantization math: blockwise k-quant schemes (Q4_K_M ≈ 4.5 bits/weight),
  size table for 1.7B (bf16 3.4GB → Q8 1.9GB → Q4_K_M ~1.1GB), quality-loss
  intuition and when to re-eval post-quantization.
- Latency model: tokens/sec ≈ memory bandwidth / bytes-per-token — why
  quantization speeds up inference on bandwidth-bound devices.
- The pipeline: mlx fuse → HF safetensors → GGUF convert → quantize → SHA-256
  integrity check → drop-in swap behind the app's backend interface.

## Part 8 — Wrap-up: the loop, the costs, the checklist
- The full loop diagram: eval → data → train → eval → deploy → monitor.
- Real cost accounting: one M5 laptop, hours per run, API cost of synthetic
  data; what changes at production scale.
- Reproduce-it-yourself checklist mapped to the repo's scripts.
- Open problems: the 1.7B capability ceiling, symbolic guards around the model,
  preference tuning, multilingual.

## Format & assets
- 9 parts (0–8), each standalone (~2,000–3,000 words + code + one exercise).
- Part 0's 5-minute hands-on finetune is the hook; every later part refers back
  to what the reader observed in it.
- All numbers/tables pulled from `data/finetune/eval_report.md`, training logs,
  and `FINETUNING_PLAN.md` — nothing invented.
- Assets to prepare: annotated log excerpts, the bake-off table, LoRA memory
  arithmetic diagram, quantization size/speed table, the scorer-bug
  before/after diff.
- Candidate venues: blog series, GitHub repo companion (this repo, cleaned), or
  a single long-form piece; decide after Part 1 draft.
