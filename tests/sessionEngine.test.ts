import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { Database } from 'better-sqlite3'
import { initSchema, openDatabase } from '../src/db/database.js'
import { CONCEPTS } from '../src/data/concepts.js'
import { PROBLEMS } from '../src/data/problems.js'
import { KnowledgeStateManager, bktUpdate } from '../src/components/knowledgeStateManager.js'
import { ProblemEngine } from '../src/components/problemEngine.js'
import { SessionEngine } from '../src/components/sessionEngine.js'
import type { AnswerEvaluator } from '../src/components/answerEvaluator.js'
import type { DialogueGenerator } from '../src/components/dialogueGenerator.js'
import type { TranslationLayer } from '../src/components/translationLayer.js'
import type { EvaluationResult, Problem } from '../src/models/types.js'

function makeDb(): Database {
  const db = openDatabase(':memory:')
  initSchema(db)
  const insert = db.prepare<[string, string, string, string, string, string, string, string, number]>(
    `INSERT OR IGNORE INTO problems
      (id, concept_id, difficulty, type, stem, answer_json, solution_steps_json, misconceptions_json, is_generated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const tx = db.transaction(() => {
    for (const p of PROBLEMS) {
      insert.run(p.id, p.conceptId, p.difficulty, p.type, p.stem, JSON.stringify(p.answer), JSON.stringify(p.solutionSteps), JSON.stringify(p.commonMisconceptions), 0)
    }
  })
  tx()
  return db
}

function makeEngine(db: Database, answers: boolean[], options: { persistHistory?: boolean } = {}): SessionEngine {
  const ksm = new KnowledgeStateManager(db, CONCEPTS)
  const problemEngine = new ProblemEngine(db, CONCEPTS, {
    dialogueGenerator: {
      async generateProblemVariant(template, difficulty) {
        return {
          id: `${template.id}-generated`,
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
    rng: () => 0,
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
    async generateIntroduction() { return 'intro' },
    async generateFeedback() { return 'feedback' },
    async generateHint() { return 'hint' },
  } as unknown as Pick<DialogueGenerator, 'generateIntroduction' | 'generateFeedback' | 'generateHint'>
  const translationLayer = {
    async translate(text: string) { return text },
  } as Pick<TranslationLayer, 'translate'>

  return new SessionEngine({
    ksm,
    problemEngine,
    answerEvaluator,
    dialogueGenerator,
    translationLayer,
    db: options.persistHistory === true ? db : undefined,
    idGenerator: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
}

describe('SessionEngine', () => {
  it('increments turn count on submit and hint count on hints', async () => {
    const db = makeDb()
    const engine = makeEngine(db, [false, true])
    const session = await engine.beginSession('student-a')
    const hint = await engine.requestHint(session.sessionId)
    const turn = await engine.submitAnswer(session.sessionId, 'x')
    expect(hint.hintCount).toBe(1)
    expect(turn.turnCount).toBe(1)
    db.close()
  })

  it('advances concept after mastery >= 0.85 and three consecutive correct answers', async () => {
    const db = makeDb()
    const engine = makeEngine(db, [true, true, true, true])
    const session = await engine.beginSession('student-b')
    let advanced = false
    for (let i = 0; i < 3; i++) {
      const turn = await engine.submitAnswer(session.sessionId, 'correct')
      advanced ||= turn.conceptAdvanced
    }
    expect(advanced).toBe(true)
    db.close()
  })

  it('endSession persists state and returns summary', async () => {
    const db = makeDb()
    const engine = makeEngine(db, [true])
    const session = await engine.beginSession('student-c')
    await engine.submitAnswer(session.sessionId, 'correct')
    const summary = await engine.endSession(session.sessionId)
    expect(summary.totalTurns).toBe(1)
    expect(Object.values(summary.masteryDeltas).some((d) => d > 0)).toBe(true)
    db.close()
  })

  it('endSession writes a session_history row when db is provided (Reqs 1.4, 7.2)', async () => {
    const db = makeDb()
    const engine = makeEngine(db, [true, false], { persistHistory: true })
    const session = await engine.beginSession('history-student')
    await engine.submitAnswer(session.sessionId, 'first')
    await engine.submitAnswer(session.sessionId, 'second')
    await engine.endSession(session.sessionId)

    const row = db
      .prepare(`SELECT student_id, start_time, end_time, turns_json FROM session_history WHERE session_id = ?`)
      .get(session.sessionId) as { student_id: string; start_time: number; end_time: number; turns_json: string } | undefined

    expect(row).toBeDefined()
    expect(row!.student_id).toBe('history-student')
    expect(row!.end_time).toBeGreaterThanOrEqual(row!.start_time)
    const turns = JSON.parse(row!.turns_json) as unknown[]
    expect(turns).toHaveLength(2)
    db.close()
  })

  it('endSession without a db connection still completes (history is opt-in)', async () => {
    const db = makeDb()
    const engine = makeEngine(db, [true], { persistHistory: false })
    const session = await engine.beginSession('no-history-student')
    await engine.submitAnswer(session.sessionId, 'answer')
    await expect(engine.endSession(session.sessionId)).resolves.toBeDefined()

    const count = (db.prepare(`SELECT COUNT(*) as n FROM session_history`).get() as { n: number }).n
    expect(count).toBe(0)
    db.close()
  })
})

describe('Property 6: session persistence round trip', () => {
  it('persists the cumulative BKT updates after endSession', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 3 }), async (answers) => {
        const db = makeDb()
        const engine = makeEngine(db, answers)
        const session = await engine.beginSession('student-prop')
        const conceptId = session.targetConcept.id
        let expected = 0.1
        for (const isCorrect of answers) {
          await engine.submitAnswer(session.sessionId, isCorrect ? 'correct' : 'wrong')
          expected = bktUpdate(expected, isCorrect)
        }
        await engine.endSession(session.sessionId)
        const reloaded = new KnowledgeStateManager(db, CONCEPTS).loadState('student-prop')
        expect(reloaded.concepts.get(conceptId)!.masteryProbability).toBeCloseTo(expected, 10)
        db.close()
      }),
      { numRuns: 20 }
    )
  })
})
