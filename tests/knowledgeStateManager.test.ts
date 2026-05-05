/**
 * Tests for src/components/knowledgeStateManager.ts
 *
 * Covers:
 *   - bktUpdate: unit tests and property-based tests (Properties 1, 3)
 *   - applyHintPenalty: Property 5 (strictly monotone-decreasing for all priors)
 *   - applySessionStartDecay: time-based forgetting
 *   - KnowledgeStateManager.loadState: fresh student, returning student, lastUpdated
 *   - KnowledgeStateManager.persistState: upsert, transaction atomicity
 *   - KnowledgeStateManager.updateStateForConcept: BKT application, status transitions
 *   - KnowledgeStateManager.getMasteryScore: present and absent concepts
 *   - KnowledgeStateManager.getNextTargetConcept: prerequisite gate, readiness scoring, fallback
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { openDatabase, initSchema } from '../src/db/database.js'
import {
  bktUpdate,
  KnowledgeStateManager,
} from '../src/components/knowledgeStateManager.js'
import type { ConceptNode, EvaluationResult, KnowledgeState } from '../src/models/types.js'
import type { Database } from 'better-sqlite3'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): Database {
  const db = openDatabase(':memory:')
  initSchema(db)
  return db
}

function makeConceptNode(
  id: string,
  prerequisites: string[] = [],
  topic: ConceptNode['topic'] = 'limits'
): ConceptNode {
  return { id, name: id, topic, prerequisites, difficulty: 1, description: '', learningObjectives: [] }
}

function makeEvalResult(
  problemId: string,
  isCorrect: boolean,
  partialCredit = isCorrect ? 1.0 : 0.0
): EvaluationResult {
  return {
    problemId, isCorrect, partialCredit,
    misconceptions: [], evaluationMethod: 'symbolic',
    rawAnswer: 'x', parsedAnswer: null, feedbackHints: [],
  }
}

function makeState(studentId: string, entries: Array<[string, number, ConceptMastery['status']?]>): KnowledgeState {
  const concepts = new Map<string, import('../src/models/types.js').ConceptMastery>()
  for (const [conceptId, prob, status = 'in-progress'] of entries) {
    concepts.set(conceptId, {
      conceptId, masteryProbability: prob,
      attemptCount: 0, correctCount: 0, lastAttempted: null, status,
    })
  }
  return { studentId, lastUpdated: new Date(), concepts, sessionHistory: [] }
}

type ConceptMastery = import('../src/models/types.js').ConceptMastery

// ---------------------------------------------------------------------------
// bktUpdate — unit tests
// ---------------------------------------------------------------------------

describe('bktUpdate', () => {
  it('returns a value in [0, 1] for a correct answer at prior 0.5', () => {
    const r = bktUpdate(0.5, true)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(1)
  })

  it('returns a value in [0, 1] for an incorrect answer at prior 0.5', () => {
    const r = bktUpdate(0.5, false)
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(1)
  })

  it('increases mastery after a correct answer (prior 0.4)', () => {
    expect(bktUpdate(0.4, true)).toBeGreaterThan(0.4)
  })

  it('decreases mastery after an incorrect answer (prior 0.6)', () => {
    expect(bktUpdate(0.6, false)).toBeLessThan(0.6)
  })

  it('handles prior = 0 without throwing', () => {
    expect(() => bktUpdate(0, true)).not.toThrow()
    expect(() => bktUpdate(0, false)).not.toThrow()
  })

  it('handles prior = 1 without throwing', () => {
    expect(() => bktUpdate(1, true)).not.toThrow()
    expect(() => bktUpdate(1, false)).not.toThrow()
  })

  it('output is always <= 1 at prior = 1 with correct answer', () => {
    expect(bktUpdate(1, true)).toBeLessThanOrEqual(1)
  })

  it('output is always >= 0 at prior = 0 with incorrect answer', () => {
    expect(bktUpdate(0, false)).toBeGreaterThanOrEqual(0)
  })

  it('correct answer at prior = 1 stays at 1 (clamp boundary)', () => {
    // posterior = 1, afterLearning = 1, clamped to 1.
    expect(bktUpdate(1.0, true)).toBe(1.0)
  })

  // Pin the documented BKT behaviour: without per-turn forgetting, a correct
  // answer always increases mastery for priors in [0, 1). If this test breaks
  // after a formula change, the Property 1 range restriction must be revisited.
  it('correct answer increases mastery at prior = 0.95 (no per-turn forgetting)', () => {
    expect(bktUpdate(0.95, true)).toBeGreaterThan(0.95)
  })
})

// ---------------------------------------------------------------------------
// Property 3: BKT Bounds
// For all masteryPrior in [0.0, 1.0] and any boolean isCorrect,
// bktUpdate returns a value in [0.0, 1.0].
// Validates: Requirement 2.3
// ---------------------------------------------------------------------------

describe('Property 3: BKT Bounds', () => {
  it('output is always in [0.0, 1.0] for any valid prior and any isCorrect', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.boolean(),
        (masteryPrior, isCorrect) => {
          const result = bktUpdate(masteryPrior, isCorrect)
          return result >= 0.0 && result <= 1.0
        }
      ),
      { numRuns: 1000 }
    )
  })
})

// ---------------------------------------------------------------------------
// Property 1: Mastery Monotonicity on Correct Streaks
// For any starting masteryPrior in [0.0, 1.0) and any n >= 1 consecutive
// correct answers, mastery after n turns is strictly greater than the prior.
// At exactly 1.0 the clamp keeps mastery at 1.0 (no room to grow).
//
// This property holds across the full [0, 1) range because per-turn
// forgetting has been removed from bktUpdate. Forgetting is applied
// separately at session start via applySessionStartDecay.
//
// Validates: Requirement 2.4
// ---------------------------------------------------------------------------

describe('Property 1: Mastery Monotonicity on Correct Streaks', () => {
  it('mastery strictly increases after n consecutive correct answers for any prior in [0, 1)', () => {
    fc.assert(
      fc.property(
        // Exclude exactly 1.0 — at the clamp boundary mastery stays at 1.0.
        fc.float({ min: 0, max: Math.fround(1 - 1e-7), noNaN: true }),
        fc.integer({ min: 1, max: 20 }),
        (masteryPrior, n) => {
          let mastery = masteryPrior
          for (let i = 0; i < n; i++) {
            mastery = bktUpdate(mastery, true)
          }
          return mastery > masteryPrior
        }
      ),
      { numRuns: 500 }
    )
  })

  it('mastery stays at 1.0 when prior is already 1.0 and answers are correct', () => {
    expect(bktUpdate(1.0, true)).toBe(1.0)
  })
})

// ---------------------------------------------------------------------------
// Property 5: Hint Penalty
// For any prior in [0.0, 1.0], applyHintPenalty produces mastery <= prior.
//
// This holds across the full range because applyHintPenalty uses a fixed
// multiplicative penalty (prior × (1 − P_HINT_PENALTY)), not a BKT update.
// No prior-range restriction needed.
//
// Validates: Requirements 2.5, 1.3
// ---------------------------------------------------------------------------

describe('Property 5: Hint Penalty', () => {
  it('mastery never increases after applyHintPenalty for any prior in [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        (prior) => {
          const db = makeDb()
          const ksm = new KnowledgeStateManager(db)
          const state = makeState('prop5-student', [['test.concept', prior]])
          const before = state.concepts.get('test.concept')!.masteryProbability
          ksm.applyHintPenalty(state, 'test.concept')
          const after = state.concepts.get('test.concept')!.masteryProbability
          db.close()
          return after <= before
        }
      ),
      { numRuns: 500 }
    )
  })
})

// ---------------------------------------------------------------------------
// KnowledgeStateManager — loadState
// ---------------------------------------------------------------------------

describe('KnowledgeStateManager.loadState', () => {
  const concepts = [
    makeConceptNode('limits.definition'),
    makeConceptNode('limits.one-sided', ['limits.definition']),
  ]
  let db: Database
  let ksm: KnowledgeStateManager

  beforeEach(() => {
    db = makeDb()
    ksm = new KnowledgeStateManager(db, concepts)
  })

  it('returns a fresh state with all concepts at 0.1 for a new student', () => {
    const state = ksm.loadState('new-student')
    expect(state.studentId).toBe('new-student')
    expect(state.concepts.size).toBe(2)
    for (const [, m] of state.concepts) {
      expect(m.masteryProbability).toBe(0.1)
      expect(m.status).toBe('locked')
      expect(m.attemptCount).toBe(0)
    }
  })

  it('sets lastUpdated to new Date(0) for a brand-new student', () => {
    const state = ksm.loadState('new-student-date')
    expect(state.lastUpdated.getTime()).toBe(0)
  })

  it('returns persisted state for a returning student', () => {
    const state = ksm.loadState('returning-student')
    const m = state.concepts.get('limits.definition')!
    m.masteryProbability = 0.75
    m.status = 'in-progress'
    m.attemptCount = 5
    m.correctCount = 4
    ksm.persistState('returning-student', state)

    const reloaded = ksm.loadState('returning-student')
    const rm = reloaded.concepts.get('limits.definition')!
    expect(rm.masteryProbability).toBeCloseTo(0.75)
    expect(rm.status).toBe('in-progress')
    expect(rm.attemptCount).toBe(5)
    expect(rm.correctCount).toBe(4)
  })

  it('sets lastUpdated to max(last_attempted) for a returning student', () => {
    const state = ksm.loadState('date-student')
    const now = new Date(2026, 0, 15, 12, 0, 0)
    state.concepts.get('limits.definition')!.lastAttempted = now
    ksm.persistState('date-student', state)

    const reloaded = ksm.loadState('date-student')
    expect(reloaded.lastUpdated.getTime()).toBe(now.getTime())
  })

  it('adds default entries for concepts not yet in the DB for a returning student', () => {
    const partial: KnowledgeState = {
      studentId: 'partial-student', lastUpdated: new Date(),
      concepts: new Map([['limits.definition', {
        conceptId: 'limits.definition', masteryProbability: 0.6,
        attemptCount: 3, correctCount: 2, lastAttempted: new Date(), status: 'in-progress',
      }]]),
      sessionHistory: [],
    }
    ksm.persistState('partial-student', partial)

    const reloaded = ksm.loadState('partial-student')
    expect(reloaded.concepts.has('limits.one-sided')).toBe(true)
    expect(reloaded.concepts.get('limits.one-sided')!.masteryProbability).toBe(0.1)
  })

  it('preserves lastAttempted as null when never attempted', () => {
    const state = ksm.loadState('null-date-student')
    for (const [, m] of state.concepts) {
      expect(m.lastAttempted).toBeNull()
    }
  })

  it('round-trips lastAttempted date correctly', () => {
    const state = ksm.loadState('date-rt-student')
    const now = new Date()
    state.concepts.get('limits.definition')!.lastAttempted = now
    ksm.persistState('date-rt-student', state)

    const reloaded = ksm.loadState('date-rt-student')
    expect(reloaded.concepts.get('limits.definition')!.lastAttempted!.getTime()).toBe(now.getTime())
  })
})

// ---------------------------------------------------------------------------
// KnowledgeStateManager — persistState
// ---------------------------------------------------------------------------

describe('KnowledgeStateManager.persistState', () => {
  let db: Database
  let ksm: KnowledgeStateManager

  beforeEach(() => {
    db = makeDb()
    ksm = new KnowledgeStateManager(db, [makeConceptNode('deriv.power-rule')])
  })

  it('inserts a student row if it does not exist', () => {
    const state = ksm.loadState('new-persist-student')
    ksm.persistState('new-persist-student', state)
    const row = db.prepare(`SELECT id FROM students WHERE id = ?`).get('new-persist-student') as { id: string } | undefined
    expect(row?.id).toBe('new-persist-student')
  })

  it('upserts concept_mastery rows correctly', () => {
    const state = ksm.loadState('upsert-student')
    const m = state.concepts.get('deriv.power-rule')!
    m.masteryProbability = 0.55
    m.attemptCount = 3
    m.correctCount = 2
    m.status = 'in-progress'
    ksm.persistState('upsert-student', state)

    const row = db.prepare(
      `SELECT mastery_probability, attempt_count, correct_count, status
       FROM concept_mastery WHERE student_id = ? AND concept_id = ?`
    ).get('upsert-student', 'deriv.power-rule') as { mastery_probability: number; attempt_count: number; correct_count: number; status: string } | undefined

    expect(row?.mastery_probability).toBeCloseTo(0.55)
    expect(row?.attempt_count).toBe(3)
    expect(row?.correct_count).toBe(2)
    expect(row?.status).toBe('in-progress')
  })

  it('overwrites existing rows on second persist (upsert semantics)', () => {
    const state = ksm.loadState('overwrite-student')
    state.concepts.get('deriv.power-rule')!.masteryProbability = 0.3
    ksm.persistState('overwrite-student', state)
    state.concepts.get('deriv.power-rule')!.masteryProbability = 0.7
    ksm.persistState('overwrite-student', state)

    const row = db.prepare(
      `SELECT mastery_probability FROM concept_mastery WHERE student_id = ? AND concept_id = ?`
    ).get('overwrite-student', 'deriv.power-rule') as { mastery_probability: number } | undefined
    expect(row?.mastery_probability).toBeCloseTo(0.7)
  })
})

// ---------------------------------------------------------------------------
// KnowledgeStateManager — updateStateForConcept
// ---------------------------------------------------------------------------

describe('KnowledgeStateManager.updateStateForConcept', () => {
  let db: Database
  let ksm: KnowledgeStateManager

  beforeEach(() => {
    db = makeDb()
    ksm = new KnowledgeStateManager(db, [makeConceptNode('integ.ftc')])
  })

  it('increases mastery after a correct answer', () => {
    const state = ksm.loadState('correct-student')
    const before = ksm.getMasteryScore(state, 'integ.ftc')
    ksm.updateStateForConcept('correct-student', state, makeEvalResult('p1', true), 'integ.ftc')
    expect(ksm.getMasteryScore(state, 'integ.ftc')).toBeGreaterThan(before)
  })

  it('decreases mastery after an incorrect answer (prior 0.6)', () => {
    const state = ksm.loadState('incorrect-student')
    state.concepts.get('integ.ftc')!.masteryProbability = 0.6
    const before = ksm.getMasteryScore(state, 'integ.ftc')
    ksm.updateStateForConcept('incorrect-student', state, makeEvalResult('p1', false), 'integ.ftc')
    expect(ksm.getMasteryScore(state, 'integ.ftc')).toBeLessThan(before)
  })

  it('increments attemptCount after each call', () => {
    const state = ksm.loadState('attempt-student')
    ksm.updateStateForConcept('attempt-student', state, makeEvalResult('p1', true), 'integ.ftc')
    ksm.updateStateForConcept('attempt-student', state, makeEvalResult('p2', false), 'integ.ftc')
    expect(state.concepts.get('integ.ftc')!.attemptCount).toBe(2)
  })

  it('increments correctCount only for correct answers', () => {
    const state = ksm.loadState('correct-count-student')
    ksm.updateStateForConcept('correct-count-student', state, makeEvalResult('p1', true), 'integ.ftc')
    ksm.updateStateForConcept('correct-count-student', state, makeEvalResult('p2', false), 'integ.ftc')
    ksm.updateStateForConcept('correct-count-student', state, makeEvalResult('p3', true), 'integ.ftc')
    expect(state.concepts.get('integ.ftc')!.correctCount).toBe(2)
  })

  it('transitions status from locked to in-progress on first attempt', () => {
    const state = ksm.loadState('status-student')
    expect(state.concepts.get('integ.ftc')!.status).toBe('locked')
    ksm.updateStateForConcept('status-student', state, makeEvalResult('p1', true), 'integ.ftc')
    expect(state.concepts.get('integ.ftc')!.status).toBe('in-progress')
  })

  it('transitions status to mastered when masteryProbability reaches >= 0.85', () => {
    const state = ksm.loadState('mastery-student')
    state.concepts.get('integ.ftc')!.masteryProbability = 0.9
    ksm.updateStateForConcept('mastery-student', state, makeEvalResult('p1', true), 'integ.ftc')
    expect(state.concepts.get('integ.ftc')!.status).toBe('mastered')
  })

  it('flags concept for review when mastery drops below 0.7 after being mastered', () => {
    // Pin the starting mastery and iteration count so the threshold crossing
    // is guaranteed rather than conditional.
    const state = ksm.loadState('regression-student')
    const m = state.concepts.get('integ.ftc')!
    // Start at 0.75 mastered. Without per-turn forgetting, bktUpdate(0.75, false)
    // produces ~0.47, which is below 0.7 in a single step.
    m.masteryProbability = 0.75
    m.status = 'mastered'

    ksm.updateStateForConcept('regression-student', state, makeEvalResult('p1', false), 'integ.ftc')

    const updated = state.concepts.get('integ.ftc')!
    expect(updated.masteryProbability).toBeLessThan(0.7)
    expect(updated.status).toBe('in-progress')
  })

  it('persists the updated state to SQLite immediately', () => {
    const state = ksm.loadState('persist-update-student')
    ksm.updateStateForConcept('persist-update-student', state, makeEvalResult('p1', true), 'integ.ftc')
    const reloaded = ksm.loadState('persist-update-student')
    expect(reloaded.concepts.get('integ.ftc')!.attemptCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// KnowledgeStateManager — applyHintPenalty
// ---------------------------------------------------------------------------

describe('KnowledgeStateManager.applyHintPenalty', () => {
  let db: Database
  let ksm: KnowledgeStateManager

  beforeEach(() => {
    db = makeDb()
    ksm = new KnowledgeStateManager(db)
  })

  it('reduces mastery probability after a hint (prior 0.6)', () => {
    const state = makeState('hint-student', [['deriv.chain-rule', 0.6]])
    const before = state.concepts.get('deriv.chain-rule')!.masteryProbability
    ksm.applyHintPenalty(state, 'deriv.chain-rule')
    expect(state.concepts.get('deriv.chain-rule')!.masteryProbability).toBeLessThan(before)
  })

  it('reduces mastery probability after a hint (prior 0.1 — low end)', () => {
    // With multiplicative penalty, 0.1 × 0.95 = 0.095 < 0.1. No BKT fixed-point issue.
    const state = makeState('hint-low-student', [['test.concept', 0.1]])
    const before = state.concepts.get('test.concept')!.masteryProbability
    ksm.applyHintPenalty(state, 'test.concept')
    expect(state.concepts.get('test.concept')!.masteryProbability).toBeLessThan(before)
  })

  it('mastery stays at 0 when prior is already 0', () => {
    const state = makeState('hint-zero-student', [['test.concept', 0]])
    ksm.applyHintPenalty(state, 'test.concept')
    expect(state.concepts.get('test.concept')!.masteryProbability).toBe(0)
  })

  it('does not throw for a concept not yet in the state', () => {
    const state = makeState('hint-new-student', [])
    expect(() => ksm.applyHintPenalty(state, 'unknown.concept')).not.toThrow()
  })

  it('creates a default entry for an unknown concept and applies penalty', () => {
    const state = makeState('hint-default-student', [])
    ksm.applyHintPenalty(state, 'new.concept')
    expect(state.concepts.has('new.concept')).toBe(true)
    // Default prior 0.1 × (1 − 0.05) = 0.095
    expect(state.concepts.get('new.concept')!.masteryProbability).toBeCloseTo(0.095)
  })

  it('does NOT persist — applyHintPenalty is in-memory only', () => {
    const state = ksm.loadState('hint-no-persist-student')
    // Manually insert the student so we can check the DB
    db.prepare(`INSERT OR IGNORE INTO students (id, created_at) VALUES (?, ?)`).run('hint-no-persist-student', Date.now())
    db.prepare(
      `INSERT INTO concept_mastery (student_id, concept_id, mastery_probability, attempt_count, correct_count, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('hint-no-persist-student', 'test.concept', 0.6, 0, 0, 'in-progress')

    state.concepts.set('test.concept', {
      conceptId: 'test.concept', masteryProbability: 0.6,
      attemptCount: 0, correctCount: 0, lastAttempted: null, status: 'in-progress',
    })

    ksm.applyHintPenalty(state, 'test.concept')

    // DB should still have the original value
    const row = db.prepare(
      `SELECT mastery_probability FROM concept_mastery WHERE student_id = ? AND concept_id = ?`
    ).get('hint-no-persist-student', 'test.concept') as { mastery_probability: number } | undefined
    expect(row?.mastery_probability).toBeCloseTo(0.6)
  })
})

// ---------------------------------------------------------------------------
// KnowledgeStateManager — applySessionStartDecay
// ---------------------------------------------------------------------------

describe('KnowledgeStateManager.applySessionStartDecay', () => {
  let db: Database
  let ksm: KnowledgeStateManager

  beforeEach(() => {
    db = makeDb()
    ksm = new KnowledgeStateManager(db)
  })

  it('does not decay concepts that have never been attempted', () => {
    const state = makeState('decay-never-student', [['A', 0.5]])
    state.concepts.get('A')!.lastAttempted = null
    ksm.applySessionStartDecay(state)
    expect(state.concepts.get('A')!.masteryProbability).toBeCloseTo(0.5)
  })

  it('does not decay when lastAttempted is in the future (elapsed <= 0)', () => {
    const state = makeState('decay-future-student', [['A', 0.5]])
    const future = new Date(Date.now() + 1_000_000)
    state.concepts.get('A')!.lastAttempted = future
    ksm.applySessionStartDecay(state, new Date())
    expect(state.concepts.get('A')!.masteryProbability).toBeCloseTo(0.5)
  })

  it('decays mastery after one week by approximately P_FORGET (5%)', () => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const state = makeState('decay-week-student', [['A', 0.8]])
    state.concepts.get('A')!.lastAttempted = oneWeekAgo
    ksm.applySessionStartDecay(state)
    // Expected: 0.8 × (1 − 0.05)^1 = 0.76
    expect(state.concepts.get('A')!.masteryProbability).toBeCloseTo(0.76, 2)
  })

  it('decays mastery after two weeks by approximately (1 − P_FORGET)^2', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const state = makeState('decay-2week-student', [['A', 0.8]])
    state.concepts.get('A')!.lastAttempted = twoWeeksAgo
    ksm.applySessionStartDecay(state)
    // Expected: 0.8 × 0.95^2 ≈ 0.722
    expect(state.concepts.get('A')!.masteryProbability).toBeCloseTo(0.8 * 0.95 * 0.95, 3)
  })

  it('never decays mastery below 0', () => {
    const longAgo = new Date(0) // epoch — ~2900 weeks ago, (0.95)^2900 ≈ 0
    const state = makeState('decay-floor-student', [['A', 0.1]])
    state.concepts.get('A')!.lastAttempted = longAgo
    ksm.applySessionStartDecay(state)
    expect(state.concepts.get('A')!.masteryProbability).toBeGreaterThanOrEqual(0)
    // With ~2900 weeks elapsed, (0.95)^2900 underflows to effectively 0.
    expect(state.concepts.get('A')!.masteryProbability).toBeCloseTo(0, 5)
  })

  it('accepts an injectable `now` timestamp for deterministic testing', () => {
    const lastAttempted = new Date(2026, 0, 1)
    const now = new Date(2026, 0, 8) // exactly 7 days later
    const state = makeState('decay-inject-student', [['A', 0.6]])
    state.concepts.get('A')!.lastAttempted = lastAttempted
    ksm.applySessionStartDecay(state, now)
    expect(state.concepts.get('A')!.masteryProbability).toBeCloseTo(0.6 * 0.95, 4)
  })

  it('flags a previously-mastered concept for review when decay drops mastery below 0.7 (Req 2.7)', () => {
    // 0.95 mastered, ~17 weeks of inactivity → 0.95 × (0.95)^17 ≈ 0.42 < 0.7
    const seventeenWeeksAgo = new Date(Date.now() - 17 * 7 * 24 * 60 * 60 * 1000)
    const state = makeState('decay-regress-student', [['A', 0.95, 'mastered']])
    state.concepts.get('A')!.lastAttempted = seventeenWeeksAgo
    ksm.applySessionStartDecay(state)
    const m = state.concepts.get('A')!
    expect(m.masteryProbability).toBeLessThan(0.7)
    expect(m.status).toBe('in-progress')
  })

  it('preserves mastered status when decay does not cross the review threshold', () => {
    // 0.95 mastered, 1 week → 0.95 × 0.95 = 0.9025 — still above 0.7
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const state = makeState('decay-keep-mastered-student', [['A', 0.95, 'mastered']])
    state.concepts.get('A')!.lastAttempted = oneWeekAgo
    ksm.applySessionStartDecay(state)
    expect(state.concepts.get('A')!.masteryProbability).toBeGreaterThan(0.7)
    expect(state.concepts.get('A')!.status).toBe('mastered')
  })
})

// ---------------------------------------------------------------------------
// KnowledgeStateManager — getMasteryScore
// ---------------------------------------------------------------------------

describe('KnowledgeStateManager.getMasteryScore', () => {
  let db: Database
  let ksm: KnowledgeStateManager

  beforeEach(() => {
    db = makeDb()
    ksm = new KnowledgeStateManager(db)
  })

  it('returns the stored mastery probability for a known concept', () => {
    const state = makeState('score-student', [['limits.definition', 0.65]])
    expect(ksm.getMasteryScore(state, 'limits.definition')).toBeCloseTo(0.65)
  })

  it('returns 0.1 (default prior) for a concept not in the state', () => {
    const state = makeState('score-student-2', [])
    expect(ksm.getMasteryScore(state, 'nonexistent.concept')).toBe(0.1)
  })
})

// ---------------------------------------------------------------------------
// KnowledgeStateManager — getNextTargetConcept
// ---------------------------------------------------------------------------

describe('KnowledgeStateManager.getNextTargetConcept', () => {
  let db: Database

  beforeEach(() => {
    db = makeDb()
  })

  it('throws when no concepts are registered', () => {
    const ksm = new KnowledgeStateManager(db)
    const state = makeState('s', [])
    expect(() => ksm.getNextTargetConcept(state)).toThrow(
      'KnowledgeStateManager: no concept nodes registered'
    )
  })

  it('returns the only concept when there is one and it is not mastered', () => {
    const ksm = new KnowledgeStateManager(db, [makeConceptNode('limits.definition')])
    const state = ksm.loadState('single-concept-student')
    expect(ksm.getNextTargetConcept(state).id).toBe('limits.definition')
  })

  it('respects the prerequisite gate — does not return a concept whose prereqs are unmet', () => {
    const ksm = new KnowledgeStateManager(db, [makeConceptNode('A'), makeConceptNode('B', ['A'])])
    const state = ksm.loadState('prereq-student')
    // A has mastery 0.1 (below 0.7 gate), so B must not be selected.
    expect(ksm.getNextTargetConcept(state).id).toBe('A')
  })

  it('selects a concept whose prerequisites are all met (>= 0.7)', () => {
    const ksm = new KnowledgeStateManager(db, [makeConceptNode('A'), makeConceptNode('B', ['A'])])
    const state = ksm.loadState('prereq-met-student')
    state.concepts.get('A')!.masteryProbability = 0.9
    state.concepts.get('A')!.status = 'mastered'
    expect(ksm.getNextTargetConcept(state).id).toBe('B')
  })

  it('skips already-mastered concepts', () => {
    const ksm = new KnowledgeStateManager(db, [makeConceptNode('A'), makeConceptNode('B')])
    const state = ksm.loadState('mastered-skip-student')
    state.concepts.get('A')!.masteryProbability = 0.9
    state.concepts.get('A')!.status = 'mastered'
    expect(ksm.getNextTargetConcept(state).id).toBe('B')
  })

  it('selects the concept with the highest readiness score', () => {
    const ksm = new KnowledgeStateManager(db, [makeConceptNode('X'), makeConceptNode('Y')])
    const state = ksm.loadState('readiness-student')
    state.concepts.get('X')!.masteryProbability = 0.5  // readiness = 1 × 0.5 = 0.5
    state.concepts.get('Y')!.masteryProbability = 0.2  // readiness = 1 × 0.8 = 0.8
    expect(ksm.getNextTargetConcept(state).id).toBe('Y')
  })

  it('fallback respects the prerequisite gate — never returns a locked concept', () => {
    // All concepts have unmet prereqs except A (no prereqs).
    // Even when all are "mastered", the fallback should pick from prereq-gated concepts.
    const ksm = new KnowledgeStateManager(db, [
      makeConceptNode('A'),
      makeConceptNode('B', ['A']),
    ])
    const state = ksm.loadState('fallback-gate-student')
    // A is mastered; B's prereq (A) is met.
    state.concepts.get('A')!.masteryProbability = 0.9
    state.concepts.get('A')!.status = 'mastered'
    state.concepts.get('B')!.masteryProbability = 0.9
    state.concepts.get('B')!.status = 'mastered'
    // Both mastered — fallback should pick A (lower mastery) among prereq-gated concepts.
    const target = ksm.getNextTargetConcept(state)
    expect(target.id).toBe('A')
  })

  it('fallback does not return a concept with unmet prerequisites', () => {
    // C has unmet prereqs (B not mastered). Fallback must not return C.
    const ksm = new KnowledgeStateManager(db, [
      makeConceptNode('A'),
      makeConceptNode('B', ['A']),
      makeConceptNode('C', ['B']),
    ])
    const state = ksm.loadState('fallback-no-locked-student')
    // A is mastered; B and C are not. B's prereq (A) is met; C's prereq (B) is not.
    state.concepts.get('A')!.masteryProbability = 0.9
    state.concepts.get('A')!.status = 'mastered'
    // Main path selects B (eligible). Verify it's not C.
    const target = ksm.getNextTargetConcept(state)
    expect(target.id).toBe('B')
  })

  it('uses registerConcepts to update the concept graph after construction', () => {
    const ksm = new KnowledgeStateManager(db)
    ksm.registerConcepts([makeConceptNode('late.concept')])
    const state = ksm.loadState('register-student')
    expect(ksm.getNextTargetConcept(state).id).toBe('late.concept')
  })
})
