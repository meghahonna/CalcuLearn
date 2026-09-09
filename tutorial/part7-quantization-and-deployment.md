# Part 7 — Quantization and edge deployment

*You have a trained adapter and an eval that says it's good. This part turns it into a ~1.1GB file that runs behind an integrity check on a $80 computer — and explains the arithmetic of what quantization destroys and why it usually doesn't matter.*

## What quantization actually does

Trained weights are 16-bit floats (bf16): 2 bytes each, ~65,000 representable values. Quantization stores them in fewer bits by exploiting a statistical fact: within a small neighborhood of a weight matrix, values are tightly clustered around zero — you don't need 65,000 levels to represent 32 numbers that all live in, say, [−0.08, 0.11].

Blockwise quantization (the GGUF "k-quant" family used by llama.cpp):

1. Split each weight tensor into **blocks** (typically 32 weights).
2. Per block, store a **scale** (and possibly a minimum) in higher precision.
3. Store each weight as a small integer — 4 bits gives 16 levels — reconstructed at inference as $w \approx \text{scale} \times q + \text{min}$.

The quantization error per weight is roughly uniform noise of magnitude (block range / number of levels) ÷ 2. Two things keep this benign: neural networks are trained with noise (dropout, data noise) and are robust to small perturbations; and schemes like **Q4_K_M** spend *more* bits on the layers measured to be most sensitive (embeddings, some attention projections), averaging ~4.8 bits/weight rather than a flat 4.

The bookkeeping for our 1.72B model:

| Format | Bits/weight (effective) | File size | Pi 5 feasible? |
|---|---|---|---|
| bf16 (training output) | 16 | 3.4 GB | no — RAM-hostile |
| Q8_0 | ~8.5 | ~1.8 GB | yes, slower |
| **Q4_K_M** | **~4.8** | **~1.1 GB** | **yes — the target** |

And recall Part 1's law — inference is memory-bandwidth-bound, so **Q4 is ~2× faster than Q8, ~3.3× faster than bf16**, on top of being smaller. On edge devices you quantize for speed as much as size.

What's the quality cost? For 4-bit k-quants on a well-trained model: small but **not** assumed to be zero. Which is why the pipeline below ends by re-running Part 6's eval on the *quantized artifact* — the thing you ship is the thing you test. (Our v0 dress-rehearsal ran the full loop precisely so that no step — including this one — would be exercised for the first time on the model that mattered.)

## The pipeline: adapter → deployable artifact

Five mechanical steps, each with one thing worth knowing:

```bash
# 1. FUSE — merge the LoRA update into the base weights: W' = W + (α/r)BA
mlx_lm.fuse --model mlx-community/Qwen3-1.7B-bf16 \
  --adapter-path adapters/calculearn-v1-final --save-path fused/calculearn-v1
```
After fusing, the adapter is gone as a separate object — you have an ordinary model. (Deployment alternative: runtimes can also load base + adapter separately, useful if you ship many adapters over one base. For a single-model edge app, fusing is simpler and marginally faster.)

```bash
# 2. CONVERT — HF safetensors → GGUF (llama.cpp's format: weights + tokenizer
#    + chat template + metadata in ONE file; the whole deployment is one artifact)
python llama.cpp/convert_hf_to_gguf.py fused/calculearn-v1 \
  --outfile models/calculearn-v1-f16.gguf

# 3. QUANTIZE — the k-quant pass described above
llama.cpp/build/bin/llama-quantize \
  models/calculearn-v1-f16.gguf models/calculearn-v1-Q4_K_M.gguf Q4_K_M
```

```bash
# 4. VERIFY — re-run the SAME eval harness against the quantized file.
#    Compare to the bf16 adapter's scores. A drop of a point on a large slice
#    is quantization noise; a collapse means a conversion bug, not "quantization".
```

```bash
# 5. INTEGRITY — hash the artifact; the app verifies at startup
shasum -a 256 models/calculearn-v1-Q4_K_M.gguf   # → pinned in app config
```

Step 5 deserves its sentence of respect: an edge model file lives on hardware you don't control, can be corrupted by a bad SD card or swapped by a curious user, and a *subtly* damaged model misbehaves instead of crashing. A SHA-256 check at startup converts "weird tutoring behavior a student reports three weeks later" into "clean error at boot." Cheap insurance; our app refuses to load an unhashed model.

## Runtime memory: the KV cache, the forgotten tenant

The weights file is not the whole RAM story. During generation the runtime caches attention keys and values for every processed token:

$$\text{KV bytes} \approx 2 \times L \times n_{kv} \times d_{head} \times \text{bytes} \times T$$

For our model (28 layers, 8 KV heads × head-dim 128, fp16) that's ~115KB per token — a 4,096-token context costs ~470MB *on top of* the 1.1GB weights. On an 8GB Pi that all fits; on a 4GB device the context length, not the weights, becomes the binding constraint (options: shorter context, KV-cache quantization). Budget it explicitly: **weights + KV cache + runtime + your app + OS ≤ device RAM**, with margin.

Latency on the target, sanity-checked against Part 1's law: ~17GB/s ÷ 1.1GB ≈ 15 tok/s ceiling, ~8–12 realistic. For 150-word tutor responses (~200 tokens): 20–25 seconds worst case — acceptable for this product only with streaming UX (tokens appear as generated) and pre-authored fallbacks behind a timeout. Latency numbers are product decisions; compute them before committing to hardware.

## The swap, and the operational tail

Because Part 3's dataset byte-matched the serving prompts, deployment into the application is genuinely anticlimactic: place the GGUF at the model path, update the pinned hash, restart. No prompt changes, no parser changes, no code. That anticlimax was purchased months earlier, in the exporter.

The tail that distinguishes deployed from demoed:

- **Version artifacts immutably** (`calculearn-v1-Q4_K_M.gguf`, hash pinned per app release) — Part 5's overwrite incident, applied to serving.
- **Field telemetry, privacy permitting:** timeout rate, JSON-parse failure rate, fallback activation rate. These are the deployed model's val loss — they trend before users complain. (An offline-first education app collects them locally and opt-in.)
- **A final live check no eval replaces:** run the actual product experience end-to-end on the actual device. Evals measure the seven tasks; only a session tells you the tutor *feels* right — pacing, tone, streaming behavior. Ten minutes, before every release.

## Exercise

1. Quantize your Part 0 model to 4-bit (`mlx_lm.convert --hf-path mlx-community/SmolLM2-135M-Instruct -q --q-bits 4`), re-run your Part 6 format-compliance checker on it, and compare against bf16. Any drift at 135M? (Small models are *more* fragile under quantization — worth seeing.)
2. Compute the KV-cache cost per token for SmolLM2-135M (30 layers, 3 KV heads, head-dim 64, fp16) and the total for a 2,048-token context. What fraction of the weights' size is that?
3. Pick a real device you own (old laptop, phone, Pi). Using Part 1's bandwidth law and this part's RAM budget, write the one-paragraph feasibility verdict for running your quantized model on it.

*You should now be able to answer: why is Q4 both smaller AND faster — and what besides the weights file claims memory at inference time?*

---
*Next (final): Part 8 — The loop, the costs, and the reproduce-it-yourself checklist.*
