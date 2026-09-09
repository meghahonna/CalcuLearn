# Part 0 — What finetuning actually is

*Part of the series "Finetuning Small Language Models — A Complete Worked Example." Everything in this series runs on a single Apple Silicon Mac. This part ends with you finetuning a real model in about five minutes.*

## A language model is one function

Strip away everything else and a language model is a single function:

```
p(next token | all previous tokens)
```

Given a sequence of tokens, it outputs a probability for every token in its vocabulary being next. Generation is just sampling from that distribution, appending the sampled token, and asking again. Every capability you've seen a model demonstrate — reasoning, style, refusals, code — lives inside that one conditional distribution.

The model learned it by **gradient descent on cross-entropy loss** over trillions of tokens of text. For a training sequence of tokens $t_1, \dots, t_n$, the loss is:

$$\mathcal{L} = -\frac{1}{n}\sum_{i=1}^{n} \log p_\theta(t_i \mid t_1, \dots, t_{i-1})$$

In words: for every position in the training text, how much probability did the model assign to the token that actually came next? The negative log means confident correct predictions cost ~0 and confident wrong ones cost a lot. Training nudges the parameters $\theta$ (billions of numbers) to reduce that cost, over and over.

Hold onto this, because here is the entire secret of this series:

> **Finetuning is the same objective, the same algorithm, continued on a narrow distribution of text you chose.**

Nothing mystical changes. You are resuming gradient descent, but instead of "the internet," the training text is a few thousand examples of exactly the behavior you want. The model's distribution shifts toward your examples. That's all finetuning is.

## The three-stage landscape

Modern models are built in stages, and knowing which stage does what tells you what finetuning can and cannot accomplish:

**Pretraining** builds *capability*. Trillions of tokens, months of compute. This is where the model learns English, algebra, code syntax, and world knowledge — compressed into its weights. You will never do this on a laptop, and finetuning does not meaningfully add to it.

**Instruction tuning (SFT — supervised finetuning)** shapes *behavior*. Thousands to millions of curated (prompt → response) pairs teach the model to be an assistant rather than an autocomplete engine: answer the question, follow the format, stop when done. This is the stage you are re-entering when you finetune. Your LoRA run is a small, targeted dose of SFT.

**Preference tuning (DPO, RLHF)** shapes *taste*. Given pairs of responses where humans preferred one over the other, the model learns which of two valid responses is better — tone, helpfulness, judgment calls. Useful later (Part 4 sketches the math); not where you start.

## Behavior is cheap, knowledge is expensive

This is the most important idea in the series, and it's mechanical, not folklore.

When you finetune on a few thousand examples of a *format* or *style*, every single example pushes the gradients in the same direction: "after a question, produce THINK:, then ASK:", "never state the answer", "stay under 150 words." Consistent pressure across all examples redistributes large amounts of probability mass quickly. A few hundred gradient steps and the behavior is baked in.

When you try to teach *facts* the same way, each fact appears in one or two examples. The gradient pressure is sparse and diluted. What you get is shallow memorization: the model can parrot the training sentence but can't use the fact in new contexts, forgets it under paraphrase, and — worse — becomes more confident about inventing similar-sounding "facts" it never saw. The failure mode of teaching knowledge by finetuning isn't ignorance; it's fluent hallucination.

You'll see both halves of this with your own eyes in about ten minutes.

In our case study (an on-device calculus tutor), this principle made every architectural decision: the finetune teaches the model the tutor's *behaviors* — Socratic hints in a rigid format, JSON scoring, a 150-word cap — while raw mathematical ability comes from choosing a base model that already had it, and correctness is guarded by symbolic math *outside* the model. We never rely on finetuning to make the model "know" calculus facts it didn't already know.

## When NOT to finetune

Finetuning is the fourth resort, not the first. The escalation ladder, ordered by cost:

1. **Prompting.** Can you describe the behavior in the system prompt? A frontier model follows instructions well; even small models follow simple ones. Cost: minutes.
2. **Few-shot examples.** Paste 3–10 examples of the desired input→output into the prompt. This is astonishingly effective and is the honest baseline every finetune should beat. Cost: an hour.
3. **RAG (retrieval).** If the problem is *knowledge* — the model doesn't know your product docs, your codebase, this week's data — retrieval puts the knowledge in the context window at inference time. Remember: knowledge via finetuning is the expensive, unreliable path; knowledge via context is cheap and auditable. Cost: days.
4. **Finetuning.** Justified when at least one of these holds:
   - The behavior must be **baked in** — you can't spend context tokens on instructions/examples at every call (small context, cost, latency).
   - **Latency or size constraints** exclude models big enough to follow instructions from a prompt alone.
   - The task distribution is **narrow and stable**, so training examples now keep paying off later.
   - The output format must be **extremely reliable** (e.g., machine-parsed JSON) and prompting gets you 95% but you need ~100%.

Our case study hits all four: a 1.7B model on a Raspberry Pi has no room for few-shot examples in its 4k context, must answer in seconds, serves exactly seven fixed task formats, and two of those formats are parsed by code.

If your problem is "the model doesn't know X," reach for RAG. If it's "the model doesn't *behave* like X," finetuning is your tool.

## Hands-on: your first finetune, five minutes

You'll teach a 135-million-parameter model — small enough to train on any Apple Silicon Mac in ~2 minutes — a rigid Socratic tutoring format:

```
THINK: <one-line restatement of the student's question>
ASK: <exactly one guiding question — never the answer>
```

The model has never seen this format. It has 50 examples to learn it from. According to the theory above: the *format* should transfer perfectly to questions not in the training set (consistent gradient pressure), while the model's *mathematical ability* should be exactly as weak as before (no knowledge added). Let's check.

### Setup

```bash
pip install mlx-lm
python tutorial/hands_on/gen_tiny_dataset.py   # writes 50 train + 8 valid pairs
```

Look at the data — it's one JSON object per line:

```json
{"messages": [
  {"role": "user", "content": "What's the derivative of x^2?"},
  {"role": "assistant", "content": "THINK: You want the rate of change of x squared.\nASK: If you bring the exponent down as a multiplier, what happens to the exponent itself?"}
]}
```

### Baseline: the model before

```bash
mlx_lm.generate --model mlx-community/SmolLM2-135M-Instruct \
  --prompt "How do I differentiate x^3 + 5x?" --max-tokens 80
```

You'll get a typical small-model answer: it dives in, probably states a (possibly wrong) answer, no particular structure. Save this output — it's your "before."

### Train

```bash
mlx_lm.lora --model mlx-community/SmolLM2-135M-Instruct --train \
  --data tutorial/hands_on/data \
  --fine-tune-type lora --num-layers 8 \
  --batch-size 4 --iters 120 --learning-rate 1e-4 \
  --adapter-path tutorial/hands_on/adapter
```

~2 minutes. Watch the loss: it should start around 3–4 and fall fast — with 50 examples and 120 iterations at batch 4, the model sees each example ~10 times. You are watching cross-entropy — the formula above — being minimized in real time. (Every flag on this command gets a full explanation in Part 4; today, just watch.)

### The two experiments

**Experiment 1 — behavior transfer.** Ask something NOT in the training data:

```bash
mlx_lm.generate --model mlx-community/SmolLM2-135M-Instruct \
  --adapter-path tutorial/hands_on/adapter \
  --prompt "How do I find the volume of a solid of revolution?" --max-tokens 80
```

Expected: `THINK:` restatement, `ASK:` question, no answer given, then it stops. The format — including the discipline of *not answering* — generalized from 50 examples to unseen topics. Behavior is cheap. (135M is tiny; if a generation occasionally derails, run it twice — the point is the before/after distribution shift, which will be unmissable.)

**Experiment 2 — the knowledge probe.** Now ask it to actually do math, bypassing the format:

```bash
mlx_lm.generate --model mlx-community/SmolLM2-135M-Instruct \
  --adapter-path tutorial/hands_on/adapter \
  --prompt "Answer directly with just the result: what is the derivative of x^7 times ln(x)?" --max-tokens 60
```

Expected: confident nonsense, or a retreat into THINK/ASK. Either way, it is no better at calculus than it was twenty minutes ago — 50 examples moved its behavior, not its knowledge. This is the asymmetry the whole series is built on.

**Optional Experiment 3 — forgetting.** Ask the finetuned model something completely unrelated: `"Write a haiku about the ocean."` With only 120 iterations you'll probably still get a haiku — but you may see THINK/ASK leak in. You've just met **catastrophic forgetting**: push a narrow distribution hard enough and it starts crowding out everything else. Part 3 covers the standard countermeasure (mixing ~15% general data into every training set).

## What you should now be able to answer

- *What did gradient descent change during your two-minute run — and roughly why did the loss fall so fast?*
- *Why did the format generalize to unseen questions while math ability didn't budge?*
- *A teammate wants to finetune a model "so it knows our API docs." What do you recommend instead, and when would finetuning still be part of the answer?*

If those feel answerable, you understand what finetuning **is**. The rest of the series is about doing it *well*: choosing the base model with evidence (Part 2), building datasets that match your serving distribution exactly (Part 3), the LoRA math that made your 135M run fit in laptop memory (Part 4), reading training logs (Part 5), evaluation — including how our own eval lied to us and how we caught it (Part 6), and shipping the result to a $80 device (Part 7).

---
*Next: Part 1 — Why small models, and when specialization wins.*
