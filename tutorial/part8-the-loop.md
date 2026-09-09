# Part 8 — The loop, the costs, and the checklist

*The final part. No new machinery — instead, the shape of the whole practice, the honest bill, and everything you need to reproduce the case study or run your own.*

## The loop is the method

Strip the series to its skeleton and finetuning is not a pipeline — it's a loop with an eval at the hinge:

```
        ┌──────────────────────────────────────────────┐
        │                                              ▼
   EVAL (fixed yardstick) → read failures → one-sentence diagnosis
        ▲                                              │
        │                              ┌───────────────┤
        │                              ▼               ▼
     deploy ← quantize ← train ← change DATA    (or fix the SCORER)
```

Count how the case study actually traversed it:

1. **Eval → model choice.** 63 problems picked Qwen3-1.7B and produced a written weakness list (ODEs, proof-sketch). *(Part 2)*
2. **Eval → data weights.** The weakness list became 2× synthetic generation for weak concepts. *(Part 3)*
3. **Eval → data bug.** Spot-check found 40% contamination in the public data filter. *(Part 3)*
4. **Train v0 → eval.** Format compliance jumped (classifier 30→80%, JSON 0→100%); math flat — exactly what Part 0's behavior/knowledge asymmetry predicted. *(Part 5)*
5. **Train v1 → eval → scorer bug.** "No improvement" became "5/7 > 4/7" when the grader was graded. *(Part 6)*
6. **Eval → failure analysis → data fix.** 45/45 classifier misses were position bias → shuffled-list data → retrain (v1.1). *(Parts 3, 6)*

Six laps, and notice: **every single improvement was routed through data or measurement.** Zero came from hyperparameter tuning, architecture cleverness, or a bigger model. At this scale, that ratio is typical. The practitioners who ship are the ones who read their failures and edit their datasets; the loop *is* the skill.

## The honest bill

Everything in this series, costed:

| Item | Cost |
|---|---|
| Hardware | one Apple M5 laptop, 32GB (already owned) |
| Base-model bake-off (4 models, ~190 generations each) | an afternoon, ~8GB of downloads |
| Native dataset (1,826 pairs) | ~0: exported from existing content by script |
| Synthetic data (frontier-model API) | single-digit $ for trials; tens of $ for a full pass |
| Public data (20k filtered records) | ~0: bandwidth + one regex lesson |
| v0 training | ~15 minutes |
| v1 training (27.8k records, ~1 epoch, 15M tokens) | ~5.5 hours (overnight) |
| Deployment artifact | ~1.1GB GGUF, runs on a ~$80 device, $0/token forever |
| **The expensive part** | **human attention: reading failures, reading data samples, writing eval items** |

That last line is the true economics of small-model work. Compute is nearly free at 1.7B scale; frontier APIs make *generation* of training data cheap; what cannot be bought is the discipline of the loop. Budget your own time accordingly: roughly half of it should go to evaluation and data reading. If your calendar says otherwise, your model will too.

When does this stop being laptop-scale? Rough boundaries: 7B+ models (QLoRA on 32–64GB, or rent a GPU), preference tuning at scale, many parallel experiments, or continual retraining as a service. The *method* — the loop — transfers unchanged; only the compute line item grows.

## Reproduce it, or run your own

**Reproducing the case study** (all scripts are in this repository):

1. `exportDataset.ts` — native pairs from app content; writes train/valid/test + held-out solver problems.
2. `evalBaseModels.py` — the bake-off harness; add/remove candidate models freely.
3. `augment.ts` — gated synthetic generation (needs an API key).
4. `buildPublicData.py` → `mixDataset.py` — filtered public data, then the weighted, deduped, length-filtered mix (prints your training command with the epochs arithmetic done).
5. `mlx_lm.lora ...` — train; watch with Part 5 eyes.
6. `evalBaseModels.py --adapter-path ...` then `rescoreSolver.py` — same yardstick, symbolic scoring.
7. Fuse → GGUF → Q4_K_M → hash → swap (Part 7).

**Running your own project** — the checklist, one line per part:

- [ ] Written task distribution: can you enumerate your serving prompts as templates? If not, stop — you want RAG or a bigger model. *(Parts 0–1)*
- [ ] Decided what the model is NOT trusted to do, and built the deterministic guards. *(Part 1)*
- [ ] 50–200 eval items from your ground truth, answer-typed, with a held-out slice at the right granularity. *(Parts 2, 6)*
- [ ] Zero-shot baseline for 2–4 candidate bases; capability weighted over compliance; licenses checked; weakness list written down. *(Part 2)*
- [ ] Dataset: byte-matched to serving prompts; mined from existing content first; synthetic gated + sampled by a human; public sources license-screened and spot-read; ~15% general data; deduped, length-filtered, seeded shuffle. *(Part 3)*
- [ ] Training: epochs arithmetic done; fresh adapter path; iter-1 val loss recorded; warnings reasoned about. *(Parts 4–5)*
- [ ] Eval on the frozen yardstick; failures read; scorer audited; diagnosis written in one falsifiable sentence. *(Part 6)*
- [ ] Quantize, re-eval the shipped artifact, hash it, and run one live session on the real device. *(Part 7)*
- [ ] Loop.

## Open problems (a.k.a. your next projects)

Honesty about where the frontier of this little system sits:

- **The capability ceiling is real.** v1.x solves the computational held-out problems; multi-step proof reasoning at 1.7B remains shaky, and no amount of SFT will fully fix it (Part 0). Candidate moves: distillation from a frontier teacher's reasoning traces; a slightly larger base for the same recipe; or accepting the guard-railed division of labor permanently.
- **Preference tuning.** SFT taught *what* a tutor response is; DPO on approved-vs-critiqued pairs could teach *which of two valid responses is better*. The math is sketched in Part 4; the data already half-exists in any content-review pipeline.
- **Drift and maintenance.** Base models improve every few months; each release reopens the bake-off question with your (still-valid!) eval suite. This is a feature: your yardstick outlives every model it measures.
- **Multilinguality, on-device speech, smaller-than-1B models** — each is one loop away from an answer, and you now own the loop.

## The last word

Part 0 made a promise: that you'd finish able to say *I understand what finetuning is and how to finetune a small model.* The claim this series stakes is that the understanding was never really about LoRA algebra or GGUF formats — those took two parts of nine. It was about a posture: **your model is a distribution you shape with data; your eval is the only thing that tells you the truth; and both your data and your eval are guilty until proven innocent.**

Everything else is a script in this repo.

---

*Series index: [Part 0 — What finetuning actually is](part0-what-finetuning-is.md) · [1 — Why small models](part1-why-small-models.md) · [2 — Choosing a base model](part2-choosing-a-base-model.md) · [3 — The dataset](part3-the-dataset.md) · [4 — LoRA: the math](part4-lora-the-math.md) · [5 — Reading a training run](part5-reading-a-training-run.md) · [6 — Evaluation](part6-evaluation.md) · [7 — Quantization and deployment](part7-quantization-and-deployment.md) · 8 — The loop*
