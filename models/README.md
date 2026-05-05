# Model Files

This directory holds the GGUF model files CalcuLearn loads on-device. The
files themselves are **not** in the repository — drop them here manually.

## Required filenames

`bootstrap.ts` and `main.ts` expect these exact names (don't rename):

| File | Purpose | When loaded |
|---|---|---|
| `gemma4-e4b-Q4_K_M.gguf` | Gemma 4 dialogue model, 4-bit | Picked when system RAM < 8 GB |
| `gemma4-e4b-Q8.gguf` | Gemma 4 dialogue model, 8-bit | Picked when system RAM ≥ 8 GB |
| `nllb-200.gguf` | NLLB-200 translation, 200 languages | Lazy-loaded on first non-English session |

You only need the Gemma quantisation that matches your hardware — but having
both lets the same `models/` directory work across machines. Override the
NLLB filename with `NLLB_FILE` if you ship a different distillation.

## Where to get them

- **Gemma 4** — convert from the official weights using `llama.cpp`'s
  conversion tooling, or fetch a community-quantised GGUF.
- **NLLB-200** — start from `facebook/nllb-200-distilled-600M` and run a GGUF
  conversion, or fetch a pre-built one.

CalcuLearn never downloads models at runtime. The only place that touches the
network is the opt-in `SyncService`.

## SHA-256 verification

Every load is gated on a SHA-256 hash check (`security/modelVerifier.ts`).
A mismatch throws `ModelTamperingError` and aborts startup.

Register your hashes the first time:

```bash
npm run hash > .env   # writes GEMMA_Q4_SHA256, GEMMA_Q8_SHA256, NLLB_SHA256
source .env
npm start
```

## Notes

- The application refuses to start without the required model files in place
  (or with corrupted hashes).
- See the project `README.md` for full setup, configuration, and
  troubleshooting.
