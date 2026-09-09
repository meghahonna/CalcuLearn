# Finetuning Small Language Models — A Complete Worked Example

A 9-part technical tutorial built entirely on a real project: finetuning Qwen3-1.7B
into an offline Socratic calculus tutor that runs on a Raspberry Pi. Every number,
log excerpt, bug, and fix in the series actually happened in this repository.
Everything runs on one Apple Silicon Mac.

| Part | Title | You learn |
|---|---|---|
| 0 | [What finetuning actually is](part0-what-finetuning-is.md) | Next-token objective, behavior vs knowledge, when NOT to finetune — plus a 5-minute hands-on finetune |
| 1 | [Why small models](part1-why-small-models.md) | Memory-bandwidth law, the specialization hypothesis, guard-railed architecture, real cost accounting |
| 2 | [Choosing a base model](part2-choosing-a-base-model.md) | Domain evals over benchmarks, the 7-vs-63-problem sample-size trap, capability > compliance, licensing |
| 3 | [The dataset](part3-the-dataset.md) | Format fidelity, mining existing content, gated synthetic data, two real contamination bugs, the mix recipe |
| 4 | [LoRA: the math](part4-lora-the-math.md) | Chat templates & loss masking, memory arithmetic, W′ = W + (α/r)BA, every training flag explained |
| 5 | [Reading a training run](part5-reading-a-training-run.md) | Two annotated real logs, why higher val loss was good news, operational hygiene |
| 6 | [Evaluation](part6-evaluation.md) | The scorer-bug case study (3/7 → 5/7), failure analysis as data design, the eight rules |
| 7 | [Quantization & deployment](part7-quantization-and-deployment.md) | Blockwise quantization, adapter → GGUF → Q4_K_M, KV-cache budgeting, integrity hashing |
| 8 | [The loop](part8-the-loop.md) | The eval→data→train loop, the honest bill, the reproduce-it checklist, open problems |

**Start here:** Part 0 ends with you training a model in ~5 minutes
(`python tutorial/hands_on/gen_tiny_dataset.py`, then two commands).

**Prerequisites:** Python, comfort with logarithms and matrices, an Apple Silicon
Mac (any RAM), `pip install mlx-lm`.
