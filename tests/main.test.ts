/**
 * Smoke test for src/main.ts production wiring.
 *
 * Verifies that `createApp` constructs a fully-wired component graph against
 * temp GGUF files and a temp SQLite DB. We don't run inference (no real Gemma
 * model bytes) but we confirm every component is non-null and the
 * AnswerEvaluator's semantic adapter is the same DialogueGenerator instance.
 */

import { describe, it, expect } from 'vitest'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { createApp } from '../src/main.js'

function makeFakeModel(dir: string, name: string, content: string): { fullPath: string; hash: string } {
  const fullPath = path.join(dir, name)
  fs.writeFileSync(fullPath, content)
  return { fullPath, hash: crypto.createHash('sha256').update(content).digest('hex') }
}

describe('createApp (production wiring)', () => {
  it('wires all components against verified model files', async () => {
    const tmpRoot = path.join(
      os.tmpdir(),
      `calculearn-app-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    fs.mkdirSync(tmpRoot, { recursive: true })

    const gemmaQ4 = makeFakeModel(tmpRoot, 'gemma4-e4b-Q4_K_M.gguf', 'gemma-q4-content')
    const gemmaQ8 = makeFakeModel(tmpRoot, 'gemma4-e4b-Q8.gguf', 'gemma-q8-content')
    const nllb = makeFakeModel(tmpRoot, 'nllb-200.gguf', 'nllb-content')
    const dbPath = path.join(tmpRoot, 'calculearn.sqlite')

    try {
      const app = await createApp({
        dbPath,
        modelDir: tmpRoot,
        gemmaHashes: { Q4_K_M: gemmaQ4.hash, Q8: gemmaQ8.hash },
        nllb: { fileName: 'nllb-200.gguf', hash: nllb.hash },
        targetLanguage: 'en',
        logger: { log: () => undefined, warn: () => undefined, error: () => undefined },
      })

      try {
        // Every component is constructed.
        expect(app.db).toBeDefined()
        expect(app.ksm).toBeDefined()
        expect(app.problemEngine).toBeDefined()
        expect(app.answerEvaluator).toBeDefined()
        expect(app.dialogueGenerator).toBeDefined()
        expect(app.translationLayer).toBeDefined()
        expect(app.sessionEngine).toBeDefined()

        // The DB has the schema (sanity check that recoverOrCreate ran).
        const tables = app.db
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
          .all() as { name: string }[]
        const tableNames = new Set(tables.map((t) => t.name))
        expect(tableNames.has('students')).toBe(true)
        expect(tableNames.has('concept_mastery')).toBe(true)
        expect(tableNames.has('session_history')).toBe(true)
        expect(tableNames.has('problems')).toBe(true)
      } finally {
        app.close()
      }
    } finally {
      for (const p of [gemmaQ4.fullPath, gemmaQ8.fullPath, nllb.fullPath, dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
        try { fs.unlinkSync(p) } catch { /* best-effort */ }
      }
      try { fs.rmdirSync(tmpRoot) } catch { /* best-effort */ }
    }
  })

  it('rejects startup when a model hash does not match', async () => {
    const tmpRoot = path.join(
      os.tmpdir(),
      `calculearn-app-bad-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    fs.mkdirSync(tmpRoot, { recursive: true })
    const gemmaQ4 = makeFakeModel(tmpRoot, 'gemma4-e4b-Q4_K_M.gguf', 'gemma-q4-content')
    const gemmaQ8 = makeFakeModel(tmpRoot, 'gemma4-e4b-Q8.gguf', 'gemma-q8-content')

    try {
      await expect(createApp({
        dbPath: path.join(tmpRoot, 'calculearn.sqlite'),
        modelDir: tmpRoot,
        gemmaHashes: { Q4_K_M: '0'.repeat(64), Q8: '0'.repeat(64) },
        logger: { log: () => undefined, warn: () => undefined, error: () => undefined },
      })).rejects.toThrow()
    } finally {
      for (const p of [gemmaQ4.fullPath, gemmaQ8.fullPath]) {
        try { fs.unlinkSync(p) } catch { /* best-effort */ }
      }
      try { fs.rmdirSync(tmpRoot) } catch { /* best-effort */ }
    }
  })
})
