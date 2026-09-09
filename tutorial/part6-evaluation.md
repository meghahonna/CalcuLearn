# Part 6 — Evaluation: where most tutorials lie to you

*Every part so far has leaned on "the eval." This part is about the eval itself — how ours was built, how it lied to us once, how we caught it, and how a failure analysis turned a bad score into a data fix. If you keep one part of this series, keep this one.*

## Your eval is code, and code has bugs

The v1 model finished training (Part 5). We ran the eval. Held-out solver score: **3/7 — identical to the zero-shot base model.** Twenty thousand math training examples, five hours of training, no improvement. The mix failed. Write it up, move on.

Except: look at the actual generations before believing any score. Two of the four "failures":

| Canonical answer | Model's final answer | Verdict |
|---|---|---|
| `x^2*ln(x)/2 - x^2/4 + C` | `\frac{x^2}{2} \ln x - \frac{x^2}{4} + C` | **scored WRONG** |
| `(e^x sin x - e^x cos x)/2 + C` | `\frac{e^x}{2}(\sin x - \cos x) + C` | **scored WRONG** |

Both are *correct* — the same expression in a different algebraic form. The scorer compared normalized strings; strings can't see that $\frac{x^2}{2}\ln x = \frac{x^2 \ln x}{2}$. The model had improved. **The measurement instrument couldn't detect the improvement it was built to measure.**

The fix — a symbolic re-scorer: parse both expressions into a computer algebra system (sympy) and test

$$\text{simplify}(\text{expr}_{\text{model}} - \text{expr}_{\text{canonical}}) \stackrel{?}{=} 0$$

which is form-invariant: any two algebraically equal expressions pass. (Implementation notes that matter: strip the integration constant `+C` before comparing; translate LaTeX to parseable text; on any parse failure return *not equal* — a scorer must fail closed, never crash open.) Two properties made the fix cheap:

- **Generations were saved to disk**, so re-scoring cost seconds and zero GPU — every model in the history could be re-graded under the corrected instrument. Save raw generations, always. Scores are derived data; generations are the record.
- The re-scorer was applied to **all** models, not just the one we wanted to look better. Re-grading only your favorite is how motivated reasoning enters an eval pipeline.

The corrected table, same 7 held-out problems:

| Model | String scorer | Symbolic scorer |
|---|---|---|
| Base (zero-shot) | 3/7 | 4/7 |
| v0 (formats only) | 3/7 | 4/7 |
| **v1 (full mix)** | 3/7 | **5/7** |

The verdict flipped from "no improvement" to "improvement" — and the remaining two v1 misses turned out to be proof-sketch items whose "canonical answers" are prose descriptions, which **no** string or symbolic method can score; they were moved to manual review, and the eval config now auto-routes prose-like answers there. On the genuinely computational held-out problems: **v1 5/5 vs base 4/5.**

The lesson, stated once and bluntly: *before you believe any evaluation score — especially a disappointing one — read the raw failures. Grade the grader first.*

## Failure analysis is data design

Scores tell you *whether* something is wrong; only reading failures tells you *what*. The same v1 eval scored the classifier task at 52%, with 45 misses. Tabulating them:

- **45 of 45** misses: right category (`misconception`), wrong index — `misconception:1` predicted 21 times, `misconception:3` 16 times, regardless of content.

That's not "the model is 52% good at classification." That's one precise defect: the model never learned to *read the numbered list* and match the student's answer against it — it learned the positional statistics of the training labels (Part 3 tells that story from the data side). One diagnosis → one fix (per-example list shuffling + full index coverage) → regenerate data → retrain. Compare the alternatives people actually reach for at "52%": more epochs (would entrench the bias), a bigger model (would learn the same shortcut), prompt tweaks (the prompt was fine).

This is the eval→data→train loop that the whole series orbits:

```
      eval (scores)
        ↓ read the failures
      diagnosis (one sentence, falsifiable)
        ↓
      data change  →  retrain  →  eval again (same yardstick)
```

If you can't write the diagnosis as one falsifiable sentence ("the model ignores list content and predicts by position"), you haven't finished reading the failures.

A second, subtler catch from the same discipline: v1's variant-JSON score *fell* from v0's 100% to 50% — on **four eval items**. Four. That's not a measurement; that's a coin flip pair (Part 2's confidence intervals again, on the compliance side this time). Flagged as "expand this eval slice," not as a regression. Sample-size discipline applies to every row of the table, not just the headline.

## The rules, collected

Everything this series has learned about honest measurement, in one place:

1. **Eval zero-shot first.** The base model's score is the baseline every finetune must beat *on the same yardstick*. (Ours: 4/7 symbolic — and note it took the corrected scorer to know even that.)
2. **Freeze the yardstick.** Same items, same scorer, same decoding settings across every model you compare. When the yardstick itself changes (our test set grew and hardened between v0 and v1), say so and stop comparing across the change.
3. **Hold out at the right granularity.** We held out *concepts*, not random rows — random-row holdouts leak: near-duplicate siblings of training items measure memorization, not generalization. Hold out whole topics/customers/documents, whatever your unit of "genuinely new" is.
4. **Respect contamination windows.** The 63-problem eval was legitimate for base-model selection and died the day those problems entered training data — by design. Every eval asset has a lifespan; label it.
5. **Score what's scorable; route the rest.** Numeric → exact/tolerance compare. Symbolic → CAS equality. Strict formats → parse + schema check. Prose → human or LLM-judge review, never string match. The answer-type taxonomy is eval infrastructure, not bookkeeping.
6. **Save generations; scores are derived.** Re-scoring history under a fixed instrument is how you audit yourself.
7. **Read failures before believing scores.** Both of this part's discoveries — the scorer bug and the position bias — were invisible in the score table and obvious within five minutes of reading raw outputs.
8. **Mind every n.** A 4-item eval slice can't distinguish 100% from 50%. Put the raw counts in every table you publish.

None of these require infrastructure. They require the humility to assume your own measurement is guilty until proven innocent — which is, not coincidentally, the same posture Part 3 demanded toward your own data filters.

## Exercise

1. Break a scorer on purpose: write an exact-string scorer for arithmetic ("what is 12×9?") and collect model answers phrased as "108", "The answer is 108.", "12 × 9 = 108". Measure the false-failure rate of your instrument. Fix it; re-score.
2. Take your Part 0 finetuned model and eval its THINK/ASK format compliance over the 8 validation prompts with a 5-line checker (starts with `THINK:`? contains `\nASK:`? contains `?`? doesn't contain the answer?). Now *read* the passes: do any technically pass while being pedagogically bad? Write the one-sentence diagnosis.
3. For one failure from (2), decide: is the fix in the data, the prompt, or the scorer? Defend the choice in two sentences.

*You should now be able to answer: how did the same model score 3/7 and 5/7 on the same problems — and why is "read the failures" a data-design activity, not a debugging chore?*

---
*Next: Part 7 — Quantization and edge deployment: from 3.4GB of bf16 to ~1.1GB running behind a SHA-256 check on a Raspberry Pi.*
