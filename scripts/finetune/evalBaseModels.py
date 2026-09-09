#!/usr/bin/env python3
"""
Base-model bake-off for CalcuLearn (Phase 2 of FINETUNING_PLAN.md).

Runs candidate small models over the held-out eval set produced by
scripts/finetune/exportDataset.ts and scores each on:

  1. solver accuracy   — held-out calculus problems (test_problems.json),
                         final-answer match. The core "math prior" signal.
  2. classifier acc.   — exact-label tasks from test.jsonl (runtime
                         responseClassifier.ts format)
  3. semantic-eval     — JSON parse rate + isCorrect agreement
  4. variant JSON      — parse rate + required-field presence
  5. freeform          — ≤150-word compliance for hint/feedback/intro/worked-example
  6. speed             — generation tokens/sec, model load time

Run ON YOUR MAC (requires Apple Silicon + mlx):
    pip install mlx-lm
    python scripts/finetune/evalBaseModels.py               # all 4 candidates
    python scripts/finetune/evalBaseModels.py --limit 30    # quick pass
    python scripts/finetune/evalBaseModels.py --models mlx-community/Qwen3-1.7B-8bit

Outputs:
    data/finetune/eval_report.md          — comparison table + verdict helper
    data/finetune/eval_generations/*.json — raw generations for manual review
"""

from __future__ import annotations

import argparse
import json
import re
import time
import traceback
from pathlib import Path


def check_environment() -> None:
    """mlx-lm is incompatible with transformers >= 5.13 (crashes in load() with
    \"'str' object has no attribute '__module__'\"). Fail fast with the fix."""
    try:
        import transformers

        major, minor = (int(x) for x in transformers.__version__.split(".")[:2])
        if (major, minor) >= (5, 13):
            raise SystemExit(
                f"transformers {transformers.__version__} is incompatible with mlx-lm.\n"
                'Fix:  pip install "transformers>=5.7,<5.13"\n'
                "Then re-run this script."
            )
    except ImportError:
        raise SystemExit("Missing deps. Run: pip install mlx-lm 'transformers>=5.7,<5.13'")

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "finetune"
GEN_DIR = DATA / "eval_generations"

# All verified to exist on Hugging Face (July 2026). 8-bit where available so
# quantization noise is comparable; SmolLM2 mlx repo is bf16 only.
DEFAULT_MODELS = [
    "mlx-community/Qwen3-1.7B-8bit",
    "mlx-community/Qwen2.5-Math-1.5B-Instruct-8bit",
    "mlx-community/SmolLM2-1.7B-Instruct",
    "mlx-community/gemma-3-1b-it-qat-8bit",
]

MAX_TOKENS = {"classifier": 16, "semantic-eval": 250, "problem-variant": 2000, "solver": 600, "freeform": 260}
FREEFORM_TASKS = {"hint", "feedback", "intro", "worked-example"}


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks (Qwen3) before scoring."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def clean_label(out: str) -> str:
    """Mirror responseClassifier.ts post-processing."""
    return re.sub(r"[^a-z0-9_:]", "", out.lower())


def label_matches(cleaned: str, expected: str) -> bool:
    if expected == "correct":
        return cleaned.startswith("correct")
    if expected == "partial_correct":
        return cleaned.startswith("partial")
    if expected == "off_topic":
        return cleaned.startswith("off")
    m = re.match(r"misconception:(\d+)", expected)
    if m:
        got = re.search(r"misconception:?(\d+)", cleaned)
        return bool(got and got.group(1) == m.group(1))
    return cleaned == expected


def extract_json(out: str) -> dict | None:
    """Mirror dialogueGenerator.ts extractJson + parse."""
    start, end = out.find("{"), out.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(out[start : end + 1])
    except json.JSONDecodeError:
        return None


def normalize_answer(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"\\left|\\right|\\,|\\;|\\!|\\digits", "", s)
    s = re.sub(r"\\(d?frac)\{([^}]*)\}\{([^}]*)\}", r"(\2)/(\3)", s)
    s = re.sub(r"\\text\{([^}]*)\}", r"\1", s)
    s = s.replace("\\cdot", "*").replace("\\times", "*").replace("^{", "^(").replace("}", ")")
    s = re.sub(r"[\s${}]", "", s)
    s = s.rstrip(".")
    return s


def solver_correct(output: str, answer_raw: str, answer_latex: str) -> bool:
    """Look for the expected answer in the model's final-answer line (loose match)."""
    out = strip_thinking(output)
    m = re.search(r"final answer[:\s]*(.+)", out, flags=re.IGNORECASE | re.DOTALL)
    tail = m.group(1).strip() if m else "\n".join(out.strip().splitlines()[-3:])
    tail_n = normalize_answer(tail)
    for cand in (answer_raw, answer_latex):
        c = normalize_answer(cand)
        if c and c in tail_n:
            return True
    # numeric comparison
    try:
        expected = float(eval(normalize_answer(answer_raw), {"__builtins__": {}}))  # noqa: S307 — trusted data
        nums = re.findall(r"-?\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?", tail_n)
        for n in nums:
            val = float(eval(n, {"__builtins__": {}}))  # noqa: S307
            if abs(val - expected) < 1e-6:
                return True
    except Exception:
        pass
    return False


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def build_generator(model_id: str, adapter_path: str | None = None):
    from mlx_lm import generate, load

    t0 = time.time()
    model, tokenizer = load(model_id, adapter_path=adapter_path)
    load_s = time.time() - t0

    def run(prompt_text: str, max_tokens: int) -> tuple[str, float, int]:
        messages = [{"role": "user", "content": prompt_text}]
        try:  # Qwen3: disable thinking mode for latency parity
            templated = tokenizer.apply_chat_template(
                messages, add_generation_prompt=True, tokenize=False, enable_thinking=False
            )
        except TypeError:
            templated = tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
        t = time.time()
        out = generate(model, tokenizer, prompt=templated, max_tokens=max_tokens, verbose=False)
        dt = time.time() - t
        n_tokens = len(tokenizer.encode(out))
        return out, dt, n_tokens

    return run, load_s


# ---------------------------------------------------------------------------
# Evaluation loop
# ---------------------------------------------------------------------------

def evaluate_model(
    model_id: str, test_records: list[dict], problems: list[dict], limit: int | None,
    adapter_path: str | None = None,
) -> dict:
    label = f"{model_id} + {adapter_path}" if adapter_path else model_id
    print(f"\n=== {label} ===")
    run, load_s = build_generator(model_id, adapter_path)
    gens: list[dict] = []
    stats = {
        "model": label, "load_s": round(load_s, 1),
        "solver": [0, 0], "classifier": [0, 0],
        "semantic_parse": [0, 0], "semantic_agree": [0, 0],
        "variant_parse": [0, 0], "freeform_cap": [0, 0],
        "gen_tokens": 0, "gen_seconds": 0.0,
    }

    def record(task, prompt, expected, output, ok, dt, n_tok):
        stats["gen_tokens"] += n_tok
        stats["gen_seconds"] += dt
        gens.append({"task": task, "ok": ok, "expected": expected, "output": output, "prompt": prompt[:500]})

    # 1. Solver accuracy on held-out problems.
    # Only numeric/symbolic answers are auto-scored — text-type answers
    # (conceptual / proof-sketch prose) can't be string-matched reliably and
    # are saved to eval_generations/ for manual review instead.
    n_text = 0
    for pr in problems[:limit]:
        prompt = (
            "Solve this calculus problem. Show brief reasoning, then end with a line "
            f"formatted exactly as 'Final answer: <answer>'.\n\nProblem: {pr['stem']}"
        )
        out, dt, n = run(prompt, MAX_TOKENS["solver"])
        # prose-like "symbolic" answers (proof sketches) can't be string-matched either
        if pr.get("answerType") == "text" or len(pr["answerRaw"].split()) > 6:
            n_text += 1
            record("solver-manual-review", prompt, pr["answerRaw"], out, None, dt, n)
            print(f"  solver: manual-review (text answer) ({pr['id']})")
            continue
        ok = solver_correct(out, pr["answerRaw"], pr["answerLatex"])
        stats["solver"][0] += ok
        stats["solver"][1] += 1
        record("solver", prompt, pr["answerRaw"], out, ok, dt, n)
        print(f"  solver {stats['solver'][1]}: {'PASS' if ok else 'fail'} ({pr['id']})")
    if n_text:
        print(f"  ({n_text} text-answer problems saved for manual review, not auto-scored)")

    # 2–5. Runtime-format tasks from test.jsonl
    by_task: dict[str, list[dict]] = {}
    for r in test_records:
        by_task.setdefault(r["task"], []).append(r)

    for task, recs in by_task.items():
        for r in recs[:limit]:
            prompt = r["messages"][0]["content"]
            expected = r["messages"][1]["content"]
            if task == "classifier":
                out, dt, n = run(prompt, MAX_TOKENS["classifier"])
                ok = label_matches(clean_label(strip_thinking(out)), expected)
                stats["classifier"][0] += ok
                stats["classifier"][1] += 1
            elif task == "semantic-eval":
                out, dt, n = run(prompt, MAX_TOKENS["semantic-eval"])
                parsed = extract_json(strip_thinking(out))
                stats["semantic_parse"][0] += parsed is not None
                stats["semantic_parse"][1] += 1
                ok = parsed is not None
                if parsed is not None:
                    agree = parsed.get("isCorrect") == json.loads(expected)["isCorrect"]
                    stats["semantic_agree"][0] += agree
                    stats["semantic_agree"][1] += 1
                    ok = agree
            elif task == "problem-variant":
                out, dt, n = run(prompt, MAX_TOKENS["problem-variant"])
                parsed = extract_json(strip_thinking(out))
                required = {"stem", "answer", "solutionSteps"}
                ok = parsed is not None and required.issubset(parsed.keys())
                stats["variant_parse"][0] += ok
                stats["variant_parse"][1] += 1
            elif task in FREEFORM_TASKS:
                out, dt, n = run(prompt, MAX_TOKENS["freeform"])
                ok = 0 < len(strip_thinking(out).split()) <= 160  # small tolerance
                stats["freeform_cap"][0] += ok
                stats["freeform_cap"][1] += 1
            else:
                continue
            record(task, prompt, expected, out, ok, dt, n)
        done = by_task[task][:limit]
        print(f"  {task}: {len(done)} records done")

    GEN_DIR.mkdir(parents=True, exist_ok=True)
    safe = label.replace("/", "__").replace(" ", "")
    (GEN_DIR / f"{safe}.json").write_text(json.dumps(gens, indent=1))
    return stats


def pct(pair: list[int]) -> str:
    return f"{100 * pair[0] / pair[1]:.0f}% ({pair[0]}/{pair[1]})" if pair[1] else "—"


def write_report(all_stats: list[dict]) -> None:
    lines = [
        "# Base model bake-off — CalcuLearn calculus eval",
        "",
        f"Generated {time.strftime('%Y-%m-%d %H:%M')}. Held-out concepts: deriv.quotient-rule, integ.by-parts.",
        "",
        "| Model | Solver acc | Classifier acc | Sem-eval JSON | Sem-eval agree | Variant JSON | ≤150w | tok/s | Load (s) |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for s in all_stats:
        toks = f"{s['gen_tokens'] / s['gen_seconds']:.0f}" if s["gen_seconds"] else "—"
        lines.append(
            f"| {s['model']} | {pct(s['solver'])} | {pct(s['classifier'])} | {pct(s['semantic_parse'])} "
            f"| {pct(s['semantic_agree'])} | {pct(s['variant_parse'])} | {pct(s['freeform_cap'])} | {toks} | {s['load_s']} |"
        )
    lines += [
        "",
        "**How to pick:** weight Solver acc (math prior) and Sem-eval agree (calculus judgment) highest — ",
        "finetuning will fix format compliance (classifier/JSON/word-cap) but not missing math ability. ",
        "Break ties on tok/s (edge latency). Review raw generations in `eval_generations/` before deciding.",
        "",
    ]
    (DATA / "eval_report.md").write_text("\n".join(lines))
    print("\n" + "\n".join(lines))


def main() -> None:
    check_environment()
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="*", default=DEFAULT_MODELS)
    ap.add_argument("--limit", type=int, default=None, help="max records per task (quick pass)")
    ap.add_argument(
        "--solver-file", default="test_problems.json",
        help="all_problems.json = full 99-problem bank (higher signal; only valid BEFORE training)",
    )
    ap.add_argument("--skip-format-tasks", action="store_true", help="solver eval only")
    ap.add_argument("--adapter-path", default=None, help="LoRA adapter dir (score a finetuned model)")
    args = ap.parse_args()

    test_records = [] if args.skip_format_tasks else [
        json.loads(l) for l in (DATA / "test.jsonl").read_text().strip().splitlines()
    ]
    problems = json.loads((DATA / args.solver_file).read_text())
    print(f"Eval set: {len(problems)} solver problems, {len(test_records)} runtime-format records")

    all_stats = []
    for model_id in args.models:
        try:
            all_stats.append(evaluate_model(model_id, test_records, problems, args.limit, args.adapter_path))
        except Exception as e:  # keep going if one model fails to download/load
            print(f"  SKIPPED {model_id}: {e}")
            traceback.print_exc()
    if all_stats:
        write_report(all_stats)


if __name__ == "__main__":
    main()
