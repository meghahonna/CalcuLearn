#!/usr/bin/env bash
# CalcuLearn v0 LoRA training run — Qwen3-1.7B (Phase 3 pipeline validation).
#
# Purpose: validate the full train → eval → fuse → GGUF pipeline on the 1.1k
# native records. Expect format compliance (classifier/JSON/word-cap) to jump;
# solver accuracy moves later, with the 30-50k augmented dataset.
#
# Time: roughly 20-40 min on an M5 / 32GB. Memory: ~10-14 GB.
#
# Usage:  bash scripts/finetune/train_v0.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

MODEL="mlx-community/Qwen3-1.7B-bf16"   # bf16 base for training quality; quantize after fuse
ADAPTER="adapters/calculearn-v0"

# 1. Train
mlx_lm.lora \
  --model "$MODEL" \
  --train \
  --data data/finetune \
  --fine-tune-type lora \
  --num-layers 16 \
  --batch-size 2 \
  --iters 600 \
  --learning-rate 2e-5 \
  --max-seq-length 2048 \
  --grad-checkpoint \
  --steps-per-eval 50 \
  --save-every 100 \
  --adapter-path "$ADAPTER"

# 2. Score with the same harness used for the bake-off (before/after comparison)
python scripts/finetune/evalBaseModels.py \
  --models "$MODEL" \
  --adapter-path "$ADAPTER"

echo ""
echo "Next steps once results look good:"
echo "  # Fuse adapter into standalone weights"
echo "  mlx_lm.fuse --model $MODEL --adapter-path $ADAPTER --save-path fused/calculearn-v0"
echo "  # Convert to GGUF for node-llama-cpp (clone llama.cpp first)"
echo "  python llama.cpp/convert_hf_to_gguf.py fused/calculearn-v0 --outfile models/calculearn-v0-f16.gguf"
echo "  llama.cpp/build/bin/llama-quantize models/calculearn-v0-f16.gguf models/calculearn-v0-Q4_K_M.gguf Q4_K_M"
echo "  # Register with CalcuLearn's tamper check"
echo "  npm run hash > .env"
