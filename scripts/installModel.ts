/**
 * Interactive model installer for CalcuLearn.
 *
 * Lists curated GGUF chat models on Hugging Face that work as the Dialogue
 * Generator backend, downloads the user's choice with streaming + progress,
 * computes its SHA-256 hash on the fly, places it under the canonical
 * filename in ./models/, and upserts the matching env var in ./.env.
 *
 * The CalcuLearn runtime never makes network calls — this is a one-time
 * setup helper. After running it, `npm start` is fully offline.
 *
 * Usage:
 *   npm run install-model           # interactive
 *   npm run install-model -- --list # print the model table and exit
 *   npm run install-model -- --id gemma2-9b-q4  # non-interactive download
 */

import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

// ---------------------------------------------------------------------------
// Curated model list
// ---------------------------------------------------------------------------
//
// All entries are public, non-gated GGUF builds. `quant` controls the
// canonical filename and env var (Q4_K_M → gemma4-e4b-Q4_K_M.gguf +
// GEMMA_Q4_SHA256; Q8 → gemma4-e4b-Q8.gguf + GEMMA_Q8_SHA256).
//
// The naming convention is shared by every model regardless of provenance —
// `bootstrap.ts` only cares about the path, not what's actually in the file.
// We picked Gemma's naming scheme because the spec targets Gemma 4; any
// llama.cpp-compatible chat model fits the same slot.

export interface ModelOption {
  id: string
  displayName: string
  description: string
  quant: 'Q4_K_M' | 'Q8'
  hfRepo: string
  hfFile: string
  approxSizeGb: number
  minRamGb: number
}

export const MODELS: readonly ModelOption[] = [
  {
    id: 'gemma2-9b-q4',
    displayName: 'Gemma 2 9B (Q4_K_M)',
    description: 'Google flagship, balanced quality and speed.',
    quant: 'Q4_K_M',
    hfRepo: 'bartowski/gemma-2-9b-it-GGUF',
    hfFile: 'gemma-2-9b-it-Q4_K_M.gguf',
    approxSizeGb: 5.4,
    minRamGb: 6,
  },
  {
    id: 'gemma2-9b-q8',
    displayName: 'Gemma 2 9B (Q8_0)',
    description: 'Higher quality, larger file.',
    quant: 'Q8',
    hfRepo: 'bartowski/gemma-2-9b-it-GGUF',
    hfFile: 'gemma-2-9b-it-Q8_0.gguf',
    approxSizeGb: 9.2,
    minRamGb: 10,
  },
  {
    id: 'gemma2-2b-q4',
    displayName: 'Gemma 2 2B (Q4_K_M)',
    description: 'Smallest Gemma — fits 4 GB devices like Raspberry Pi 5.',
    quant: 'Q4_K_M',
    hfRepo: 'bartowski/gemma-2-2b-it-GGUF',
    hfFile: 'gemma-2-2b-it-Q4_K_M.gguf',
    approxSizeGb: 1.6,
    minRamGb: 3,
  },
  {
    id: 'phi3-mini-q4',
    displayName: 'Phi-3 Mini (Q4)',
    description: 'Microsoft small model, fast and low-RAM.',
    quant: 'Q4_K_M',
    hfRepo: 'microsoft/Phi-3-mini-4k-instruct-gguf',
    hfFile: 'Phi-3-mini-4k-instruct-q4.gguf',
    approxSizeGb: 2.2,
    minRamGb: 4,
  },
  {
    id: 'llama31-8b-q4',
    displayName: 'Llama 3.1 8B (Q4_K_M)',
    description: 'Meta alternative, similar profile to Gemma 9B.',
    quant: 'Q4_K_M',
    hfRepo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    hfFile: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    approxSizeGb: 4.6,
    minRamGb: 6,
  },
  {
    id: 'qwen25-7b-q4',
    displayName: 'Qwen 2.5 7B (Q4_K_M)',
    description: 'Strong multilingual — useful for non-English tutoring.',
    quant: 'Q4_K_M',
    hfRepo: 'bartowski/Qwen2.5-7B-Instruct-GGUF',
    hfFile: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    approxSizeGb: 4.4,
    minRamGb: 6,
  },
] as const

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = process.cwd()
const MODELS_DIR = path.join(ROOT, 'models')
const ENV_FILE = path.join(ROOT, '.env')

export function targetPathFor(option: ModelOption): string {
  return path.join(MODELS_DIR, `gemma4-e4b-${option.quant}.gguf`)
}

export function envVarFor(option: ModelOption): 'GEMMA_Q4_SHA256' | 'GEMMA_Q8_SHA256' {
  return option.quant === 'Q4_K_M' ? 'GEMMA_Q4_SHA256' : 'GEMMA_Q8_SHA256'
}

export function huggingFaceUrl(option: ModelOption): string {
  return `https://huggingface.co/${option.hfRepo}/resolve/main/${option.hfFile}`
}

// ---------------------------------------------------------------------------
// .env upsert (exported for unit tests)
// ---------------------------------------------------------------------------

export function upsertEnv(content: string, name: string, value: string): string {
  const lineRe = new RegExp(`^${name}=.*$`, 'm')
  if (lineRe.test(content)) {
    return content.replace(lineRe, `${name}=${value}`)
  }
  const trailing = content.length === 0 || content.endsWith('\n') ? '' : '\n'
  return `${content}${trailing}${name}=${value}\n`
}

// ---------------------------------------------------------------------------
// Streaming download with progress + on-the-fly SHA-256
// ---------------------------------------------------------------------------

async function downloadWithProgress(
  url: string,
  finalPath: string,
  log: (line: string) => void = (line) => process.stdout.write(line)
): Promise<{ sha256: string; bytes: number }> {
  const partialPath = `${finalPath}.partial`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`)
  }
  if (response.body === null) {
    throw new Error('Response body is null — cannot stream download')
  }

  const total = parseInt(response.headers.get('content-length') ?? '0', 10)
  const hash = crypto.createHash('sha256')
  const writeStream = fs.createWriteStream(partialPath)
  let bytesRead = 0
  const startMs = Date.now()
  let lastRender = 0

  const reader = response.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      hash.update(value)
      if (!writeStream.write(value)) {
        await new Promise((res) => writeStream.once('drain', res))
      }
      bytesRead += value.length
      const now = Date.now()
      if (now - lastRender > 250) {
        log(renderProgressLine(bytesRead, total, now - startMs))
        lastRender = now
      }
    }
  } catch (err) {
    writeStream.destroy()
    try { fs.unlinkSync(partialPath) } catch { /* best-effort */ }
    throw err
  }
  writeStream.end()
  await new Promise<void>((res, rej) => {
    writeStream.on('finish', () => res())
    writeStream.on('error', rej)
  })
  log(renderProgressLine(bytesRead, total, Date.now() - startMs, true))

  // Atomic move on success.
  fs.renameSync(partialPath, finalPath)
  return { sha256: hash.digest('hex'), bytes: bytesRead }
}

function renderProgressLine(bytes: number, total: number, elapsedMs: number, finalize = false): string {
  const mb = bytes / 1024 / 1024
  const totalMb = total / 1024 / 1024
  const elapsedSec = Math.max(0.1, elapsedMs / 1000)
  const speed = mb / elapsedSec
  const pct = total > 0 ? Math.min(100, (bytes / total) * 100) : 0
  const barWidth = 30
  const filled = total > 0 ? Math.round((pct / 100) * barWidth) : 0
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled)
  const eta = total > 0 && speed > 0
    ? `ETA ${Math.max(0, Math.round((totalMb - mb) / speed))}s`
    : 'ETA --'
  const totalStr = total > 0 ? `${totalMb.toFixed(1)} MB` : '?'
  const line = `  [${bar}] ${pct.toFixed(1).padStart(5)}% — ${mb.toFixed(1)}/${totalStr} — ${speed.toFixed(1)} MB/s — ${eta}    `
  return finalize ? `\r${line}\n` : `\r${line}`
}

// ---------------------------------------------------------------------------
// Interactive flow
// ---------------------------------------------------------------------------

function printHelpHeader(): void {
  console.log('CalcuLearn — model installer')
  console.log()
  console.log('Note: the runtime never downloads models. This is a one-time setup')
  console.log('helper. After completion, `npm start` is fully offline.')
  console.log()
}

function printModelTable(): void {
  console.log('Available models:')
  console.log()
  console.log('  #   Model                          Size     Min RAM')
  console.log('  ─   ─────                          ────     ───────')
  MODELS.forEach((m, i) => {
    const sizeStr = `${m.approxSizeGb.toFixed(1)} GB`.padStart(7)
    const ramStr = `${m.minRamGb} GB`.padStart(6)
    const num = `  ${i + 1}.`.padEnd(6)
    console.log(`${num}${m.displayName.padEnd(31)}${sizeStr}  ${ramStr}`)
    console.log(`      ${m.description}`)
    console.log(`      ${m.hfRepo}/${m.hfFile}`)
    console.log()
  })
  console.log('  Note on NLLB-200 (translation): GGUF builds are uncommon and out of')
  console.log('  scope for this installer. The TranslationLayer falls back to English')
  console.log('  passthrough if no NLLB model is present, so you can ship without it.')
  console.log()
}

function findById(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === id)
}

async function chooseInteractively(): Promise<ModelOption | null> {
  const rl = readline.createInterface({ input: stdin, output: stdout })
  try {
    while (true) {
      const answer = (await rl.question(`Select [1-${MODELS.length}, q to quit]: `)).trim()
      if (answer === '' || answer.toLowerCase() === 'q') return null
      const n = parseInt(answer, 10)
      if (Number.isFinite(n) && n >= 1 && n <= MODELS.length) {
        return MODELS[n - 1]!
      }
      console.log(`  Invalid selection: ${answer}`)
    }
  } finally {
    rl.close()
  }
}

async function confirmOverwrite(targetFile: string): Promise<boolean> {
  if (!fs.existsSync(targetFile)) return true
  const rl = readline.createInterface({ input: stdin, output: stdout })
  try {
    const ok = (await rl.question(`  ${targetFile} already exists. Overwrite? [y/N]: `)).trim().toLowerCase()
    return ok === 'y'
  } finally {
    rl.close()
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const wantList = args.includes('--list')
  const idIndex = args.indexOf('--id')
  const explicitId = idIndex >= 0 ? args[idIndex + 1] : undefined

  printHelpHeader()
  printModelTable()
  if (wantList) return

  let chosen: ModelOption | null = null
  if (explicitId !== undefined) {
    chosen = findById(explicitId) ?? null
    if (chosen === null) {
      console.error(`[install-model] no model with id "${explicitId}". Use --list to see options.`)
      process.exit(1)
    }
    console.log(`Using --id ${explicitId} → ${chosen.displayName}`)
  } else {
    chosen = await chooseInteractively()
    if (chosen === null) {
      console.log('Aborted.')
      return
    }
  }

  const targetFile = targetPathFor(chosen)
  const ok = explicitId !== undefined ? true : await confirmOverwrite(targetFile)
  if (!ok) {
    console.log('Aborted (file unchanged).')
    return
  }

  fs.mkdirSync(MODELS_DIR, { recursive: true })
  const url = huggingFaceUrl(chosen)
  console.log()
  console.log(`Downloading ${chosen.hfRepo}/${chosen.hfFile}`)
  console.log(`         → ${targetFile}`)
  console.log()

  const { sha256, bytes } = await downloadWithProgress(url, targetFile)
  console.log(`✓ Download complete (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
  console.log(`✓ SHA-256: ${sha256}`)

  const envName = envVarFor(chosen)
  const before = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : ''
  const after = upsertEnv(before, envName, sha256)
  fs.writeFileSync(ENV_FILE, after)
  console.log(`✓ Wrote ${envName}=${sha256.slice(0, 12)}… to ${ENV_FILE}`)
  console.log()
  console.log('Next steps:')
  console.log('  source .env && npm start         # smoke-run the wired app')
  console.log('  npm run build && npm run bundle  # produce the offline ./dist/')
  console.log()
}

// Run only when invoked directly (not when imported by tests).
const isMain = process.argv[1]?.endsWith('installModel.ts') || process.argv[1]?.endsWith('installModel.js')
if (isMain) {
  main().catch((err: unknown) => {
    console.error('\n[install-model] failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
