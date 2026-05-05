/**
 * Tests for src/components/problemEngine.ts
 *
 * Covers:
 *   - mastery → difficulty boundary mapping
 *   - FTS5-backed selection by target concept and difficulty
 *   - recency filtering for the last 5 turns
 *   - fallback variant generation and cache insert
 *   - weighted misconception sampling
 *   - Property 2: prerequisite gate
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { Database } from 'better-sqlite3'
import { initSchema, openDatabase } from '../src/db/database.js'
import {
  ProblemBankExhaustedError,
  ProblemEngine,
  PrerequisiteNotMetError,
  UnknownTargetConceptError,
  difficultyForMastery,
} from '../src/components/problemEngine.js'
import { CONCEPTS, CONCEPT_MAP } from '../src/data/concepts.js'
import { PROBLEMS } from '../src/data/problems.js'
import {
  DEFAULT_MASTERY_PRIOR,
  PREREQUISITE_MASTERY_THRESHOLD,
} from '../src/models/constants.js'
import type {
  ConceptMastery,
  ConceptNode,
  EvaluationResult,
  KnowledgeState,
  Misconception,
  Problem,
  ProblemTemplate,
  Session,
  TurnRecord,
} from '../src/models/types.js'

function makeDb(problems: readonly Problem[] = PROBLEMS): Database {
  const db = openDatabase(':memory:')
  initSchema(db)

  const insert = db.prepare<[string, string, string, string, string, string, string, string, number]>(`
    INSERT OR IGNORE INTO problems
      (id, concept_id, difficulty, type, stem,
       answer_json, solution_steps_json, misconceptions_json, is_generated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const tx = db.transaction(() => {
    for (const problem of problems) {
      insert.run(
        problem.id,
        problem.conceptId,
        problem.difficulty,
        problem.type,
        problem.stem,
        JSON.stringify(problem.answer),
        JSON.stringify(problem.solutionSteps),
        JSON.stringify(problem.commonMisconceptions),
        problem.isGenerated ? 1 : 0
      )
    }
  })
  tx()

  return db
}

function makeState(entries: Record<string, number>): KnowledgeState {
  const concepts = new Map<string, ConceptMastery>()
  for (const concept of CONCEPTS) {
    const masteryProbability = entries[concept.id] ?? DEFAULT_MASTERY_PRIOR
    concepts.set(concept.id, {
      conceptId: concept.id,
      masteryProbability,
      attemptCount: 0,
      correctCount: 0,
      lastAttempted: null,
      status: masteryProbability >= 0.85 ? 'mastered' : 'in-progress',
    })
  }
  return { studentId: 'student-1', concepts, lastUpdated: new Date(), sessionHistory: [] }
}

function readyEntriesFor(concept: ConceptNode, ownMastery: number): Record<string, number> {
  const entries: Record<string, number> = { [concept.id]: ownMastery }
  for (const prereq of concept.prerequisites) {
    entries[prereq] = PREREQUISITE_MASTERY_THRESHOLD
  }
  return entries
}

function makeSession(targetConcept: ConceptNode, turns: TurnRecord[] = []): Session {
  return {
    sessionId: 'session-1',
    studentId: 'student-1',
    startTime: new Date(),
    turns,
    currentProblem: null,
    hintCount: 0,
    targetConcept,
  }
}

function makeTurn(problem: Problem, misconceptions: Misconception[] = []): TurnRecord {
  const evaluationResult: EvaluationResult = {
    problemId: problem.id,
    isCorrect: false,
    partialCredit: 0,
    misconceptions,
    evaluationMethod: 'symbolic',
    rawAnswer: '',
    parsedAnswer: null,
    feedbackHints: [],
  }

  return {
    turnId: `turn-${problem.id}`,
    problem,
    rawAnswer: '',
    evaluationResult,
    feedbackShown: '',
    hintsUsed: 0,
    durationMs: 1000,
  }
}

describe('difficultyForMastery', () => {
  it('maps boundary values exactly as Req 3.1 specifies', () => {
    expect(difficultyForMastery(0)).toBe('conceptual')
    expect(difficultyForMastery(0.299999)).toBe('conceptual')
    expect(difficultyForMastery(0.3)).toBe('procedural')
    expect(difficultyForMastery(0.599999)).toBe('procedural')
    expect(difficultyForMastery(0.6)).toBe('application')
    expect(difficultyForMastery(0.799999)).toBe('application')
    expect(difficultyForMastery(0.8)).toBe('proof-sketch')
    expect(difficultyForMastery(1)).toBe('proof-sketch')
  })
})

describe('ProblemEngine.selectNextProblem', () => {
  it('selects a problem matching the target concept and mastery-derived difficulty', async () => {
    const db = makeDb()
    const target = CONCEPT_MAP.get('deriv.power-rule')!
    const engine = new ProblemEngine(db, CONCEPTS, { rng: () => 0 })
    const state = makeState(readyEntriesFor(target, 0.65))

    const problem = await engine.selectNextProblem(state, makeSession(target))

    expect(problem.conceptId).toBe('deriv.power-rule')
    expect(problem.difficulty).toBe('application')
    db.close()
  })

  it('selects proof-sketch problems at mastery 0.8 despite the hyphenated FTS term', async () => {
    const db = makeDb()
    const target = CONCEPT_MAP.get('limits.definition')!
    const engine = new ProblemEngine(db, CONCEPTS, { rng: () => 0 })
    const state = makeState(readyEntriesFor(target, 0.8))

    const problem = await engine.selectNextProblem(state, makeSession(target))

    expect(problem.conceptId).toBe(target.id)
    expect(problem.difficulty).toBe('proof-sketch')
    db.close()
  })

  it('excludes the most recent 5 problem IDs when alternatives exist', async () => {
    const db = makeDb()
    const target = CONCEPT_MAP.get('limits.definition')!
    const engine = new ProblemEngine(db, CONCEPTS, { rng: () => 0 })
    const state = makeState(readyEntriesFor(target, 0.3))
    const procedural = PROBLEMS.filter((problem) =>
      problem.conceptId === target.id && problem.difficulty === 'procedural'
    )

    const session = makeSession(target, [
      makeTurn(PROBLEMS.find((problem) => problem.conceptId === 'limits.one-sided')!),
      makeTurn(procedural[0]),
    ])

    const problem = await engine.selectNextProblem(state, session)

    expect(problem.id).toBe(procedural[1].id)
    db.close()
  })

  it('generates and caches a variant when all candidates are recent', async () => {
    const target = CONCEPT_MAP.get('limits.one-sided')!
    const conceptual = PROBLEMS.find((problem) =>
      problem.conceptId === target.id && problem.difficulty === 'conceptual'
    )!
    const db = makeDb([conceptual])
    const generated: Problem = {
      ...conceptual,
      id: 'generated-limits-one-sided-conceptual',
      stem: 'Generated variant stem',
      isGenerated: false,
    }
    const dialogueGenerator = {
      async generateProblemVariant(template: ProblemTemplate): Promise<Problem> {
        expect(template.conceptId).toBe(target.id)
        return generated
      },
    }
    const engine = new ProblemEngine(db, CONCEPTS, { dialogueGenerator })
    const state = makeState(readyEntriesFor(target, 0.1))

    const problem = await engine.selectNextProblem(
      state,
      makeSession(target, [makeTurn(conceptual)])
    )

    expect(problem.id).toBe(generated.id)
    expect(problem.isGenerated).toBe(true)
    const row = db
      .prepare(`SELECT is_generated FROM problems WHERE id = ?`)
      .get(generated.id) as { is_generated: number } | undefined
    expect(row?.is_generated).toBe(1)
    db.close()
  })

  it('prioritises candidates whose misconceptions overlap active misconceptions', async () => {
    const db = makeDb()
    const target = CONCEPT_MAP.get('limits.definition')!
    const engine = new ProblemEngine(db, CONCEPTS, { rng: () => 0.6 })
    const state = makeState(readyEntriesFor(target, 0.3))
    const boosted = PROBLEMS.find((problem) => problem.id === 'lim-definition-procedural-7ppnj')!
    const other = PROBLEMS.find((problem) =>
      problem.conceptId === target.id &&
      problem.difficulty === 'procedural' &&
      problem.id !== boosted.id
    )!

    const problem = await engine.selectNextProblem(
      state,
      makeSession(target, [makeTurn(other, boosted.commonMisconceptions)])
    )

    expect(problem.id).toBe(boosted.id)
    db.close()
  })

  it('throws instead of returning a problem when target prerequisites are unmet', async () => {
    const db = makeDb()
    const target = CONCEPT_MAP.get('deriv.chain-rule')!
    const engine = new ProblemEngine(db, CONCEPTS)
    const state = makeState({ [target.id]: 0.5, 'deriv.product-rule': 0.69 })

    await expect(engine.selectNextProblem(state, makeSession(target))).rejects.toBeInstanceOf(
      PrerequisiteNotMetError
    )
    db.close()
  })

  it('throws when the session target concept is not registered in the engine graph', async () => {
    const db = makeDb()
    const target = CONCEPT_MAP.get('limits.definition')!
    const staleTarget: ConceptNode = { ...target, id: 'limits.stale-definition' }
    const engine = new ProblemEngine(db, CONCEPTS)
    const state = makeState({ [staleTarget.id]: 0.1 })

    await expect(engine.selectNextProblem(state, makeSession(staleTarget))).rejects.toBeInstanceOf(
      UnknownTargetConceptError
    )
    db.close()
  })

  it('ignores active misconceptions outside the configured misconception window', async () => {
    const db = makeDb()
    const target = CONCEPT_MAP.get('limits.definition')!
    const engine = new ProblemEngine(db, CONCEPTS, { rng: () => 0.6, misconceptionWindow: 1 })
    const state = makeState(readyEntriesFor(target, 0.3))
    const boosted = PROBLEMS.find((problem) => problem.id === 'lim-definition-procedural-7ppnj')!
    const other = PROBLEMS.find((problem) =>
      problem.conceptId === target.id &&
      problem.difficulty === 'procedural' &&
      problem.id !== boosted.id
    )!
    const unrelated = PROBLEMS.find((problem) => problem.conceptId === 'limits.one-sided')!

    const problem = await engine.selectNextProblem(
      state,
      makeSession(target, [
        makeTurn(unrelated, boosted.commonMisconceptions),
        makeTurn(unrelated, []),
      ])
    )

    expect(problem.id).toBe(other.id)
    db.close()
  })

  it('keeps misconception IDs and remediation concept IDs in separate namespaces', async () => {
    const collisionConceptId = 'limits.definition'
    const misconception: Misconception = {
      id: collisionConceptId,
      description: 'Deliberate namespace collision',
      incorrectPattern: 'collision',
      remediationConceptId: 'limits.one-sided',
    }
    const matchingProblem: Problem = {
      ...PROBLEMS.find((problem) => problem.conceptId === collisionConceptId && problem.difficulty === 'procedural')!,
      id: 'namespace-collision-matching-problem',
      commonMisconceptions: [misconception],
    }
    const otherProblem: Problem = {
      ...matchingProblem,
      id: 'namespace-collision-other-problem',
      commonMisconceptions: [],
    }
    const db = makeDb([matchingProblem, otherProblem])
    const target = CONCEPT_MAP.get(collisionConceptId)!
    const engine = new ProblemEngine(db, CONCEPTS, { rng: () => 0.6 })
    const state = makeState(readyEntriesFor(target, 0.3))
    const unrelated = PROBLEMS.find((problem) => problem.conceptId === 'limits.one-sided')!
    const activeDifferentNamespace: Misconception = {
      id: 'different-misconception',
      description: 'Only the remediation concept collides with the problem misconception ID',
      incorrectPattern: 'different',
      remediationConceptId: collisionConceptId,
    }

    const problem = await engine.selectNextProblem(
      state,
      makeSession(target, [makeTurn(unrelated, [activeDifferentNamespace])])
    )

    expect(problem.id).toBe(otherProblem.id)
    db.close()
  })

  it('throws ProblemBankExhaustedError when all candidates are recent and no generator is configured', async () => {
    const target = CONCEPT_MAP.get('limits.one-sided')!
    const conceptual = PROBLEMS.find((problem) =>
      problem.conceptId === target.id && problem.difficulty === 'conceptual'
    )!
    const db = makeDb([conceptual])
    const engine = new ProblemEngine(db, CONCEPTS)
    const state = makeState(readyEntriesFor(target, 0.1))

    await expect(
      engine.selectNextProblem(state, makeSession(target, [makeTurn(conceptual)]))
    ).rejects.toBeInstanceOf(ProblemBankExhaustedError)
    db.close()
  })

  it('uses an empty template when the database has no problem for the target slice', async () => {
    const target = CONCEPT_MAP.get('limits.definition')!
    const db = makeDb([])
    const generated: Problem = {
      ...PROBLEMS.find((problem) => problem.conceptId === target.id)!,
      id: 'generated-empty-template-problem',
      difficulty: 'conceptual',
      isGenerated: false,
    }
    const engine = new ProblemEngine(db, CONCEPTS, {
      dialogueGenerator: {
        async generateProblemVariant(template: ProblemTemplate): Promise<Problem> {
          expect(template.id).toBe('limits.definition-conceptual-empty-template')
          expect(template.parameterRanges).toEqual({})
          return generated
        },
      },
    })
    const state = makeState(readyEntriesFor(target, 0.1))

    const problem = await engine.selectNextProblem(state, makeSession(target))

    expect(problem.id).toBe(generated.id)
    expect(problem.isGenerated).toBe(true)
    db.close()
  })

  it('overrides an incorrectly returned generated difficulty before caching', async () => {
    const target = CONCEPT_MAP.get('limits.one-sided')!
    const conceptual = PROBLEMS.find((problem) =>
      problem.conceptId === target.id && problem.difficulty === 'conceptual'
    )!
    const db = makeDb([conceptual])
    const generated: Problem = {
      ...conceptual,
      id: 'generated-wrong-difficulty',
      difficulty: 'proof-sketch',
      isGenerated: false,
    }
    const engine = new ProblemEngine(db, CONCEPTS, {
      dialogueGenerator: {
        async generateProblemVariant(): Promise<Problem> {
          return generated
        },
      },
    })
    const state = makeState(readyEntriesFor(target, 0.1))

    const problem = await engine.selectNextProblem(
      state,
      makeSession(target, [makeTurn(conceptual)])
    )
    const row = db
      .prepare(`SELECT difficulty FROM problems WHERE id = ?`)
      .get(generated.id) as { difficulty: string } | undefined

    expect(problem.difficulty).toBe('conceptual')
    expect(row?.difficulty).toBe('conceptual')
    db.close()
  })

  it('can retrieve a cached generated variant in a later engine instance', async () => {
    const target = CONCEPT_MAP.get('limits.one-sided')!
    const conceptual = PROBLEMS.find((problem) =>
      problem.conceptId === target.id && problem.difficulty === 'conceptual'
    )!
    const db = makeDb([conceptual])
    const generated: Problem = {
      ...conceptual,
      id: 'generated-cross-session-cache',
      stem: 'Cached generated problem',
      isGenerated: false,
    }
    const state = makeState(readyEntriesFor(target, 0.1))
    const firstEngine = new ProblemEngine(db, CONCEPTS, {
      dialogueGenerator: {
        async generateProblemVariant(): Promise<Problem> {
          return generated
        },
      },
    })

    await firstEngine.selectNextProblem(state, makeSession(target, [makeTurn(conceptual)]))

    const secondEngine = new ProblemEngine(db, CONCEPTS, { rng: () => 0 })
    const problem = await secondEngine.selectNextProblem(
      state,
      makeSession(target, [makeTurn(conceptual)])
    )

    expect(problem.id).toBe(generated.id)
    expect(problem.isGenerated).toBe(true)
    db.close()
  })
})

describe('ProblemEngine.getSolutionSteps', () => {
  it('returns the problem solution steps unchanged', () => {
    const db = makeDb()
    const engine = new ProblemEngine(db, CONCEPTS)
    const problem = PROBLEMS[0]

    expect(engine.getSolutionSteps(problem)).toBe(problem.solutionSteps)
    db.close()
  })
})

describe('Property 2: prerequisite gate', () => {
  it('never returns a problem whose prerequisites are below mastery 0.7', async () => {
    const db = makeDb()
    const engine = new ProblemEngine(db, CONCEPTS, { rng: () => 0 })
    const nonRootConcepts = CONCEPTS.filter((concept) => concept.prerequisites.length > 0)

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...nonRootConcepts),
        fc.float({ min: 0, max: Math.fround(0.699), noNaN: true }),
        async (target, lowPrereqMastery) => {
          const entries = readyEntriesFor(target, 0.5)
          entries[target.prerequisites[0]] = lowPrereqMastery
          const state = makeState(entries)

          await expect(
            engine.selectNextProblem(state, makeSession(target))
          ).rejects.toBeInstanceOf(PrerequisiteNotMetError)
        }
      ),
      { numRuns: 100 }
    )

    db.close()
  })
})
