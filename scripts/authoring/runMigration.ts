/**
 * scripts/authoring/runMigration.ts
 *
 * Idempotent migration runner for the Phase A (concept content layer) schema.
 *
 * Steps:
 *   1. Open the SQLite DB (path from DB_PATH env or ./data/calculearn.sqlite).
 *   2. Run migrations/002_concept_content.sql (CREATE TABLE IF NOT EXISTS only).
 *   3. Conditionally apply ALTER TABLE statements on `problems` only if the
 *      column does not already exist (SQLite ADD COLUMN is not idempotent).
 *
 * Run:   npx tsx scripts/authoring/runMigration.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = process.env['DB_PATH'] ?? './data/calculearn.sqlite'
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations')

/** Migrations to run, in order. CREATE TABLE IF NOT EXISTS only — idempotent. */
const MIGRATIONS = [
  '002_concept_content.sql',
  '003_adaptive_signals.sql',
  '004_visuals.sql',
]

interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

function columnExists(db: BetterSqlite3.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
  return rows.some((r) => r.name === column)
}

function addColumnIfMissing(
  db: BetterSqlite3.Database,
  table: string,
  column: string,
  ddl: string
): void {
  if (columnExists(db, table, column)) {
    console.log(`  - ${table}.${column}: already exists, skipping`)
    return
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  console.log(`  + ${table}.${column}: added`)
}

function tableExists(db: BetterSqlite3.Database, table: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table) as { name: string } | undefined
  return !!row
}

function main(): void {
  console.log(`[migrate] Opening ${DB_PATH}`)
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  }

  const db = new BetterSqlite3(DB_PATH)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')

  // --- Step 1: run each migration SQL file in order ---
  for (const filename of MIGRATIONS) {
    const fullPath = path.resolve(MIGRATIONS_DIR, filename)
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Migration file not found: ${fullPath}`)
    }
    const sql = fs.readFileSync(fullPath, 'utf8')
    console.log(`[migrate] Executing ${filename}`)
    db.exec(sql)
  }

  // --- Step 2: idempotent ALTER TABLE on problems ---
  console.log(`[migrate] Checking problems table additions`)
  if (!tableExists(db, 'problems')) {
    console.warn(
      `  ! problems table does not exist yet. Run \`npm run seed\` first ` +
      `to create the base schema, then re-run this migration.`
    )
  } else {
    addColumnIfMissing(db, 'problems', 'hint_progression_json', 'hint_progression_json TEXT')
    addColumnIfMissing(db, 'problems', 'is_challenge', 'is_challenge INTEGER DEFAULT 0')
    addColumnIfMissing(db, 'problems', 'application_context', 'application_context TEXT')
  }

  // --- Verification ---
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
