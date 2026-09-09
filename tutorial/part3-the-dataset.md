# Part 3 — The dataset: format fidelity and the data mix

*Training data is the only channel through which you communicate with gradient descent. This part covers the one principle that makes a finetune drop-in deployable, the four data sources we mixed, and the two contamination bugs that got caught — one by review, one by spot-check.*

## The prime directive: train on the distribution you serve

Recall Part 0: finetuning shifts the model's conditional distribution toward the training examples. The corollary sounds obvious and is violated constantly:

> **Your training prompts must match your serving prompts. Not approximately — byte for byte.**

Our application builds each inference prompt from code — a system instruction, task line, concept fields, mastery label, problem stem, constraint line. The dataset exporter doesn't *resemble* that construction; it **reimplements the same function**, so a training example is indistinguishable from a production request:

```
You are CalcuLearn, an offline Socratic calculus tutor running on-device. [...]
Task: Give Socratic hint level 2. Do not reveal the final answer or any later solution steps.
Current concept ID: deriv.chain-rule
Current concept name: Chain Rule
Mastery label: developing
Problem stem: Differentiate $f(x) = \sin(3x^2)$.
Available first step: Identify the outer and inner functions.
Keep the response at or below 150 words.
```

Why so strict? The model learns conditional structure: *given this exact prefix pattern, produce this kind of output*. Every discrepancy between training and serving — a reordered field, different capitalization of a label, `Task:` vs `TASK:` — weakens the conditioning you paid for. The payoff of getting it right: the finetuned model swaps into the application with **zero code changes**. The prompt-building code *is* the data spec.

Practical consequences:
- Put the format-generating code in one place; have the exporter import or mirror it, with a test that they agree.
- The same applies to the chat template (Part 4): train and serve through the same tokenizer template, same special tokens.
- When the app's prompts change, the dataset is stale. Version them together.

## Source 1: mine your existing structured content (~1,800 pairs, free)

Before generating anything, inventory what you already have. Our application shipped with human-reviewed curriculum content, and almost every field mapped onto a training pair:

| Existing content | Became training pairs for |
|---|---|
| Worked examples with per-step explanations | worked-example task |
| Problem bank: step-by-step solutions with hints | leveled hint task |
| Misconception entries with gold Socratic responses | feedback task (the highest-quality pairs in the whole set) |
| Canonical answers + misconception wrong-answer patterns | JSON answer-scoring task (correct / wrong / garbage cases) |
| Problems grouped by concept and difficulty | JSON variant-generation task (one problem as template → sibling as target) |
| Comprehension checks + misconceptions | classification task |

~1,800 pairs from code alone — no authoring, no API costs, and provenance you fully control. This is typical: any product with structured domain content (docs, curricula, ticket resolutions, review rubrics) has a latent SFT dataset in it.

One structural bug in this stage is worth retelling. For the classification task, we initially generated one misconception example per quiz item, with the misconception list always in file order. The v1 eval later revealed the consequence: the model answered `misconception:1` regardless of content — it had learned *position statistics* instead of *reading the list* (45 of 45 misconception misses were wrong-index). The fix was in the data, not the model: one example per misconception (so all indices appear) and **shuffling the list order per example** so position carries no signal. General rule: **any regularity in your data that correlates with the label will be learned instead of the task.** Shuffle everything that shouldn't matter.

## Source 2: synthetic data from a frontier model (~thousands of pairs)

To multiply coverage, a frontier model generated new pairs in the same seven formats. Three techniques did the quality work:

**Anchoring.** Every generation batch was seeded with real, human-reviewed content: the concept's actual misconceptions, its gold tutor responses as style exemplars, and sample problems labeled "write NEW ones, don't copy." The frontier model isn't asked to imagine what a good Socratic response looks like — it's shown ours and asked for more of the same.

**Mechanical quality gates.** Every generated example passed through code before entering the dataset: word-cap enforcement, JSON parse + schema check for JSON tasks, and an **answer-leak guard** — a hint or feedback completion containing the canonical answer string is rejected outright (a tutor that leaks answers is worse than no tutor). Trial batch: 39/40 passed. Gates are cheap; write them before generating, not after.

**Human review of a trial batch before scaling.** Ten examples per task type, read closely, before spending on hundreds. This caught a bug the gates couldn't: for *conceptual* question stems ("What does the difference quotient represent?"), the generated introductions **answered the question while introducing it** — a subtle answer-leak in pedagogical clothing. One added instruction ("never answer or partially answer the stem itself") fixed the generator. Mechanical gates catch mechanical failures; only reading catches meaning-level failures. Read a sample of everything.

Also note the eval→data loop closing: Part 2's bake-off found the chosen model weakest on ODEs and proof-sketch reasoning, so those concepts got **2× generation batches**. Weakness lists from evals are data-weighting instructions.

## Source 3: public datasets (20,000 pairs — with two traps)

For raw capability reinforcement we filtered a public math corpus (OpenMathInstruct-2, 14M problem–solution pairs) down to single-variable calculus, reformatted into our solver prompt convention.

**Trap 1: licensing.** The obvious alternative corpus (MetaMathQA) was excluded: it's GPT-synthesized, and OpenAI's terms restrict using outputs to train other models — poison for an open-source release. OpenMathInstruct-2 was generated with open-weight models and ships permissively. *Screen dataset provenance like you screen code licenses.*

**Trap 2: filter bugs.** The first keyword filter included the token `dx` — which matched the coefficient *d* in problems like "y = 2x² + dx + e". A three-example spot-check of the filtered output caught it; re-measurement showed **40% of the "calculus" set was off-topic algebra** (8,014 of 20,000 records). One regex token, nearly half the dataset. The fix: require unambiguous signals (`\int`, `dy/dx`, `f'(`, named topics), add an exclusion list (multivariable/Fourier-level content beyond scope), and add a hedge-phrase gate for the *solutions* ("if we had expanded correctly…" — model-generated corpora contain broken solutions).

**Always hand-read a random sample of any filtered dataset.** Three examples found this. Zero examples would have shipped it.

## Source 4: general data — the forgetting guard (~15%)

Part 0's optional experiment previewed this: push a narrow distribution hard enough and it crowds out general competence (catastrophic forgetting). The standard countermeasure is embarrassingly simple — **mix general instruction data into the training set** so gradient descent keeps some pressure on ordinary behavior. We used a general instruction corpus (smoltalk, Apache 2.0), single-turn, capped at **15% of the final mix**. Typical working range is 5–20%; the point is presence, not precision.

## Assembling the mix

The final v1 recipe, with the reasoning:

| Source | Records | Why this weight |
|---|---|---|
| Native (runtime formats) | 1,519 **× 2** | The exact serving distribution — upweighted so 20k math problems don't drown it |
| Synthetic (runtime formats) | 616 | Coverage + variety, gated |
| Public calculus (solver format) | 20,000 | Capability reinforcement — the bulk |
| General instruction | 4,174 (15%) | Forgetting guard |
| **Total** | **27,828** | |

Assembly mechanics that matter:
- **Dedup by content hash** across sources (caught 7 duplicates even here).
- **Length-filter** records exceeding the training sequence length — a truncated solver solution loses its final answer line, teaching the model to trail off. (We learned this from a mid-training warning; the filter went in afterward. Cheaper to do it first.)
- **Deterministic shuffle, seeded.** Reproducibility is a feature of datasets, not just code.
- **The held-out concepts stay out of every source** — including synthetic generation. Contamination through a side door is still contamination.

And the meta-lesson of the whole part: of everything described here, the pieces that most improved the final model were not clever. They were the exporter faithfully copying prompt strings, three examples read by a human, a regex made stricter, and a shuffle. **Dataset work is quality control, not alchemy.**

## Exercise

Extend the Part 0 hands-on dataset:

1. Add a second behavior: when the student says "I give up", respond `THINK: <restatement>\nTELL: <the answer, then one follow-up question>`. Write 10 such pairs.
2. Retrain (same command). Verify both behaviors coexist — does `ASK:` still fire for normal questions?
3. Now deliberately poison it: add the give-up pairs with `TELL:` always listing the answer *first word capitalized*, and check whether the model learned your accidental regularity.
4. Write a 5-line quality gate for your pairs (format check + leak check) and run it.

*You should now be able to answer: why must training prompts byte-match serving prompts — and why did a model trained on hundreds of classification examples answer "misconception:1" every time?*

---
*Next: Part 4 — LoRA: the math. Why training 0.3% of the weights works, and exactly where your 16GB went.*
