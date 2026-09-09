#!/usr/bin/env python3
"""
Symbolic re-scorer for solver evals.

The string-matching scorer in evalBaseModels.py under-counts correct answers
given in equivalent forms (e.g. (x^2/2)ln x vs x^2 ln(x)/2). This script
re-scores the SAVED generations in data/finetune/eval_generations/*.json using
sympy symbolic equivalence — no model runs needed.

Run: python scripts/finetune/rescoreSolver.py            # all saved generation files
     pip install sympy                                    # only dependency
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import sympy
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application, parse_expr, standard_transformations,
)

ROOT = Path(__file__).resolve().parents[2]
GEN_DIR = ROOT / "data" / "finetune" / "eval_generations"
TRANSFORMS = standard_transformations + (implicit_multiplication_application,)


def latex_to_plain(s: str) -> str:
    """Best-effort LaTeX → sympy-parsable text (targets calculus answers)."""
    s = s.strip().strip("$")
    s = re.sub(r"\\left|\\right|\\,|\\;|\\!|\\quad", "", s)
    for _ in range(4):  # nested fracs
        s = re.sub(r"\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}", r"((\1)/(\2))", s)
    s = re.sub(r"\\sqrt\[3\]\{([^{}]*)\}", r"((\1)**(1/3))", s)
    s = re.sub(r"\\sqrt\{([^{}]*)\}", r"sqrt(\1)", s)
    s = re.sub(r"\\(sin|cos|tan|sec|csc|cot|ln|log|exp|sinh|cosh|tanh)\b", r"\1", s)
    s = re.sub(r"\\(pi|infty)\b", lambda m: {"pi": "pi", "infty": "oo"}[m.group(1)], s)
    s = re.sub(r"\\cdot|\\times", "*", s)
    s = re.sub(r"\\text\{([^{}]*)\}", r"\1", s)
    s = re.sub(r"e\^", "E**", s)
    s = s.replace("^", "**").replace("{", "(").replace("}", ")")
    s = re.sub(r"\\[a-zA-Z]+", " ", s)  # drop any remaining commands
    s = re.sub(r"\s+", " ", s).strip()
    return s


def try_parse(s: str):
    s = latex_to_plain(s)
    s = re.sub(r"\+\s*C\b", "", s).strip()  # integration constant
    s = s.rstrip(".").strip()
    if not s:
        return None
    try:
        return parse_expr(s, transformations=TRANSFORMS)
    except Exception:
        return None


def symbolically_equal(a: str, b: str) -> bool:
    ea, eb = try_parse(a), try_parse(b)
    if ea is None or eb is None:
        return False
    try:
        return sympy.simplify(ea - eb) == 0
    except Exception:
        return False


def final_answer_of(output: str) -> str:
    out = re.sub(r"<think>.*?</think>", "", output, flags=re.DOTALL)
    m = re.search(r"final answer[:\s]*(.+?)(?:\n\n|\Z)", out, flags=re.IGNORECASE | re.DOTALL)
    return (m.group(1) if m else "\n".join(out.strip().splitlines()[-2:])).strip()


def main() -> None:
    print(f"{'file':<58}{'string':>8}{'symbolic':>10}{'total':>7}")
    for f in sorted(GEN_DIR.glob("*.json")):
        gens = json.loads(f.read_text())
        solver = [g for g in gens if g["task"] == "solver"]
        if not solver:
            continue
        string_pass = sum(1 for g in solver if g["ok"])
        sym_pass = 0
        upgraded = []
        for g in solver:
            ok = bool(g["ok"]) or symbolically_equal(final_answer_of(g["output"]), g["expected"])
            g["ok_symbolic"] = ok
            sym_pass += ok
            if ok and not g["ok"]:
                upgraded.append(g["expected"][:60])
        f.write_text(json.dumps(gens, indent=1))  # persist ok_symbolic
        print(f"{f.name[:57]:<58}{string_pass:>8}{sym_pass:>10}{len(solver):>7}")
        for u in upgraded:
            print(f"    upgraded (equivalent form): {u}")


if __name__ == "__main__":
    main()
