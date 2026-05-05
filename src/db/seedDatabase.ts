/**
 * Database seed script for CalcuLearn.
 *
 * Inserts all problems from the curated data file into the local SQLite
 * database. All inserts use `INSERT OR IGNORE` so the script is idempotent —
 * safe to run multiple times without duplicating data.
 *
 * The FTS5 index is kept in sync automatically by the triggers defined in
 * schema.ts (problems_ai / problems_ad / problems_au). No manual rebuild is
 * needed after a normal seed run.
 *
 * Concept metadata is NOT stored in SQLite — the KSM and Problem Engine load
 * concepts from the in-memory CONCEPTS constant in src/data/concepts.ts.
 * Storing a redundant concepts table here would create a second source of
 * truth that could drift from the in-memory graph.
 *
 * Usage (run once before starting the app):
 *   npm run seed
 *
 * Requirements: 3.5, 7.2
 */

import { recoverOrCreate } from './database.js'
import { CONCEPT_MAP } from '../data/concepts.js'
import { PROBLEMS } from '../data/problems.js'
import type { Database } from 'better-sqlite3'
import type { Problem } from '../models/types.js'

// ---------------------------------------------------------------------------
// Default database path (overridable via DB_PATH env var)
// ---------------------------------------------------------------------------

const DB_PATH = process.env['DB_PATH'] ?? './data/calculearn.sqlite'

// ---------------------------------------------------------------------------
// validateProblems
// ---------------------------------------------------------------------------

/**
 * Verifies that every problem's conceptId exists in the concept graph.
 * Throws at seed time rather than silently inserting orphaned rows that
 * the Problem Engine would never return.
 */
function validateProblems(problems: readonly Problem[]): void {
  for (const problem of problems) {
    if (!CONCEPT_MAP.has(problem.conceptId)) {
      throw new TypeError(
        `[seed] Problem "${problem.id}" references unknown concept "${problem.conceptId}". ` +
        `Add the concept to src/data/concepts.ts or fix the conceptId.`
      )
    }
  }
}

// ---------------------------------------------------------------------------
// seedProblems
// ---------------------------------------------------------------------------

function seedProblems(db: Database, problems: readonly Problem[]): number {
  const insert = db.prepare<[string, string, string, string, string, string, string, string, number]>(`
    INSERT OR IGNORE INTO problems
      (id, concept_id, difficulty, type, stem,
       answer_json, solution_steps_json, misconceptions_json, is_generated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertAll = db.transaction(() => {
    let inserted = 0
    for (const problem of problems) {
      const result = insert.run(
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
      inserted += result.changes
    }
    return inserted
  })

  return insertAll()
}

// ---------------------------------------------------------------------------
// seedDatabase — main entry point
// ---------------------------------------------------------------------------

/**
 * Opens (or creates) the database at `dbPath`, runs the schema, validates
 * the problem data, and seeds problems. Returns a summary of rows inserted.
 *
 * @param dbPath - Path to the SQLite file (defaults to DB_PATH env var or
 *                 `./data/calculearn.sqlite`).
 */
export function seedDatabase(dbPath: string = DB_PATH): {
  problemsInserted: number
} {
  validateProblems(PROBLEMS)

  const db = recoverOrCreate(dbPath)

  console.log(`[seed] Seeding database at: ${dbPath}`)

  const problemsInserted = seedProblems(db, PROBLEMS)
  console.log(`[seed] Problems: ${problemsInserted} inserted (${PROBLEMS.length} total, duplicates skipped)`)

  db.close()
  return { problemsInserted }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

// Run when invoked directly: `tsx src/db/seedDatabase.ts`
const isMain = process.argv[1]?.endsWith('seedDatabase.ts') ||
               process.argv[1]?.endsWith('seedDatabase.js')

if (isMain) {
  const { problemsInserted } = seedDatabase()
  console.log(`[seed] Done. ${problemsInserted} problems inserted.`)
}
