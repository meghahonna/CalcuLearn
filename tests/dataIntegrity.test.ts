/**
 * Data integrity tests for src/data/concepts.ts, src/data/problems.ts,
 * and src/db/seedDatabase.ts.
 *
 * These tests lock in the structural guarantees that the Problem Engine and
 * KSM depend on at runtime. They run fast (no I/O, no inference) and catch
 * typos and missing tiers at CI time rather than at runtime.
 */

import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { CONCEPTS, CONCEPT_MAP } from '../src/data/concepts.js'
import { PROBLEMS } from '../src/data/problems.js'
import { seedDatabase } from '../src/db/seedDatabase.js'
import { openDatabase, initSchema } from '../src/db/database.js'
import type { Problem } from '../src/models/types.js'

const ALL_DIFFICULTIES: Problem['difficulty'][] = [
  'conceptual', 'procedural', 'application', 'proof-sketch',
]

function tempDbPath(): string {
  return path.join(
    os.tmpdir(),
    `calculearn-seed-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
  )
}

function cleanupDb(p: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(`${p}${suffix}`)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }
}

// ---------------------------------------------------------------------------
// concepts.ts
// ---------------------------------------------------------------------------

describe('CONCEPTS — structure', () => {
  it('exports a non-empty array', () => {
    expect(CONCEPTS.length).toBeGreaterThan(0)
  })

  it('contains exactly 20 concepts', () => {
    expect(CONCEPTS.length).toBe(20)
  })

  it('covers all five CalculusTopic values', () => {
    const topics = new Set(CONCEPTS.map((c) => c.topic))
    expect(topics.has('limits')).toBe(true)
    expect(topics.has('continuity')).toBe(true)
    expect(topics.has('derivatives')).toBe(true)
    expect(topics.has('integrals')).toBe(true)
    expect(topics.has('ode')).toBe(true)
  })

  it('has no duplicate concept IDs', () => {
    const ids = CONCEPTS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('CONCEPT_MAP contains every concept', () => {
    for (const concept of CONCEPTS) {
      expect(CONCEPT_MAP.has(concept.id)).toBe(true)
    }
  })

  it('every prerequisite ID resolves to a known concept', () => {
    for (const concept of CONCEPTS) {
      for (const prereqId of concept.prerequisites) {
        expect(
          CONCEPT_MAP.has(prereqId),
          `Concept "${concept.id}" has unknown prereq "${prereqId}"`
        ).toBe(true)
      }
    }
  })

  it('limits.definition has no prerequisites (DAG root)', () => {
    const root = CONCEPT_MAP.get('limits.definition')
    expect(root).toBeDefined()
    expect(root!.prerequisites).toHaveLength(0)
  })

  it('prerequisite graph is acyclic (assertConceptDAG does not throw at import)', () => {
    // If the import succeeded without throwing, the DAG is acyclic.
    // This test just confirms the module loaded cleanly.
    expect(CONCEPTS.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// problems.ts — coverage
// ---------------------------------------------------------------------------

describe('PROBLEMS — coverage', () => {
  it('exports a non-empty array', () => {
    expect(PROBLEMS.length).toBeGreaterThan(0)
  })

  it('has no duplicate problem IDs', () => {
    const ids = PROBLEMS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every problem references a known concept', () => {
    for (const problem of PROBLEMS) {
      expect(
        CONCEPT_MAP.has(problem.conceptId),
        `Problem "${problem.id}" references unknown concept "${problem.conceptId}"`
      ).toBe(true)
    }
  })

  it('every concept has at least one problem per difficulty tier (Req 8.2)', () => {
    const byConceptAndDifficulty = new Map<string, Set<Problem['difficulty']>>()

    for (const problem of PROBLEMS) {
      if (!byConceptAndDifficulty.has(problem.conceptId)) {
        byConceptAndDifficulty.set(problem.conceptId, new Set())
      }
      byConceptAndDifficulty.get(problem.conceptId)!.add(problem.difficulty)
    }

    for (const concept of CONCEPTS) {
      const tiers = byConceptAndDifficulty.get(concept.id) ?? new Set()
      for (const tier of ALL_DIFFICULTIES) {
        expect(
          tiers.has(tier),
          `Concept "${concept.id}" is missing a "${tier}" problem`
        ).toBe(true)
      }
    }
  })

  it('every concept has at least 4 problems total', () => {
    const countByConcept = new Map<string, number>()
    for (const problem of PROBLEMS) {
      countByConcept.set(problem.conceptId, (countByConcept.get(problem.conceptId) ?? 0) + 1)
    }
    for (const concept of CONCEPTS) {
      expect(
        countByConcept.get(concept.id) ?? 0,
        `Concept "${concept.id}" has fewer than 4 problems`
      ).toBeGreaterThanOrEqual(4)
    }
  })
})

// ---------------------------------------------------------------------------
// problems.ts — answer types
// ---------------------------------------------------------------------------

describe('PROBLEMS — answer types', () => {
  it('explain-concept problems have answer.type = "text"', () => {
    const explainProblems = PROBLEMS.filter((p) => p.type === 'explain-concept')
    expect(explainProblems.length).toBeGreaterThan(0)
    for (const problem of explainProblems) {
      expect(
        problem.answer.type,
        `Problem "${problem.id}" (explain-concept) should have answer.type "text"`
      ).toBe('text')
    }
  })

  it('no problem has answer.type "symbolic" when the raw answer is a natural-language sentence', () => {
    const naturalLanguagePattern = /\b(and|or|No|Yes|removable|jump|infinite|mastered)\b/i
    for (const problem of PROBLEMS) {
      if (naturalLanguagePattern.test(problem.answer.raw)) {
        expect(
          problem.answer.type,
          `Problem "${problem.id}" has natural-language answer but type "symbolic"`
        ).not.toBe('symbolic')
      }
    }
  })

  it('all answer.type values are valid MathExpression types', () => {
    const validTypes = new Set(['symbolic', 'numeric', 'text'])
    for (const problem of PROBLEMS) {
      expect(
        validTypes.has(problem.answer.type),
        `Problem "${problem.id}" has invalid answer.type "${problem.answer.type}"`
      ).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// problems.ts — solution steps
// ---------------------------------------------------------------------------

describe('PROBLEMS — solution steps', () => {
  it('every problem has at least one solution step', () => {
    for (const problem of PROBLEMS) {
      expect(
        problem.solutionSteps.length,
        `Problem "${problem.id}" has no solution steps`
      ).toBeGreaterThan(0)
    }
  })

  it('solution step numbers are sequential starting from 1', () => {
    for (const problem of PROBLEMS) {
      problem.solutionSteps.forEach((step, i) => {
        expect(
          step.stepNumber,
          `Problem "${problem.id}" step ${i} has wrong stepNumber`
        ).toBe(i + 1)
      })
    }
  })
})

// ---------------------------------------------------------------------------
// seedDatabase.ts
// ---------------------------------------------------------------------------

describe('seedDatabase', () => {
  it('seeds a real SQLite file through the exported seedDatabase function', () => {
    const p = tempDbPath()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const first = seedDatabase(p)
      const second = seedDatabase(p)

      expect(first.problemsInserted).toBe(PROBLEMS.length)
      expect(second.problemsInserted).toBe(0)

      const db = openDatabase(p)
      const problemCount = (db.prepare(`SELECT count(*) as n FROM problems`).get() as { n: number }).n
      const ftsCount = (db.prepare(`SELECT count(*) as n FROM problems_fts`).get() as { n: number }).n
      db.close()

      expect(problemCount).toBe(PROBLEMS.length)
      expect(ftsCount).toBe(PROBLEMS.length)
    } finally {
      logSpy.mockRestore()
      cleanupDb(p)
    }
  })

  it('inserts all problems into an in-memory database', () => {
    const db = openDatabase(':memory:')
    initSchema(db)

    // Seed using the in-memory DB by temporarily overriding the path
    // (seedDatabase opens its own connection, so we test via the exported fn
    // with a temp file path — use :memory: via env var trick isn't possible,
    // so we test the insert logic directly instead)
    const insert = db.prepare<[string, string, string, string, string, string, string, string, number]>(`
      INSERT OR IGNORE INTO problems
        (id, concept_id, difficulty, type, stem,
         answer_json, solution_steps_json, misconceptions_json, is_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let inserted = 0
    const insertAll = db.transaction(() => {
      for (const problem of PROBLEMS) {
        const result = insert.run(
          problem.id, problem.conceptId, problem.difficulty, problem.type, problem.stem,
          JSON.stringify(problem.answer), JSON.stringify(problem.solutionSteps),
          JSON.stringify(problem.commonMisconceptions), problem.isGenerated ? 1 : 0
        )
        inserted += result.changes
      }
    })
    insertAll()

    expect(inserted).toBe(PROBLEMS.length)

    // Verify FTS5 index was populated by triggers
    const ftsCount = (db.prepare(`SELECT count(*) as n FROM problems_fts`).get() as { n: number }).n
    expect(ftsCount).toBe(PROBLEMS.length)

    db.close()
  })

  it('is idempotent — second seed inserts 0 rows', () => {
    const db = openDatabase(':memory:')
    initSchema(db)

    const insert = db.prepare<[string, string, string, string, string, string, string, string, number]>(`
      INSERT OR IGNORE INTO problems
        (id, concept_id, difficulty, type, stem,
         answer_json, solution_steps_json, misconceptions_json, is_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const runInserts = () => {
      let inserted = 0
      const tx = db.transaction(() => {
        for (const problem of PROBLEMS) {
          const result = insert.run(
            problem.id, problem.conceptId, problem.difficulty, problem.type, problem.stem,
            JSON.stringify(problem.answer), JSON.stringify(problem.solutionSteps),
            JSON.stringify(problem.commonMisconceptions), problem.isGenerated ? 1 : 0
          )
          inserted += result.changes
        }
      })
      tx()
      return inserted
    }

    const first = runInserts()
    const second = runInserts()

    expect(first).toBe(PROBLEMS.length)
    expect(second).toBe(0)

    db.close()
  })

  it('FTS5 query returns results for a known concept_id', () => {
    const db = openDatabase(':memory:')
    initSchema(db)

    const insert = db.prepare<[string, string, string, string, string, string, string, string, number]>(`
      INSERT OR IGNORE INTO problems
        (id, concept_id, difficulty, type, stem,
         answer_json, solution_steps_json, misconceptions_json, is_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const tx = db.transaction(() => {
      for (const problem of PROBLEMS) {
        insert.run(
          problem.id, problem.conceptId, problem.difficulty, problem.type, problem.stem,
          JSON.stringify(problem.answer), JSON.stringify(problem.solutionSteps),
          JSON.stringify(problem.commonMisconceptions), problem.isGenerated ? 1 : 0
        )
      }
    })
    tx()

    // FTS5 MATCH on concept_id — dots must be quoted in FTS5.
    // The stored concept_id is "limits.definition", not the generated problem ID slug.
    const rows = db.prepare(
      `SELECT p.id FROM problems p
       JOIN problems_fts fts ON p.rowid = fts.rowid
       WHERE fts.concept_id MATCH '"limits.definition"' AND fts.difficulty MATCH 'conceptual'`
    ).all() as { id: string }[]

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.id.startsWith('lim-definition-conceptual-'))).toBe(true)

    db.close()
  })
})
