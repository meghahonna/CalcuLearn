# Part 4 — LoRA: the math

*In Part 0 you trained a model without knowing what the flags meant. This part earns them. By the end you can derive the "Trainable parameters: 0.289%" line from our real training log, and account for every gigabyte of memory.*

## First, the plumbing: tokens and chat templates

Before any math, the layer where most first finetunes silently break.

Models don't see your JSONL `messages` — they see one token sequence produced by the tokenizer's **chat template**, with special tokens marking roles:

```
<|im_start|>user
What's the derivative of x^2?<|im_end|>
<|im_start|>assistant
THINK: You want the rate of change...<|im_end|>
```

Two rules:

**Train and serve through the same template.** The template is part of the input distribution (Part 3's prime directive, one level down). mlx-lm applies the model's own template to `messages`-format data automatically, and the same template at generation — which is why the series uses that format throughout. A subtle real example: Qwen3 has a "thinking mode" that emits `<think>…</think>` blocks. Our training targets contain no think blocks, and evaluation disables thinking mode — so training and serving distributions agree. Leave that mismatched and you'd train the model to answer directly while serving it in a mode that expects reasoning blocks first.

**Loss on the completion, not the prompt.** Recall the objective from Part 0 — cross-entropy summed over token positions. If you sum over *all* positions, half your gradient budget teaches the model to reproduce your own prompts. SFT frameworks therefore **mask the prompt tokens** (multiply their loss by zero) and train only on assistant tokens:

$$\mathcal{L} = -\frac{1}{|C|}\sum_{i \in C} \log p_\theta(t_i \mid t_{<i}), \qquad C = \text{completion token positions}$$

`Train loss 0.313` in our v1 log means: averaged over assistant-response tokens, the model assigned the true next token probability $e^{-0.313} \approx 0.73$. That single interpretation makes every loss number in Part 5 readable.

## Why not just train everything? Memory arithmetic

Full finetuning updates all parameters. Count the bytes for our 1.72B-parameter model with the standard AdamW optimizer in bf16:

| Component | Bytes/param | For 1.72B |
|---|---|---|
| Weights | 2 | 3.4 GB |
| Gradients | 2 | 3.4 GB |
| AdamW first moment (m) | 4 | 6.9 GB |
| AdamW second moment (v) | 4 | 6.9 GB |
| **Subtotal, before activations** | **12** | **20.6 GB** |

Plus activations (grows with batch × sequence length), plus the OS. On a 32GB machine, full finetuning of 1.7B fits *barely* with tricks; 7B does not fit at all. The pattern to internalize: **optimizer state, not weights, dominates training memory** — those Adam moments are two full float32 copies of everything you train.

Which suggests the escape: train fewer parameters.

## The low-rank idea

A finetune changes the weights from $W$ to $W + \Delta W$. The **LoRA hypothesis** (Hu et al., 2021): for adaptation tasks, $\Delta W$ has low *intrinsic rank* — the update, a huge matrix on paper, mostly acts in a tiny subspace. Part 0 explains why that's plausible for behavior shaping: you're redistributing probability mass along a few consistent directions ("be Socratic," "emit this JSON shape"), not re-learning language.

So instead of learning $\Delta W \in \mathbb{R}^{d \times k}$ directly, parameterize it as a product of two thin matrices:

$$W' = W + \frac{\alpha}{r}\, B A, \qquad B \in \mathbb{R}^{d \times r},\; A \in \mathbb{R}^{r \times k},\; r \ll \min(d,k)$$

- $W$ stays **frozen** — no gradients, no optimizer state. Only $A$ and $B$ train.
- Parameters per adapted matrix: $r(d + k)$ instead of $d \times k$. For a 2048×2048 attention projection at $r=8$: **32,768 instead of 4.2 million** — 0.8%.
- $A$ starts random, $B$ starts **zero**, so $BA = 0$ and training begins exactly at the base model — the finetune starts from "no change" and learns only deviations.
- $\alpha/r$ is a scale factor decoupling the update's magnitude from the rank, so learning rates transfer when you change $r$.

Now decode our actual v1 log line — `Trainable parameters: 0.289% (4.981M/1720.575M)` — from the config (`--num-layers 16`, mlx-lm defaults: $r=8$, adapting the attention projections q and v):

- q_proj is 2048×2048 → $8(2048{+}2048) = 32{,}768$ params. v_proj is 2048×1024 (grouped-query attention has fewer KV heads) → $8(2048{+}1024) = 24{,}576$.
- More projections and per-layer pieces participate depending on framework defaults; summed over the **16 adapted layers** (of the model's 28 — mlx-lm adapts the *last* N, closest to the output, where task behavior concentrates), the total lands at **4.98M trainable parameters**.
- Optimizer state for 4.98M params: ~40MB. Versus 13.8GB for full finetuning. *That* is why your laptop can do this. Check `adapter_config.json` in any adapter directory to see exactly what was adapted — and do this derivation once for your own run; it's the best config-literacy exercise there is.

The remaining memory in our run (peak 15.9GB) is mostly **activations**: every intermediate tensor from the forward pass, kept for the backward pass, scaling with batch size × sequence length × depth. The `--grad-checkpoint` flag trades them away — store only layer-boundary activations, *recompute* the rest during the backward pass. Roughly 30% more compute for a several-fold activation-memory reduction. That flag is the difference between batch-4×2048-tokens fitting comfortably and not fitting.

**QLoRA**, one sentence: same construction, but the frozen $W$ is stored 4-bit quantized (adapters stay bf16) — cutting that 3.4GB to ~1GB and enabling 7B+ training on consumer hardware, at a small quality cost. We didn't need it at 1.7B.

## The knobs, and how to think about them

**Rank $r$ (8–32 for behavior).** Capacity of the update subspace. Format/style/task adaptation — everything Part 0 called "cheap" — fits comfortably in low rank. If your task needs the model to absorb substantial new *content*, rank climbs and you should first re-read Part 0's warning about teaching knowledge by finetuning.

**Which layers.** Adapting the last 16 of 28 is a cost/benefit default: late layers shape output behavior; early layers encode general features you mostly want intact. (Also a memory choice — fewer adapted layers, fewer stored activations to differentiate through.)

**Learning rate (1e-5 to 1e-4 for LoRA).** LoRA tolerates higher rates than full finetuning since the base is frozen. Observed pattern from our runs, worth keeping: **small pure dataset → higher lr, few iterations** (v0: 2e-5, 600 iters, 1.8k examples); **large diverse mix → lower lr, more iterations** (v1: 1e-5, 7,000 iters, 27.8k examples). Diverse gradients partially conflict; a lower rate averages them instead of thrashing.

**Batch size × iterations = examples seen.** Do this arithmetic *every time* — it's embarrassing how often it's skipped. We initially proposed 3,000 iterations at batch 2 for the 27.8k mix: 6,000 examples, **0.22 epochs** — the model would never have seen 78% of the data. Corrected: batch 4 × ~7,000 ≈ one full epoch. For SFT, 1–3 epochs is the normal band; more invites memorization (Part 5 shows how to see it coming).

**Sequence length.** Must cover your longest (prompt + completion), or truncation eats completions from the tail — and the tail is where a math solution's final answer lives (Part 3's length filter exists because our log warned about exactly this: a 2,313-token record in a 2,048 budget).

## Beyond SFT: one pointer

SFT teaches *what a good response is*. It can't directly teach *this response is better than that one* — tone, judgment, degrees of helpfulness. That's preference tuning. **DPO** does it with pairs (chosen ≻ rejected) and a loss that raises the likelihood margin of chosen over rejected relative to the frozen SFT model — no reward model or RL machinery needed. For our tutor, mining "approved vs critiqued" response pairs from the content-review pipeline is the natural v2 — noted here so you know what the next tool in the box looks like, and skipped because SFT covered the seven-task spec.

## Exercise

1. From the Part 0 run: open `tutorial/hands_on/adapter/adapter_config.json`. Using $r(d+k)$ per adapted matrix (SmolLM2-135M: hidden 576, 30 layers — you adapted 8), predict total trainable parameters. Then re-run training and check the "Trainable parameters" line against your prediction.
2. Retrain Part 0 with `--learning-rate 1e-3` (10× too high). Watch the loss. Generate. Describe the failure.
3. Compute the full-finetune memory bill for a 7B model in bf16 + AdamW, and its LoRA bill at r=16 over half the layers. Which single component shrank the most?

*You should now be able to answer: why does training 0.3% of parameters change behavior so effectively — and where, byte by byte, does the memory go in each regime?*

---
*Next: Part 5 — Reading a training run: two real logs, one healthy and one that looked healthier than it was.*
