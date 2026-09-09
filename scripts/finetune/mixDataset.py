#!/usr/bin/env python3
"""
Final dataset mixer for CalcuLearn (Phase 1b).

Combines all sources into the training mix, deduplicates, shuffles, and writes
data/finetune/mixed/{train,valid}.jsonl for mlx_lm.lora --data data/finetune/mixed.

Sources and default ratios (~35k total):
  - native (data/finetune/train.jsonl)         x2 upweight   (~2.2k)  exact runtime formats
  - synthetic (data/finetune/synthetic/*.jsonl) all           (~3-8k)  runtime formats, Claude-generated
  - openmath  (public/openmath_calculus.jsonl)  cap 20k                raw math ability
  - general   (public/general_smoltalk.jsonl)   cap 15% of total       forgetting guard

The held-out test set (test.jsonl / test_problems.json) is NOT touched.

Run: python scripts/finetune/mixDataset.py [--openmath-cap 20000] [--general-frac 0.15]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "finetune"
MIXED = DATA / "mixed"


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text().strip().splitlines() if l.strip()]


def dedup_key(rec: dict) -> str:
    return hashlib.sha256(json.dumps(rec["messages"], sort_keys=True).encode()).hexdigest()


MAX_CHARS = 7200  # ~2048 tokens at ~3.5 chars/token; over-length records get truncated by mlx_lm


def within_length(rec: dict) -> bool:
    return sum(len(m["content"]) for m in rec["messages"]) <= MAX_CHARS


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--openmath-cap", type=int, default=20000)
    ap.add_argument("--general-frac", type=float, default=0.15)
    ap.add_argument("--native-upweight", type=int, default=2)
    ap.add_argument("--valid-frac", type=float, default=0.02)
    ap.add_argument("--seed", type=int, default=20260707)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    native = read_jsonl(DATA / "train.jsonl")
    synthetic = [r for f in sorted((DATA / "synthetic").glob("*.jsonl")) for r in read_jsonl(f)]
    openmath = read_jsonl(DATA / "public" / "openmath_calculus.jsonl")[: args.openmath_cap]
    general_pool = read_jsonl(DATA / "public" / "general_smoltalk.jsonl")

    if not native:
        raise SystemExit("Native train.jsonl missing — run: npx tsx scripts/finetune/exportDataset.ts")

    # Dedup calculus-domain sources against each other (keep native first)
    seen: set[str] = set()
    core: list[dict] = []
    counts = {"native": 0, "synthetic": 0, "openmath": 0}
    dropped_long = 0
    for name, source in (("native", native), ("synthetic", synthetic), ("openmath", openmath)):
        for rec in source:
            if not within_length(rec):
                dropped_long += 1
                continue
            k = dedup_key(rec)
            if k in seen:
                continue
            seen.add(k)
            core.append(rec)
            counts[name] += 1
    # Upweight native records (duplicated intentionally, after dedup)
    core += native * (args.native_upweight - 1)

    general_pool = [r for r in general_pool if within_length(r)]
    n_general = min(len(general_pool), int(len(core) * args.general_frac / (1 - args.general_frac)))
    mix = core + general_pool[:n_general]
    if dropped_long:
        print(f"  (dropped {dropped_long} over-length records >{MAX_CHARS} chars)")
    rng.shuffle(mix)

    n_valid = max(50, int(len(mix) * args.valid_frac))
    valid, train = mix[:n_valid], mix[n_valid:]

    MIXED.mkdir(parents=True, exist_ok=True)
    (MIXED / "train.jsonl").write_text("".join(json.dumps(r) + "\n" for r in train))
    (MIXED / "valid.jsonl").write_text("".join(json.dumps(r) + "\n" for r in valid))

    total = len(train) + len(valid)
    print(f"Mixed dataset: {total:,} records → {MIXED}")
    print(f"  native:    {counts['native']:,} (x{args.native_upweight} = {counts['native'] * args.native_upweight:,})")
    print(f"  synthetic: {counts['synthetic']:,}")
    print(f"  openmath:  {counts['openmath']:,}")
    print(f"  general:   {n_general:,} ({100 * n_general / total:.0f}%)")
    print(f"  train/valid: {len(train):,} / {len(valid):,}")
    batch = 4
    one_epoch = total // batch
    print("\nTrain with (~1 epoch):")
    print("  mlx_lm.lora --model mlx-community/Qwen3-1.7B-bf16 --train \\")
    print("    --data data/finetune/mixed --fine-tune-type lora --num-layers 16 \\")
    print(f"    --batch-size {batch} --iters {one_epoch} --learning-rate 1e-5 --max-seq-length 2048 \\")
    print("    --grad-checkpoint --steps-per-eval 200 --save-every 500 --adapter-path adapters/calculearn-v1")


if __name__ == "__main__":
    main()
