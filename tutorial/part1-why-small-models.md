# Part 1 — Why small models, and when specialization wins

*You finetuned a 135M model in Part 0 and watched behavior transfer while knowledge stayed put. This part explains why anyone would bet a product on a small model — and the physics that decides which devices can run what.*

## The number that rules everything: bytes per token

Here is the most useful mental model in on-device inference. To generate one token, the model must read **every parameter once** (each weight participates in one multiply). So, to a first approximation:

$$\text{tokens/sec} \approx \frac{\text{memory bandwidth (bytes/sec)}}{\text{bytes per parameter} \times \text{parameter count}}$$

Inference on consumer hardware is **memory-bandwidth-bound**, not compute-bound. The GPU cores mostly wait for weights to arrive from RAM.

Work through the case study's target device, a Raspberry Pi 5 (~17 GB/s memory bandwidth):

| Model | Bytes/param | Weights size | Theoretical ceiling on Pi 5 |
|---|---|---|---|
| 70B @ 4-bit | ~0.56 | ~39 GB | doesn't fit in 8GB RAM — moot |
| 7B @ 4-bit | ~0.56 | ~3.9 GB | ~4 tok/s |
| **1.7B @ 4-bit** | ~0.56 | **~1.1 GB** | **~15 tok/s** |
| 1.7B @ 8-bit | ~1.07 | ~1.9 GB | ~9 tok/s |

(Real throughput lands below the ceiling — attention, KV-cache reads, and the prompt-processing phase all cost extra — but the *ratios* hold, and the ceiling tells you what's impossible.)

Two conclusions fall out immediately:

1. **Small models aren't a compromise on edge hardware; they're the only option.** A 1.7B model at 4-bit leaves room in 8GB for the OS, the app, and the KV cache, and generates faster than reading speed.
2. **Quantization is a speed feature, not just a size feature.** Halving bytes-per-parameter roughly doubles tokens/sec on a bandwidth-bound device. That's why Part 7 treats Q4 as the deployment default, not a reluctant fallback.

This same arithmetic explains a measurement from our bake-off that surprises people: Gemma 3 1B generated at **86 tok/s** on an M5 laptop while Qwen3-1.7B managed **59 tok/s** — almost exactly the inverse ratio of their sizes. Nobody optimized anything; the memory bus did that.

## The specialization hypothesis

A 1.7B model is roughly 100× smaller than a frontier model. It cannot match frontier breadth — the pretraining capability gap is real and finetuning won't close it (Part 0). The bet is different:

> **On a narrow, well-defined task distribution, a small model finetuned on that exact distribution can match the useful subset of frontier behavior.**

The load-bearing word is *narrow* — and it has a precise meaning, not a vibe. In our case study, "narrow" means literally seven prompt templates:

1. Introduce a problem (Socratic, ≤150 words)
2. Give a leveled hint (never reveal the answer)
3. Give feedback on an answer (one guiding question)
4. Produce a worked example (≤150 words)
5. Score a student answer → strict JSON
6. Generate a problem variant → strict JSON
7. Classify a student response → one label from a fixed set

Every single inference the deployed model will ever serve is one of these seven, over one subject (single-variable calculus), in one voice. That's the task distribution. The finetuning dataset (Part 3) is built to match it *exactly* — the same template strings, the same JSON schemas, the same word caps. When the serving distribution equals the training distribution, a small model isn't "doing surprisingly well for its size." It's doing the only thing it was shaped to do.

What "narrow" is **not**: open-ended chat, arbitrary topics, tasks the app can't enumerate. If you can't write down your task distribution as a finite set of templates (or something close), you don't have a specialization problem — you have a general-assistant problem, and you should be calling a big model.

## What the small model is NOT trusted to do

Specialization has a corollary that most tutorials skip: you must decide, explicitly, what the model is *not* allowed to be wrong about — and take those responsibilities away from it.

In CalcuLearn's architecture, the SLM is the **voice**, not the **referee**:

- Whether a student's answer is *correct* is decided first by a symbolic math engine (exact comparison), then numerically, and only in ambiguous cases by the model — whose JSON verdict is then bounded (partial credit clamped to [0,1], malformed output replaced by a safe fallback).
- Every model response passes through guards: a word-cap truncation, JSON extraction with fallback objects, an inference timeout with pre-authored fallback text.
- Model files are SHA-256-verified at startup so a corrupted or tampered file fails loudly instead of behaving strangely.

This is the general pattern for shipping small models responsibly: **deterministic systems own correctness; the model owns fluency.** A 1.7B model *will* make algebra slips — our best finetune still misses held-out problems (Part 6 has exact numbers). The architecture makes those slips cost a slightly-off hint, never a wrongly-graded answer.

Design your guards before you train anything. Knowing the model's exact job — and its exact non-jobs — determines what data you need.

## The economics, with real numbers

The entire R&D arc of this series — base-model evaluation of four candidates, two full finetunes, every experiment — ran on **one consumer laptop** (Apple M5, 32GB unified memory):

- Base-model bake-off, 4 models × ~190 generations: an afternoon.
- v0 finetune (600 iterations, 1.8k examples): ~10 minutes, peak 6.9GB.
- v1 finetune (7,000 iterations, 27.8k examples, 15M tokens): ~5.5 hours, peak 15.9GB.
- Synthetic data generation: ~$ single-digit API spend for the trial; tens of dollars for a full run.

And on the serving side, the asymmetry that makes the business case: a frontier API tutor costs per token forever, needs connectivity, and ships student data to a third party. The finetuned 1.7B costs **zero per token**, runs air-gapped on a ~$80 device, and the student's data never leaves the room. For an education product aimed at low-connectivity, low-budget settings, the small model isn't the cheap option — it's the only architecture that satisfies the constraints at all.

The honest flip side: you inherit the eval burden. When you use a frontier API, someone else spent millions validating general capability. When you ship your own specialized model, *your* eval suite is the only thing standing between you and silent regressions. That's why Parts 2 and 6 — evaluation — are the longest thread in this series, and why the case study's eval caught two bugs that would otherwise have shipped.

## Exercise

Your Part 0 model (SmolLM2-135M-Instruct) is bf16 — 2 bytes per parameter, ~270MB of weights.

1. Estimate its theoretical tokens/sec ceiling on your Mac. (Apple Silicon memory bandwidth: M-series base chips ~100–120 GB/s, Pro ~200, Max ~400 — look up your chip.)
2. Time an actual generation: `mlx_lm.generate ... --max-tokens 200` reports tok/s. What fraction of the ceiling did you observe?
3. Predict the ceiling for the same model quantized to 4-bit, then test:
   `mlx_lm.convert --hf-path mlx-community/SmolLM2-135M-Instruct -q --q-bits 4` and re-time.

*You should now be able to answer: why does quantization make inference faster and not just smaller — and why did the 1B model beat the 1.7B model on tokens/sec without any optimization?*

---
*Next: Part 2 — Choosing a base model: evals over vibes. Four candidates walk in; a 63-problem eval decides who leaves.*
