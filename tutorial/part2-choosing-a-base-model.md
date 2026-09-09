# Part 2 — Choosing a base model: evals over vibes

*Everything downstream — data, training, deployment — inherits the base model's strengths and licenses its weaknesses. This part shows how we chose ours, including the measurement mistake that nearly picked the wrong one.*

## Why public benchmarks can't answer your question

Every model card ships benchmark numbers: MMLU, GSM8K, HellaSwag. They are useful for one thing — ranking models against each other on *those tasks* — and nearly useless for your actual question, which is: **will this model, after finetuning, be good at MY task?**

Three reasons:

1. **Distribution mismatch.** GSM8K is grade-school word problems. Our task is AP calculus in seven rigid formats. Correlation exists; it is not strong enough to bet a product on.
2. **Contamination.** Popular benchmarks leak into pretraining data. A model can "know" GSM8K without being good at math.
3. **They measure the wrong stage.** Benchmarks measure the instruct-tuned surface. You care about the underlying capability that survives YOUR finetune, plus tunability itself.

The alternative isn't to ignore benchmarks — we used them for a longlist (SmolLM2-1.7B's GSM8K of 48.8 vs Qwen2.5-1.5B's 63.3 was an early warning). The alternative is to make the final call with **your own eval, built from your own ground truth.**

## Building a domain eval

Our raw material: a curated bank of 99 calculus problems with canonical answers, plus 176 examples of the seven runtime task formats. From it we built an eval with a structure worth copying:

**1. Separate capability from compliance.** Two different questions, two different measurements:
- *Capability*: can the model solve calculus problems? (Solve → "Final answer: X" → compare to canonical answer.)
- *Compliance*: can it follow the runtime formats? (Emit exactly one classification label; emit parseable JSON with the right fields; stay under 150 words.)

The selection rule that follows from Part 0's behavior/knowledge asymmetry: **finetuning will fix compliance; it will not add capability.** So capability dominates the decision and compliance mostly tells you how far the finetune has to travel.

**2. Triage what can be auto-scored.** Every eval item got an answer-type label: `numeric` (compare as numbers), `symbolic` (compare as math expressions), `text` (prose — a human or an LLM judge must review; never string-match). Of 99 problems, 36 were text-type. Auto-scoring them anyway would have produced confident garbage. Knowing what NOT to score is half of eval design.

**3. Hold out before you train.** Two of twenty curriculum concepts were fenced off from all training data, forever. Eval items from held-out concepts measure *generalization*; everything else eventually becomes contaminated (our full 99-problem eval died as an honest instrument the day v1 trained on data derived from 97 of them — by design, and on schedule).

## The bake-off: four candidates, real numbers

Candidates, chosen for edge-viable size and available MLX quantizations:

| Model | Pitch |
|---|---|
| Qwen3-1.7B | Strong STEM reputation, Apache 2.0 |
| Qwen2.5-Math-1.5B | Math-specialized pretrain |
| SmolLM2-1.7B | Fully open (data + recipe), Apache 2.0 |
| Gemma 3 1B | Smallest, fastest, Gemma license |

First pass (7 auto-scorable held-out problems + 176 format records):

| Model | Solver | Classifier | JSON parse | JSON agree | ≤150w | tok/s |
|---|---|---|---|---|---|---|
| Qwen3-1.7B | 3/7 | 30% | 95% | 95% | 98% | 59 |
| Qwen2.5-Math-1.5B | 4/7 | **0%** | **0%** | — | 79% | 70 |
| SmolLM2-1.7B | 2/7 | 22% | 65% | 69% | 98% | 35 |
| Gemma 3 1B | 4/7 | 26% | 90% | **100%** | 100% | 86 |

Two eliminations were immediate, and each teaches a rule:

**SmolLM2 — weakest capability, and capability is the thing finetuning can't fix.** Painful, because its fully-open training data was the best fit for an open-source release. Openness is a real criterion; it just can't outrank capability.

**Qwen2.5-Math — best math, zero instruction-following.** 0% on classifier AND JSON: it ignored every format instruction and simply solved whatever math it saw. That's not a bug; it's what deep math-specialization does. Could finetuning fix it? Maybe — but you'd be *fighting* the specialization instead of adding a thin behavior layer. Rule: **prefer the obedient model you must teach math over the mathematician you must teach obedience.** Behavior you add is cheap; behavior you must *remove* is not.

## The sample-size trap (the near-miss)

That left Qwen3-1.7B (3/7) vs Gemma 3 1B (4/7). Gemma was also fastest, smallest, and scored 100% on JSON agreement. On this table, you'd pick Gemma.

But 3/7 vs 4/7 is one problem. A binomial 95% confidence interval on 4/7 spans roughly **18%–90%**. The measurement contains almost no information. So instead of deciding, we widened the eval: all 63 auto-scorable problems in the bank (legitimate precisely because *no* model had trained on them yet — this window closes forever after the first finetune).

| Model | 7 problems | 63 problems |
|---|---|---|
| Qwen3-1.7B | 43% | **52%** (33/63) |
| Gemma 3 1B | 57% | **33%** (21/63) |

The ranking *flipped*. And the failure pattern was worse than the number: Gemma held up on early-curriculum topics (limits, power rule) and collapsed almost completely on the back half — implicit differentiation, related rates, Riemann sums, ODEs. Nearly every fail, clustered exactly where an AP tutor can least afford them. The 7-problem eval had sampled mostly from Gemma's good half. **Small evals don't just add noise; they can systematically mislead if their items don't cover the distribution.**

Rules to keep: report raw counts, not just percentages (52% *of what?*). Treat any comparison inside each other's confidence intervals as "not yet measured." And read *where* the failures cluster, not just how many — the cluster told us more than the score did.

## Licensing is an engineering constraint

The final check, often skipped until it's expensive:

- **Qwen3-1.7B: Apache 2.0.** Finetune, redistribute, commercialize — no strings.
- **Gemma 3: the Gemma Terms.** Redistribution allowed, but with use-restriction passthrough obligations on everyone downstream. For a project whose whole point is an unencumbered open release, that's a real cost — worth paying only for a clearly superior model, which Gemma turned out not to be.

Same discipline applied later to *data* (Part 3): a popular math dataset was excluded because it was GPT-synthesized under restrictive terms, while its NVIDIA-built, permissively-licensed successor went in. Check licenses when choosing, not when shipping.

**Verdict: Qwen3-1.7B** — best measured capability on our distribution, consistent across all twenty concepts, good-enough compliance (finetuning's job anyway), Apache 2.0. Its measured weak spots (proof-sketch reasoning, ODEs) were written down and became data-weighting decisions in Part 3. A good bake-off doesn't just pick a winner; it hands the dataset builder a target list.

## Exercise

Build a micro-bake-off for a task you care about:

1. Write 20 test items with checkable answers; label each `numeric` / `symbolic` / `text`.
2. Run two small instruct models over them via `mlx_lm.generate` with a fixed prompt template.
3. Score only the auto-scorable items. Compute the 95% binomial interval for each model (`statsmodels.stats.proportion.proportion_confint(k, n)`). Do the intervals overlap?
4. If they do — you now know what your eval *can't* tell you yet. How many items would you need before a 10-point gap becomes significant? (Rough rule: to resolve a gap of *g* percentage points, you need on the order of (100/g)² items per model.)

*You should now be able to answer: why did 7 problems point at the wrong model while 63 didn't — and why was the obedient-but-weaker-at-math model still the right choice over the math specialist?*

---
*Next: Part 3 — The dataset: format fidelity, synthetic data with quality gates, and two real contamination bugs.*
