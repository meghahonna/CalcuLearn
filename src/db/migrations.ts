/**
 * src/db/migrations.ts
 *
 * Idempotent migration runner for CalcuLearn. Runs SQL files from the
 * migrations/ directory in order. Used by:
 *   1. scripts/authoring/runMigration.ts  — manual CLI step
 *   2. recoverOrCreate()                  — after auto-recovery from corruption
 *
 * All migrations must be safe to re-run:
 *   - Tables use `CREATE TABLE IF NOT EXISTS`
 *   - Indexes use `CREATE INDEX IF NOT EXISTS`
 *   - ALTER TABLE ADD COLUMN statements are guarded by columnExists()
 *
 * For migrations with ALTER TABLE statements (SQLite doesn't support
 * `IF NOT EXISTS` on ADD COLUMN), we filter them out and apply them
 * separately via addColumnIfMissing().
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Database } from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Default migrations directory — resolves relative to the compiled output
 * (dist/db/migrations.js → ../../migrations) AND the source location
 * (src/db/migrations.ts → ../../migrations) which both land at the repo root.
 */
const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'migrations')

/**
 * Migrations to run in order. Adding a new file here is the ONLY place
 * we need to register it — both the CLI runner and recoverOrCreate will
 * pick it up automatically.
 */
export const MIGRATION_FILES = [
  '002_concept_content.sql',
  '003_adaptive_signals.sql',
  '004_visuals.sql',
] as const

interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

function columnExists(db: Database, table: string, column: string): boolean {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
    return rows.some((r) => r.name === column)
  } catch {
    return false
  }
}

function tableExists(db: Database, table: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table) as { name: string } | undefined
  return !!row
}

function addColumnIfMissing(
  db: Database,
  table: string,
  column: string,
  ddl: string,
  logger: Pick<Console, 'log'> = console
): void {
  if (!tableExists(db, table)) {
    logger.log(`  - ${table}.${column}: parent table missing, skipping`)
    return
  }
  if (columnExists(db, table, column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  logger.log(`  + ${table}.${column}: added`)
}

/**
 * Run a single SQL file against the DB, stripping ALTER TABLE ADD COLUMN
 * statements (those are applied separately via addColumnIfMissing).
 *
 * Wrapped in a transaction so a partial-failure mid-file leaves the DB
 * in a consistent state.
 */
function runSqlFile(db: Database, fullPath: string, logger: Pick<Console, 'log' | 'warn'>): void {
  const raw = fs.readFileSync(fullPath, 'utf8')
  // Split off ALTER TABLE ADD COLUMN; everything else (CREATE TABLE IF NOT EXISTS,
  // CREATE INDEX IF NOT EXISTS) is idempotent and safe to exec wholesale.
  const lines = raw.split('\n')
  const filtered = lines
    .filter((l) => !/^\s*ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN/i.test(l))
    .join('\n')

  const tx = db.transaction(() => {
    db.exec(filtered)
  })
  try {
    tx()
  } catch (err) {
    logger.warn(`  ! ${path.basename(fullPath)}: ${(err as Error).message}`)
    throw err
  }
}

/**
 * Apply all known migrations to the given database. Idempotent.
 *
 * @param db - An open better-sqlite3 Database.
 * @param opts.migrationsDir - Override migrations directory (for tests).
 * @param opts.logger - Logger (defaults to console). Pass a no-op for silence.
 */
export function applyMigrations(
  db: Database,
  opts: {
    migrationsDir?: string
    logger?: Pick<Console, 'log' | 'warn'>
  } = {}
): void {
  const dir = opts.migrationsDir ?? DEFAULT_MIGRATIONS_DIR
  const logger = opts.logger ?? console

  for (const file of MIGRATION_FILES) {
    const full = path.join(dir, file)
    if (!fs.existsSync(full)) {
      logger.warn(`[migrations] missing: ${full} (skipping)`)
      continue
    }
    runSqlFile(db, full, logger)
  }

  // ALTER TABLE ADD COLUMN statements — must be applied AFTER the parent
  // tables exist (which by this point they do, either from createSchema()
  // earlier or from 002 above).
  addColumnIfMissing(db, 'concepts', 'track', "track TEXT CHECK(track IN ('AB','BC','BOTH')) DEFAULT 'BOTH'", logger)
  addColumnIfMissing(db, 'concepts', 'prerequisites', 'prerequisites TEXT', logger)
  addColumnIfMissing(db, 'concepts', 'one_liner', 'one_liner TEXT', logger)
  addColumnIfMissing(db, 'concepts', 'authoring_status',
    "authoring_status TEXT CHECK(authoring_status IN ('not_started','draft','reviewed','published')) DEFAULT 'not_started'", logger)
  addColumnIfMissing(db, 'problems', 'hint_progression_json', 'hint_progression_json TEXT', logger)
  addColumnIfMissing(db, 'problems', 'solution_steps_json', 'solution_steps_json TEXT', logger)
  addColumnIfMissing(db, 'problems', 'is_challenge', 'is_challenge INTEGER DEFAULT 0', logger)
  addColumnIfMissing(db, 'problems', 'application_context', 'application_context TEXT', logger)
}

// Re-exports for the CLI runner.
export { columnExists, tableExists, addColumnIfMissing }
