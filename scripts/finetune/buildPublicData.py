#!/usr/bin/env python3
"""
Public-dataset builder for CalcuLearn (Phase 1b).

Pulls license-compatible public data and converts it to the same chat format
as the native dataset:

  1. nvidia/OpenMathInstruct-2  — filtered to calculus problems, reformatted
     into the solver prompt used by evalBaseModels.py. Adds raw math ability.
     License: CC-BY-4.0 (Llama-3.1-generated; note Llama AUP in the release).
     MetaMathQA was deliberately EXCLUDED (GPT-synthesized → restrictive terms).
  2. HuggingFaceTB/smoltalk     — random general-instruction sample to prevent
     catastrophic forgetting. License: Apache 2.0.

Run ON YOUR MAC:
    pip install datasets
    python scripts/finetune/buildPublicData.py                    # defaults
    python scripts/finetune/buildPublicData.py --calculus 20000 --general 6000

Outputs: data/finetune/public/{openmath_calculus,general_smoltalk}.jsonl
"""

from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "finetune" / "public"

CALCULUS_PATTERNS = re.compile(
    r"(derivative|differentiat|antiderivative|integral|integrat|"
    r"\\lim|limit of|tangent line|rate of change|related rates|"
    r"concav|inflection|critical point|local (max|min)|extrem|"
    r"\\int\b|dy/dx|\bf'\(|riemann|fundamental theorem of calculus|"
    r"u-substitution|by parts|differential equation|separable)",
    re.IGNORECASE,
)

# OpenMathInstruct solutions are model-generated; drop hedgy/incomplete ones.
HEDGE_PATTERNS = re.compile(
    r"(if we (had|expanded|computed|solved)|we would then|i cannot|"
    r"cannot be determined|assuming .{0,40} is correct|left as an exercise)",
    re.IGNORECASE,
)

# Exclude topics beyond CalcuLearn's K-12 AP scope
EXCLUDE_PATTERNS = re.compile(
    r"(partial derivative|multiple integral|double integral|triple integral|"
    r"line integral|surface integral|divergence|\bcurl\b|laplace|fourier|"
    r"jacobian|gradient vector|\\iint|\\iiint)",
    re.IGNORECASE,
)

SOLVER_PROMPT = (
    "Solve this calculus problem. Show brief reasoning, then end with a line "
    "formatted exactly as 'Final answer: <answer>'.\n\nProblem: {problem}"
)


def is_calculus(text: str) -> bool:
    return bool(CALCULUS_PATTERNS.search(text)) and not EXCLUDE_PATTERNS.search(text)


def build_openmath(target: int, rng: random.Random) -> list[dict]:
    from datasets import load_dataset

    print("Streaming nvidia/OpenMathInstruct-2 (filtering to calculus)…")
    ds = load_dataset("nvidia/OpenMathInstruct-2", split="train", streaming=True)
    records: list[dict] = []
    scanned = 0
    for row in ds:
        scanned += 1
        problem = row.get("problem", "")
        solution = row.get("generated_solution", "")
        answer = str(row.get("expected_answer", "")).strip()
        if not problem or not solution or not answer:
            continue
        if not is_calculus(problem):
            continue
        if HEDGE_PATTERNS.search(solution):
            continue
        # normalize the solution ending to our runtime convention
        sol = re.sub(r"\\boxed\{([^}]*)\}", r"\1", solution).strip()
        if "final answer" not in sol.lower():
            sol = f"{sol}\nFinal answer: {answer}"
        records.append(
            {
                "messages": [
                    {"role": "user", "content": SOLVER_PROMPT.format(problem=problem)},
                    {"role": "assistant", "content": sol},
                ]
            }
        )
        if len(records) >= target * 3:  # oversample, then downsample for variety
            break
        if scanned % 200_000 == 0:
            print(f"  scanned {scanned:,}, kept {len(records):,}")
    rng.shuffle(records)
    print(f"OpenMathInstruct-2: kept {min(len(records), target):,} of {len(records):,} calculus matches")
    return records[:target]


def build_smoltalk(target: int, rng: random.Random) -> list[dict]:
    from datasets import load_dataset

    print("Streaming HuggingFaceTB/smoltalk (general instruction sample)…")
    ds = load_dataset("HuggingFaceTB/smoltalk", "all", split="train", streaming=True)
    records: list[dict] = []
    for row in ds:
        msgs = row.get("messages", [])
        # single-turn only, to match our data shape
        if len(msgs) == 2 and msgs[0].get("role") == "user" and msgs[1].get("role") == "assistant":
            if len(msgs[1]["content"]) < 2000:  # keep responses short-ish (edge tutor persona)
                records.append({"messages": msgs})
        if len(records) >= target * 2:
            break
    rng.shuffle(records)
    print(f"smoltalk: kept {min(len(records), target):,}")
    return records[:target]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calculus", type=int, default=20000)
    ap.add_argument("--general", type=int, default=6000)
    ap.add_argument("--seed", type=int, default=20260707)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    OUT.mkdir(parents=True, exist_ok=True)

    openmath = build_openmath(args.calculus, rng)
    (OUT / "openmath_calculus.jsonl").write_text("".join(json.dumps(r) + "\n" for r in openmath))

    general = build_smoltalk(args.general, rng)
    (OUT / "general_smoltalk.jsonl").write_text("".join(json.dumps(r) + "\n" for r in general))

    print(f"\nWrote {len(openmath):,} calculus + {len(general):,} general records to {OUT}")
    print("Next: python scripts/finetune/mixDataset.py")


if __name__ == "__main__":
    main()
