import { describe, it, expect } from 'vitest'
import type { Database } from 'better-sqlite3'
import { initSchema, openDatabase } from '../src/db/database.js'
import { CONCEPTS } from '../src/data/concepts.js'
import { PROBLEMS } from '../src/data/problems.js'
import { KnowledgeStateManager } from '../src/components/knowledgeStateManager.js'
import { ProblemEngine } from '../src/components/problemEngine.js'
import { SessionEngine } from '../src/components/sessionEngine.js'
import type { AnswerEvaluator } from '../src/components/answerEvaluator.js'
import { DialogueGenerator, type DialogueModelBackend } from '../src/components/dialogueGenerator.js'
import { TranslationLayer, type TranslationBackend, extractLatexSpans } from '../src/components/translationLayer.js'
import type { EvaluationResult, Problem } from '../src/models/types.js'

function seedDb(extraProblems: Problem[] = []): Database {
  const db = openDatabase(':memory:')
  initSchema(db)
  const insert = db.prepare<[string, string, string, string, string, string, string, string, number]>(
    `INSERT OR IGNORE INTO problems
      (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const tx = db.transaction(() => {
    for (const p of [...PROBLEMS, ...extraProblems]) {
      insert.run(p.id, p.conceptId, p.difficulty, p.type, p.stem, JSON.stringify(p.answer), JSON.stringify(p.solutionSteps), JSON.stringify(p.commonMisconceptions), p.isGenerated ? 1 : 0)
    }
  })
  tx()
  return db
}

function makeSessionEngine(db: Database, targetLanguage = 'en', answers: boolean[] = [true]): SessionEngine {
  const ksm = new KnowledgeStateManager(db, CONCEPTS)
  const problemEngine = new ProblemEngine(db, CONCEPTS, {
    rng: () => 0,
    dialogueGenerator: {
      async generateProblemVariant(template, difficulty) {
        return {
          id: `${template.id}-integration-generated`,
          conceptId: template.conceptId,
          difficulty,
          type: 'free-response',
          stem: template.templateStem,
          answer: { raw: '1', latex: '1', type: 'numeric' },
          solutionSteps: [],
          commonMisconceptions: [],
          isGenerated: true,
        }
      },
    },
  })
  let i = 0
  const answerEvaluator = {
    async evaluate(problem: Problem, rawAnswer: string): Promise<EvaluationResult> {
      const isCorrect = answers[Math.min(i++, answers.length - 1)]
      return {
        problemId: problem.id,
        isCorrect,
        partialCredit: isCorrect ? 1 : 0,
        misconceptions: [],
        evaluationMethod: 'symbolic',
        rawAnswer,
        parsedAnswer: null,
        feedbackHints: [],
      }
    },
  } as unknown as AnswerEvaluator
  const dialogueGenerator = {
    async generateIntroduction(problem: Problem) { return `intro ${problem.stem}` },
    async generateFeedback() { return 'feedback $x^2$' },
    async generateHint() { return 'hint $x^2$' },
  }
  const translationLayer = new TranslationLayer({
    modelPath: 'nllb.gguf',
    backend: {
      async load() {},
      async translate(text: string, lang: string) { return `[${lang}]${text}` },
    },
  })
  return new SessionEngine({
    ksm,
    problemEngine,
    answerEvaluator,
    dialogueGenerator,
    translationLayer,
    targetLanguage,
  })
}

describe('integration smoke tests', () => {
  it('runs a 5-turn offline session without fetch/network calls', async () => {
    const originalFetch = globalThis.fetch
    let fetchCalls = 0
    globalThis.fetch = (async () => {
      fetchCalls++
      throw new Error('network disabled')
    }) as typeof fetch
    const db = seedDb()
    try {
      const engine = makeSessionEngine(db, 'en', [true, false, true, false, true])
      const session = await engine.beginSession('offline-student')
      for (let i = 0; i < 5; i++) await engine.submitAnswer(session.sessionId, `answer-${i}`)
      const summary = await engine.endSession(session.sessionId)
      expect(summary.totalTurns).toBe(5)
      expect(fetchCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
      db.close()
    }
  })

  it('translates natural-language strings while preserving LaTeX spans', async () => {
    const db = seedDb()
    const engine = makeSessionEngine(db, 'fr', [true])
    const session = await engine.beginSession('fr-student')
    const hint = await engine.requestHint(session.sessionId)
    expect(hint.text.startsWith('[fr]')).toBe(true)
    expect(extractLatexSpans(hint.text)).toEqual(['$x^2$'])
    db.close()
  })

  it('simulates 20 turns and preserves summary counts', async () => {
    const db = seedDb()
    const answers = Array.from({ length: 20 }, (_, i) => i % 2 === 0)
    const engine = makeSessionEngine(db, 'en', answers)
    const session = await engine.beginSession('sim-student')
    for (let i = 0; i < 20; i++) {
      if (i % 5 === 0) await engine.requestHint(session.sessionId)
      await engine.submitAnswer(session.sessionId, `answer-${i}`)
    }
    const summary = await engine.endSession(session.sessionId)
    expect(summary.totalTurns).toBe(20)
    expect(summary.hintsUsed).toBe(4)
    db.close()
  })
})

describe('performance validation', () => {
  it('selectNextProblem stays below 10 ms p99 with 1000 extra indexed problems', async () => {
    const base = PROBLEMS[0]
    const extra = Array.from({ length: 1000 }, (_, i): Problem => ({
      ...base,
      id: `perf-${i}`,
      conceptId: 'limits.definition',
      difficulty: 'conceptual',
      stem: `${base.stem} #${i}`,
    }))
    const db = seedDb(extra)
    const ksm = new KnowledgeStateManager(db, CONCEPTS)
    const state = ksm.loadState('perf-student')
    const session = {
      sessionId: 'perf',
      studentId: 'perf-student',
      startTime: new Date(),
      turns: [],
      currentProblem: null,
      hintCount: 0,
      targetConcept: CONCEPTS.find((c) => c.id === 'limits.definition')!,
    }
    const engine = new ProblemEngine(db, CONCEPTS, { rng: () => 0 })
    const samples: number[] = []
    for (let i = 0; i < 50; i++) {
      const start = performance.now()
      await engine.selectNextProblem(state, session)
      samples.push(performance.now() - start)
    }
    samples.sort((a, b) => a - b)
    expect(samples[Math.floor(samples.length * 0.99)]).toBeLessThan(10)
    db.close()
  })

  it('DialogueGenerator caps oversized prompts and marks summarisation', async () => {
    class CaptureBackend implements DialogueModelBackend {
      prompt = ''
      async load() {}
      async infer(prompt: string) {
        this.prompt = prompt
        return 'ok'
      }
    }
    const backend = new CaptureBackend()
    const generator = new DialogueGenerator({ modelPath: 'fake.gguf', backend })
    const db = seedDb()
    await generator.generateHint({
      ...PROBLEMS[0],
      stem: 'x '.repeat(5000),
    }, 1, new KnowledgeStateManager(db, CONCEPTS).loadState('ctx'))
    expect(backend.prompt.length).toBeLessThanOrEqual(2048 * 4)
    expect(backend.prompt).toContain('Session history summarized')
    db.close()
  })
})
