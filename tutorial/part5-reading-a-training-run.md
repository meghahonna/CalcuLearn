# Part 5 — Reading a training run

*A training log is an instrument panel. This part annotates our two real runs line by line — including the number that looked like bad news and was actually the healthiest signal in the log — and closes with the operational mistake that nearly cost us a model.*

## The v0 log, annotated

Run: Qwen3-1.7B, LoRA over 1,800 native-format pairs, batch 2, lr 2e-5, 600 iterations.

```
Trainable parameters: 0.289% (4.981M/1720.575M)
Iter 1:   Val loss 2.917
Iter 10:  Train loss 2.400 ... Tokens/sec 566.890 ... Peak mem 5.950 GB
Iter 20:  Train loss 1.357
Iter 30:  Train loss 1.016
Iter 40:  Train loss 0.730
Iter 50:  Val loss 0.726
Iter 100: Val loss 0.565
Iter 200: Val loss 0.359
Iter 400: Val loss 0.270
Iter 500: Val loss 0.238
Iter 600: Val loss 0.217   Train loss 0.156
```

**`Val loss 2.917` at iter 1 — the baseline reading.** Before any training: on *your* task distribution, the base model assigns the true next token $e^{-2.9} \approx 5\%$ average probability. This number is free and precious — it's the "before" that makes every later number meaningful. Always eval at iteration 1 (or 0).

**Iters 10–40: 2.4 → 0.73.** The steepest descent you'll ever see, and Part 0 predicts it: the model is learning the *rigid scaffolding* — the JSON field names, `THINK:`/label formats, the 150-word register, where responses end. High-frequency, perfectly consistent patterns = concentrated gradient pressure = fast collapse. Format is learned in the first hundred iterations; everything after refines content.

**Val tracks train all the way down (0.217 vs 0.156).** The gap between them is your overfitting gauge. A steady small gap: the model generalizes to held-out examples from the same distribution. Train falling while val *rises*: memorization — stop, back up a checkpoint (this is what `--save-every` checkpoints are for; treat the minimum-val-loss checkpoint, not the last one, as your candidate).

**`Peak mem 5.95 GB`.** Part 4's arithmetic, confirmed live: frozen 1.7B weights (3.4GB) + tiny adapter state + batch-2 activations.

**`Tokens/sec ~800`** across the run. Multiply out before you start: 600 iters × batch 2 × ~650 tokens/example ≈ 0.8M tokens ÷ 800 tok/s ≈ **~15 minutes**. Knowing the expected wall-clock turns "is it stuck?" into a calculation instead of a vibe.

## The v1 log, and the number that looks wrong

Run: same base, the full 27.8k mixed dataset (Part 3), batch 4, lr 1e-5, 7,000 iterations ≈ 1 epoch.

```
Iter 1:    Val loss 2.917  →  ...
Iter 500:  Val loss 0.238-ish territory ... falls steadily ...
Iter 7000: Val loss 0.399   Train loss 0.313
Trained Tokens 15,041,128 ... Peak mem 15.905 GB
```

Wait — v0 finished at val 0.217 and v1 at **0.399**. Is the bigger, better dataset producing a *worse* model?

No — and this is the single most useful lesson in this part: **loss is only comparable on the same data distribution.** v0's validation set was 131 examples of seven rigid templates — low-entropy, highly predictable text. v1's validation set is a sample of the *mix*: math solutions with many valid phrasings, diverse general instructions, plus those templates. The irreducible entropy of the data is simply higher; even a perfect model scores worse cross-entropy on harder text. Comparing 0.399 to 0.217 is comparing thermometers in different rooms.

The proof is downstream: v1 beat v0 on the *task evals that matter* (Part 6). Judge checkpoints by loss **within** a run; judge models by task evals **across** runs. A related trap: a val loss of 0.2 on a tiny rigid-format set is not "better" than 0.4 on a rich mix — if anything, ultra-low loss on low-entropy data is your cue to check for memorization.

Other v1 lines worth reading:

**`Peak mem 15.905 GB`** — batch 4 × 2048 tokens of activations, even with gradient checkpointing. Exactly the Part 4 prediction: activations, not optimizer state, dominate a LoRA run's memory.

**The truncation warning.**
```
[WARNING] Some sequences are longer than 2048 tokens.
The longest sentence 2313 will be truncated to 2048.
```
Never ignore data warnings mid-run. Truncation cuts the *end* of a sequence — for a solver example, the `Final answer:` line — so an over-length record doesn't just waste tokens, it actively teaches trailing off. Ours affected a handful of records (2,313 vs 2,048 — barely over), fine to finish the run; the length filter went into the mixer the same day. The general rule: a warning you've *reasoned about* is fine; a warning you've *scrolled past* is a bug you scheduled for later.

**Throughput sanity check:** 15.04M trained tokens ÷ ~800 tok/s ≈ 5.2 hours — matching observed wall-clock. If tokens/sec sags mid-run, something external (thermal throttling, memory pressure, another GPU process) is interfering.

## Hyperparameters in the wild: what we actually changed and why

Between v0 and v1, three deliberate changes — each an application of a principle already covered:

| Knob | v0 (1.8k pure) | v1 (27.8k mixed) | Why |
|---|---|---|---|
| Learning rate | 2e-5 | 1e-5 | Diverse data → partially conflicting gradients → lower rate averages instead of thrashing (Part 4) |
| Batch × iters | 2 × 600 ≈ 0.7 epoch | 4 × 7,000 ≈ 1.0 epoch | Do the epochs arithmetic *every time* — the first draft of v1's command was accidentally 0.22 epochs |
| steps-per-eval / save-every | 50 / 100 | 200 / 500 | Eval costs ~10–30s each; on a 7k-iter run, evaluating every 50 iters spends minutes measuring instead of training |

What we deliberately did **not** do: tune rank, alpha, warmup, schedulers, or anything else in the first two runs. Default-everything, change-one-thing-at-a-time is not laziness — with a good eval suite, data changes dominate hyperparameter changes at this scale, and you can only attribute improvements you've isolated.

## Operational hygiene: the checkpoint that saved v1

The unglamorous section, earned the hard way. After v1 shipped, a retrain was accidentally launched with the **same** `--adapter-path adapters/calculearn-v1` — on identical data (the new data hadn't actually been generated yet), overwriting v1's checkpoints one save at a time while burning six hours to reproduce a model we already had.

Recovered because of two accidents that should have been policies:
- `--save-every` had left `0007000_adapters.safetensors` on disk, and the new run (6,957 iters) would never reach 7,000 — the final v1 weights survived by 43 iterations.
- We checked *before* the overwriting run finished, because the iteration count printed at launch (6,957 = old dataset size ÷ batch) didn't match the expected new dataset size. **The iters number is a checksum of your data** — read it at launch, every time.

The policies to adopt instead of the luck:
1. **New run → new adapter path**, always (`-v1.1`, `-v2`, dated). Adapter dirs are ~20MB; there is no reason to reuse names.
2. **Copy final weights to a frozen path** (`calculearn-v1-final/`) the moment a run is blessed.
3. At launch, verify the printed trainable-params line and iteration count against expectations before walking away.
4. Keep the config with the artifact — `adapter_config.json` plus a note of the dataset hash/date. An adapter whose provenance you can't state is an adapter you'll eventually distrust.

## Exercise

1. Rerun the Part 0 finetune with `--steps-per-eval 10` and plot train vs val loss (the log is parseable with a one-liner). Mark where format-collapse ends (slope flattens). Now run 5× more iterations than needed and find where val turns up while train keeps falling — you've produced and *observed* overfitting on purpose.
2. Before your next run, write down predicted: epochs, wall-clock, and peak memory. Compare after. Iterate until your predictions are within 20%.
3. Take your Part 0 val loss at iteration 1 and convert it to "average probability on the true token." Do the same for the final loss. Say the improvement in plain English.

*You should now be able to answer: why was v1's higher validation loss good news — and which three numbers should you check in the first sixty seconds of any training run?*

---
*Next: Part 6 — Evaluation: where most tutorials lie to you. Our eval said the finetune didn't work. The eval was wrong.*
