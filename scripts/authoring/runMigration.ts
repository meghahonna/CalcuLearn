/**
 * scripts/authoring/runMigration.ts
 *
 * Idempotent migration runner — thin CLI wrapper around the shared
 * `applyMigrations` function in src/db/migrations.ts.
 *
 * Both this CLI step and the auto-recovery path in recoverOrCreate()
 * use the SAME migration logic, so they can't drift out of sync.
 *
 * Run:   npx tsx scripts/authoring/runMigration.ts
 */

import BetterSqlite3 from 'better-sqlite3'
import { applyMigrations, MIGRATION_FILES, tableExists } from '../../src/db/migrations.js'

const DB_PATH = process.env['DB_PATH'] ?? './data/calculearn.sqlite'

function main(): void {
  console.log(`[migrate] Opening DB at ${DB_PATH}`)
  const db = new BetterSqlite3(DB_PATH)
  db.pragma('foreign_keys = ON')

  console.log(`[migrate] Applying migrations: ${MIGRATION_FILES.join(', ')}`)
  applyMigrations(db, { logger: console })

  console.log(`[migrate] Verifying tables`)
  const expected = [
    'concepts',
    'concept_explanations',
    'concept_examples',
    'concept_misconceptions',
    'concept_checks',
    'concept_deep_dives',
    'concept_applications',
    'student_concept_signals',
    'concept_visuals',
  ]
  for (const t of expected) {
    if (!tableExists(db, t)) {
      throw new Error(`Migration failed: table ${t} not created`)
    }
    console.log(`  ✓ ${t}`)
  }

  db.close()
  console.log(`[migrate] Done.`)
}

main()
