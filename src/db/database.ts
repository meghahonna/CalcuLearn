/**
 * Typed wrapper around `better-sqlite3` for CalcuLearn.
 *
 * Provides three public functions:
 *   - `openDatabase`   — opens or creates a SQLite file
 *   - `initSchema`     — runs schema migrations idempotently
 *   - `recoverOrCreate` — handles corrupt-DB errors by deleting and recreating
 *
 * Requirements: 7.4, 11.5
 */

import BetterSqlite3, { type Database } from 'better-sqlite3'
import * as fs from 'node:fs'
import { createSchema } from './schema.js'

// ---------------------------------------------------------------------------
// Error codes that indicate a corrupt or unreadable database file
// ---------------------------------------------------------------------------

const CORRUPT_ERROR_CODES = new Set([
  'SQLITE_CORRUPT',
  'SQLITE_NOTADB',
  'SQLITE_IOERR',
])

// ---------------------------------------------------------------------------
// openDatabase
// ---------------------------------------------------------------------------

/**
 * Opens an existing SQLite database file or creates a new one at `path`.
 *
 * Applies two hardening PRAGMAs on every connection:
 *   - `foreign_keys = ON`  — enforces FK constraints (off by default in SQLite)
 *   - `journal_mode = WAL` — improves concurrent read performance during writes
 *
 * For in-memory databases, pass `':memory:'` as the path.
 *
 * @param path - Filesystem path to the SQLite file, or `':memory:'`.
 * @returns An open `better-sqlite3` Database instance.
 */
export function openDatabase(path: string): Database {
  const db = new BetterSqlite3(path)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  return db
}

// ---------------------------------------------------------------------------
// initSchema
// ---------------------------------------------------------------------------

/**
 * Runs all `CREATE TABLE IF NOT EXISTS` / `CREATE VIRTUAL TABLE IF NOT EXISTS`
 * statements against `db`.
 *
 * This function is idempotent: it is safe to call multiple times on the same
 * database without modifying existing tables or data.
 *
 * @param db - An open `better-sqlite3` Database instance.
 */
export function initSchema(db: Database): void {
  createSchema(db)
}

// ---------------------------------------------------------------------------
// recoverOrCreate
// ---------------------------------------------------------------------------

/**
 * Opens the SQLite database at `path`, initialises the schema, and returns the
 * connection.
 *
 * If the database file is corrupt or unreadable (error codes `SQLITE_CORRUPT`,
 * `SQLITE_NOTADB`, or `SQLITE_IOERR`), the function:
 *   1. Logs the recovery event to `console.error` with a timestamp, the file
 *      path, and the original error message.
 *   2. Deletes the corrupt file using `fs.unlinkSync`.
 *   3. Creates a fresh database at the same path.
 *   4. Initialises the schema on the new database.
 *
 * For in-memory databases (`':memory:'`), corruption recovery is skipped
 * because there is no file to delete.
 *
 * @param path - Filesystem path to the SQLite file.
 * @returns An open, schema-initialised `better-sqlite3` Database instance.
 *
 * Requirements: 7.4, 11.5
 */
export function recoverOrCreate(path: string): Database {
  let db: Database

  /**
   * Attempt to open the database and run a full integrity check.
   * We treat two distinct failure modes as "corrupt":
   *
   *   1. Open-time error — `better-sqlite3` throws with a SQLite error code
   *      (e.g. SQLITE_NOTADB for a non-SQLite file, SQLITE_CORRUPT for a
   *      partially written file).
   *
   *   2. Integrity-check failure — the DB opens successfully but
   *      `PRAGMA integrity_check` returns rows whose value is not 'ok'.
   *      This catches subtly corrupt databases (truncated WAL, malformed
   *      index pages) that SQLite can still parse but whose data is
   *      unreliable.
   */
  const tryOpen = (): { db: Database; corrupt: boolean; errorMsg?: string } => {
    let opened: Database
    try {
      opened = openDatabase(path)
    } catch (err: unknown) {
      const sqliteErr = err as NodeJS.ErrnoException & { code?: string }
      const isCorrupt =
        sqliteErr.code !== undefined && CORRUPT_ERROR_CODES.has(sqliteErr.code)
      if (isCorrupt) {
        return { db: opened!, corrupt: true, errorMsg: `${sqliteErr.code}: ${sqliteErr.message}` }
      }
      throw err
    }

    // Read integrity_check result rows. A healthy DB returns a single row: { integrity_check: 'ok' }.
    // Any other result (multiple rows, or a value !== 'ok') indicates corruption.
    type IntegrityRow = { integrity_check: string }
    const rows = opened.pragma('integrity_check') as IntegrityRow[]
    const isOk = rows.length === 1 && rows[0]!.integrity_check === 'ok'
    if (!isOk) {
      const summary = rows.map(r => r.integrity_check).join('; ')
      opened.close()
      return { db: opened, corrupt: true, errorMsg: `integrity_check failed: ${summary}` }
    }

    return { db: opened, corrupt: false }
  }

  const result = tryOpen()

  if (result.corrupt) {
    if (path === ':memory:') {
      // In-memory databases cannot be deleted; re-raise as a plain error.
      throw new Error(`CalcuLearn: in-memory database is corrupt (${result.errorMsg})`)
    }

    // Log the recovery event with timestamp, path, and error details.
    console.error(
      `[${new Date().toISOString()}] CalcuLearn: corrupt database detected at "${path}" ` +
        `(${result.errorMsg}). Deleting and recreating the database file.`
    )

    // Delete the corrupt file.
    try {
      fs.unlinkSync(path)
    } catch (unlinkErr: unknown) {
      const ue = unlinkErr as NodeJS.ErrnoException
      if (ue.code !== 'ENOENT') {
        throw unlinkErr
      }
    }

    db = openDatabase(path)
  } else {
    db = result.db
  }

  initSchema(db)
  return db
}
