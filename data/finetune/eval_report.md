# Base model bake-off — CalcuLearn calculus eval

Generated 2026-07-08 17:37. Held-out concepts: deriv.quotient-rule, integ.by-parts.

| Model | Solver acc | Classifier acc | Sem-eval JSON | Sem-eval agree | Variant JSON | ≤150w | tok/s | Load (s) |
|---|---|---|---|---|---|---|---|---|
| mlx-community/Qwen3-1.7B-bf16 + adapters/calculearn-v1 | 43% (3/7) | 52% (49/94) | 100% (20/20) | 100% (20/20) | 50% (2/4) | 98% (57/58) | 28 | 1.0 |

**How to pick:** weight Solver acc (math prior) and Sem-eval agree (calculus judgment) highest — 
finetuning will fix format compliance (classifier/JSON/word-cap) but not missing math ability. 
Break ties on tok/s (edge latency). Review raw generations in `eval_generations/` before deciding.
