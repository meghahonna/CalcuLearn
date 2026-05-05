import { describe, it, expect } from 'vitest'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { openDatabase, initSchema } from '../src/db/database.js'
import { verifyModelHash, ModelTamperingError } from '../src/security/modelVerifier.js'
import { createStudentProfile } from '../src/security/studentIdentity.js'
import { sanitiseInput } from '../src/components/answerEvaluator.js'
import { SyncService } from '../src/components/syncService.js'
import { bootstrapModel, selectQuantisation } from '../src/bootstrap.js'
import { StudentUiController, renderLatexMarkup, renderLatexInElement, type KatexLike, type SessionEngineUiPort } from '../src/ui/app.js'
import type { SessionSummary } from '../src/models/types.js'

function tempFile(content: string): { file: string; hash: string; cleanup: () => void } {
  const file = path.join(os.tmpdir(), `calculearn-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  fs.writeFileSync(file, content)
  return {
    file,
    hash: crypto.createHash('sha256').update(content).digest('hex'),
    cleanup: () => fs.existsSync(file) && fs.unlinkSync(file),
  }
}

function tempFileAt(dir: string, fileName: string, content: string): { file: string; hash: string; cleanup: () => void } {
  const file = path.join(dir, fileName)
  fs.writeFileSync(file, content)
  return {
    file,
    hash: crypto.createHash('sha256').update(content).digest('hex'),
    cleanup: () => fs.existsSync(file) && fs.unlinkSync(file),
  }
}

describe('model verification and student identity', () => {
  it('verifies matching SHA-256 and rejects mismatch', async () => {
    const f = tempFile('model')
    try {
      await expect(verifyModelHash(f.file, f.hash)).resolves.toBeUndefined()
      await expect(verifyModelHash(f.file, '0'.repeat(64))).rejects.toBeInstanceOf(ModelTamperingError)
    } finally {
      f.cleanup()
    }
  })

  it('creates local UUID student IDs without accepting caller-supplied identity', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    const id = createStudentProfile(db)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    const row = db.prepare(`SELECT id FROM students WHERE id = ?`).get(id) as { id: string }
    expect(row.id).toBe(id)
    db.close()
  })

  it('strips all configured executable input patterns', () => {
    const sanitized = sanitiseInput('__import__ eval exec ; | & ` $(touch x)')
    expect(sanitized).not.toMatch(/__import__|eval|exec|[;|&`]|[$][(]/)
  })
})

describe('SyncService', () => {
  const summary: SessionSummary = {
    sessionId: 's1',
    studentId: 'student-local-uuid',
    totalTurns: 1,
    hintsUsed: 0,
    conceptsProgressed: [],
    masteryDeltas: {},
    startTime: new Date(0),
    endTime: new Date(1),
  }

  it('does not sync when opt-in is false', async () => {
    let called = false
    const service = new SyncService({
      endpoint: 'https://example.invalid/sync',
      optIn: false,
      keychain: { async getToken() { return 'token' } },
      transport: { async post() { called = true } },
    })
    await expect(service.syncSession('student-local-uuid', summary)).resolves.toBe(false)
    expect(called).toBe(false)
  })

  it('sends an anonymised payload when opt-in is true', async () => {
    let payload: unknown
    const service = new SyncService({
      endpoint: 'https://example.invalid/sync',
      optIn: true,
      keychain: { async getToken() { return 'token' } },
      transport: { async post(_url, body) { payload = body } },
    })
    await service.syncSession('student-local-uuid', { ...summary, ...({ email: 'x@y.com', name: 'Ada' } as object) })
    expect(JSON.stringify(payload)).not.toMatch(/email|name|dateOfBirth|x@y\.com|Ada/)
    expect(JSON.stringify(payload)).toContain('student-local-uuid')
  })
})

describe('bootstrap and UI wiring', () => {
  it('selects quantisation by RAM', () => {
    expect(selectQuantisation(4)).toBe('Q4_K_M')
    expect(selectQuantisation(8)).toBe('Q8')
  })

  it('bootstrap verifies the NLLB GGUF hash and rejects mismatch (Reqs 7.3, 10.3)', async () => {
    // Real on-device deployments will pick Q4_K_M or Q8 based on RAM. We seed
    // both so the test passes regardless of `os.totalmem()` on the runner.
    const dir = path.join(os.tmpdir(), `calculearn-bootstrap-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    fs.mkdirSync(dir, { recursive: true })
    const gemmaQ4 = tempFileAt(dir, 'gemma4-e4b-Q4_K_M.gguf', 'gemma-q4-bytes')
    const gemmaQ8 = tempFileAt(dir, 'gemma4-e4b-Q8.gguf', 'gemma-q8-bytes')
    const nllb = tempFileAt(dir, 'nllb-200.gguf', 'nllb-bytes')
    try {
      // Healthy bootstrap: both Gemma and NLLB hashes match.
      const ok = await bootstrapModel({
        modelDir: dir,
        hashes: { Q4_K_M: gemmaQ4.hash, Q8: gemmaQ8.hash },
        nllb: { fileName: 'nllb-200.gguf', hash: nllb.hash },
        logger: { log: () => undefined },
      })
      expect(ok.nllbModelPath).toBe(nllb.file)

      // Tampered NLLB: hash mismatch must throw.
      await expect(bootstrapModel({
        modelDir: dir,
        hashes: { Q4_K_M: gemmaQ4.hash, Q8: gemmaQ8.hash },
        nllb: { fileName: 'nllb-200.gguf', hash: '0'.repeat(64) },
        logger: { log: () => undefined },
      })).rejects.toBeInstanceOf(ModelTamperingError)
    } finally {
      gemmaQ4.cleanup()
      gemmaQ8.cleanup()
      nllb.cleanup()
      fs.rmdirSync(dir)
    }
  })

  it('wires UI actions to SessionEngine methods', async () => {
    const calls: string[] = []
    const summary: SessionSummary = {
      sessionId: 'session-1',
      studentId: 'student-1',
      totalTurns: 1,
      hintsUsed: 1,
      conceptsProgressed: [],
      masteryDeltas: {},
      startTime: new Date(),
      endTime: new Date(),
    }
    const engine: SessionEngineUiPort = {
      async beginSession(studentId) {
        calls.push(`begin:${studentId}`)
        return {
          sessionId: 'session-1',
          studentId,
          startTime: new Date(),
          turns: [],
          currentProblem: null,
          hintCount: 0,
          targetConcept: {
            id: 'limits.definition',
            name: 'Limit Definition',
            topic: 'limits',
            prerequisites: [],
            difficulty: 1,
            description: '',
            learningObjectives: [],
          },
        }
      },
      async submitAnswer(sessionId, raw) {
        calls.push(`submit:${sessionId}:${raw}`)
        return { evaluationResult: {} as never, feedbackText: 'feedback', turnCount: 1, masteryUpdated: true, conceptAdvanced: false }
      },
      async requestHint(sessionId) {
        calls.push(`hint:${sessionId}`)
        return { text: 'hint', hintLevel: 1, hintCount: 1 }
      },
      async endSession(sessionId) {
        calls.push(`end:${sessionId}`)
        return summary
      },
    }
    const ui = new StudentUiController(engine)
    await ui.start('student-1')
    await ui.submit('answer')
    await ui.hint()
    await ui.end()
    expect(calls).toEqual(['begin:student-1', 'submit:session-1:answer', 'hint:session-1', 'end:session-1'])
    expect(renderLatexMarkup('Solve $x^2$.')).toContain('class="math"')
  })

  it('renderLatexInElement uses KaTeX when provided and escapes interleaved text (Req 14.2)', () => {
    const katex: KatexLike = {
      renderToString(latex, options) {
        return `<span data-display="${options?.displayMode === true ? '1' : '0'}">[KaTeX:${latex}]</span>`
      },
    }
    const target = { textContent: null as string | null, innerHTML: '' }

    renderLatexInElement(target, 'Solve $x^2$ and \\[\\int x\\,dx\\] then <script>bad</script>', katex)

    // KaTeX renders inline span with displayMode=0 for $...$.
    expect(target.innerHTML).toContain('[KaTeX:x^2]')
    expect(target.innerHTML).toContain('data-display="0"')
    // KaTeX renders display span with displayMode=1 for \[...\].
    expect(target.innerHTML).toContain('[KaTeX:\\int x\\,dx]')
    expect(target.innerHTML).toContain('data-display="1"')
    // Non-LaTeX HTML in the surrounding text must be escaped, not injected.
    expect(target.innerHTML).toContain('&lt;script&gt;bad&lt;/script&gt;')
    expect(target.innerHTML).not.toContain('<script>bad')
  })

  it('renderLatexInElement falls back to span class="math" when KaTeX is absent', () => {
    const target = { textContent: null as string | null, innerHTML: '' }
    renderLatexInElement(target, 'Compute $\\sin x$ now.', undefined)
    expect(target.innerHTML).toContain('class="math"')
    expect(target.innerHTML).toContain('\\sin x')
  })
})
