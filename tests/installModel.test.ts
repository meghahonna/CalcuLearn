/**
 * Tests for scripts/installModel.ts — the parts that don't require a real
 * Hugging Face download (model list invariants, env upsert, path/URL helpers).
 *
 * The download itself is exercised manually; we don't make real network calls
 * from the test suite (Req 7.1 — offline guarantee).
 */

import { describe, it, expect } from 'vitest'
import {
  MODELS,
  upsertEnv,
  targetPathFor,
  envVarFor,
  huggingFaceUrl,
  type ModelOption,
} from '../scripts/installModel.js'

const SAMPLE: ModelOption = MODELS[0]!

describe('MODELS catalogue invariants', () => {
  it('contains at least one Q4_K_M and one Q8 entry', () => {
    expect(MODELS.some((m) => m.quant === 'Q4_K_M')).toBe(true)
    expect(MODELS.some((m) => m.quant === 'Q8')).toBe(true)
  })

  it('every model has unique id, non-empty repo + file, plausible size', () => {
    const ids = new Set<string>()
    for (const m of MODELS) {
      expect(m.id, m.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(m.id), `duplicate id ${m.id}`).toBe(false)
      ids.add(m.id)
      expect(m.hfRepo.includes('/'), `${m.id}: hfRepo must be "owner/repo"`).toBe(true)
      expect(m.hfFile.endsWith('.gguf'), `${m.id}: hfFile must end in .gguf`).toBe(true)
      expect(m.approxSizeGb, `${m.id} size`).toBeGreaterThan(0.5)
      expect(m.approxSizeGb, `${m.id} size`).toBeLessThan(50)
      expect(m.minRamGb, `${m.id} ram`).toBeGreaterThanOrEqual(2)
    }
  })

  it('all displayed descriptions are short enough to fit terminal output', () => {
    for (const m of MODELS) {
      expect(m.displayName.length, m.id).toBeLessThanOrEqual(40)
      expect(m.description.length, m.id).toBeLessThanOrEqual(80)
    }
  })
})

describe('targetPathFor + envVarFor', () => {
  it('Q4_K_M models map to gemma4-e4b-Q4_K_M.gguf and GEMMA_Q4_SHA256', () => {
    const q4 = MODELS.find((m) => m.quant === 'Q4_K_M')!
    expect(targetPathFor(q4).endsWith('models/gemma4-e4b-Q4_K_M.gguf')).toBe(true)
    expect(envVarFor(q4)).toBe('GEMMA_Q4_SHA256')
  })

  it('Q8 models map to gemma4-e4b-Q8.gguf and GEMMA_Q8_SHA256', () => {
    const q8 = MODELS.find((m) => m.quant === 'Q8')!
    expect(targetPathFor(q8).endsWith('models/gemma4-e4b-Q8.gguf')).toBe(true)
    expect(envVarFor(q8)).toBe('GEMMA_Q8_SHA256')
  })
})

describe('huggingFaceUrl', () => {
  it('builds a /resolve/main/ URL', () => {
    const url = huggingFaceUrl(SAMPLE)
    expect(url).toMatch(/^https:\/\/huggingface\.co\/.+\/resolve\/main\/.+\.gguf$/)
    expect(url).toContain(SAMPLE.hfRepo)
    expect(url).toContain(SAMPLE.hfFile)
  })
})

describe('upsertEnv', () => {
  it('appends a new variable to empty content with a trailing newline', () => {
    const after = upsertEnv('', 'GEMMA_Q4_SHA256', 'abc123')
    expect(after).toBe('GEMMA_Q4_SHA256=abc123\n')
  })

  it('appends a new variable to existing content (preserving prior lines)', () => {
    const before = 'DB_PATH=./data/calculearn.sqlite\nMODEL_DIR=./models\n'
    const after = upsertEnv(before, 'GEMMA_Q4_SHA256', 'newhash')
    expect(after).toBe(`${before}GEMMA_Q4_SHA256=newhash\n`)
  })

  it('adds a missing trailing newline before appending', () => {
    const before = 'DB_PATH=./data/calculearn.sqlite' // no \n
    const after = upsertEnv(before, 'GEMMA_Q4_SHA256', 'abc')
    expect(after).toBe('DB_PATH=./data/calculearn.sqlite\nGEMMA_Q4_SHA256=abc\n')
  })

  it('replaces an existing value in place without adding duplicates', () => {
    const before = `DB_PATH=./data/calculearn.sqlite
GEMMA_Q4_SHA256=oldvalue
MODEL_DIR=./models
`
    const after = upsertEnv(before, 'GEMMA_Q4_SHA256', 'newvalue')
    expect(after).toContain('GEMMA_Q4_SHA256=newvalue')
    expect(after).not.toContain('oldvalue')
    // Other lines remain.
    expect(after).toContain('DB_PATH=./data/calculearn.sqlite')
    expect(after).toContain('MODEL_DIR=./models')
    // Exactly one occurrence of GEMMA_Q4_SHA256.
    expect(after.match(/GEMMA_Q4_SHA256=/g)?.length).toBe(1)
  })

  it('does not match a name that is a prefix of an existing line', () => {
    // FOO is NOT FOO_BAR — the regex must be anchored to whole-name matches.
    const before = 'FOO_BAR=existing\n'
    const after = upsertEnv(before, 'FOO', 'newvalue')
    expect(after).toContain('FOO_BAR=existing')
    expect(after).toContain('FOO=newvalue')
  })
})
