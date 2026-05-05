/**
 * SQLite schema definitions for CalcuLearn.
 *
 * Exports the SQL strings for all tables and a `createSchema` function that
 * executes them idempotently using `CREATE TABLE IF NOT EXISTS` / `CREATE
 * VIRTUAL TABLE IF NOT EXISTS`.
 *
 * Requirements: 3.5, 7.2
 */

import type { Database } from 'better-sqlite3'

// ---------------------------------------------------------------------------
// Table DDL statements
// ---------------------------------------------------------------------------

/**
 * Stores one row per registered student.
 * `id` is a locally generated UUID (never a real-world identity).
 */
export const SQL_CREATE_STUDENTS = `
CREATE TABLE IF NOT EXISTS students (
  id         TEXT    PRIMARY KEY,
  created_at INTEGER NOT NULL
)
`.trim()

/**
 * Stores the BKT mastery record for every (student, concept) pair.
 * `status` is one of: 'locked' | 'available' | 'in-progress' | 'mastered'.
 */
export const SQL_CREATE_CONCEPT_MASTERY = `
CREATE TABLE IF NOT EXISTS concept_mastery (
  student_id          TEXT    NOT NULL,
  concept_id          TEXT    NOT NULL,
  mastery_probability REAL    NOT NULL DEFAULT 0.1,
  attempt_count       INTEGER NOT NULL DEFAULT 0,
  correct_count       INTEGER NOT NULL DEFAULT 0,
  last_attempted      INTEGER,
  status              TEXT    NOT NULL DEFAULT 'locked',
  PRIMARY KEY (student_id, concept_id)
)
`.trim()

/**
 * Stores one row per completed or in-progress session.
 * `turns_json` is a JSON-serialised array of TurnRecord objects.
 */
export const SQL_CREATE_SESSION_HISTORY = `
CREATE TABLE IF NOT EXISTS session_history (
  session_id TEXT    PRIMARY KEY,
  student_id TEXT    NOT NULL,
  start_time INTEGER NOT NULL,
  end_time   INTEGER,
  turns_json TEXT    NOT NULL DEFAULT '[]'
)
`.trim()

/**
 * Curated and generated problem bank.
 * JSON columns store structured data that does not need to be queried
 * individually at the SQL level.
 * `is_generated` is 0 (curated) or 1 (generated at runtime).
 */
export const SQL_CREATE_PROBLEMS = `
CREATE TABLE IF NOT EXISTS problems (
  id                   TEXT    PRIMARY KEY,
  concept_id           TEXT    NOT NULL,
  difficulty           TEXT    NOT NULL,
  type                 TEXT    NOT NULL,
  stem                 TEXT    NOT NULL,
  answer_json          TEXT    NOT NULL,
  solution_steps_json  TEXT    NOT NULL DEFAULT '[]',
  misconceptions_json  TEXT    NOT NULL DEFAULT '[]',
  is_generated         INTEGER NOT NULL DEFAULT 0
)
`.trim()

/**
 * LRU-backed persistent cache for NLLB-200 translation results.
 * `cache_key` is `${text}::${targetLanguage}`.
 */
export const SQL_CREATE_TRANSLATION_CACHE = `
CREATE TABLE IF NOT EXISTS translation_cache (
  cache_key       TEXT    PRIMARY KEY,
  translated_text TEXT    NOT NULL,
  created_at      INTEGER NOT NULL
)
`.trim()

/**
 * FTS5 virtual table for fast problem lookup by concept_id and difficulty.
 * Uses `content='problems'` so the full-text index mirrors the `problems` table
 * without duplicating the text columns.
 *
 * Because this is an external-content FTS5 table, it does NOT auto-update when
 * rows are inserted into `problems`. The three triggers below keep the index in
 * sync automatically.
 *
 * Requirements: 3.5, 9.4
 */
export const SQL_CREATE_PROBLEMS_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS problems_fts
USING fts5(
  concept_id,
  difficulty,
  content='problems',
  content_rowid='rowid'
)
`.trim()

/**
 * Trigger: keep problems_fts in sync after INSERT INTO problems.
 * Required because FTS5 external-content tables do not auto-update.
 */
export const SQL_CREATE_PROBLEMS_FTS_AI = `
CREATE TRIGGER IF NOT EXISTS problems_ai
AFTER INSERT ON problems BEGIN
  INSERT INTO problems_fts(rowid, concept_id, difficulty)
  VALUES (new.rowid, new.concept_id, new.difficulty);
END
`.trim()

/**
 * Trigger: keep problems_fts in sync after DELETE FROM problems.
 */
export const SQL_CREATE_PROBLEMS_FTS_AD = `
CREATE TRIGGER IF NOT EXISTS problems_ad
AFTER DELETE ON problems BEGIN
  INSERT INTO problems_fts(problems_fts, rowid, concept_id, difficulty)
  VALUES ('delete', old.rowid, old.concept_id, old.difficulty);
END
`.trim()

/**
 * Trigger: keep problems_fts in sync after UPDATE on problems.
 * Implemented as a delete of the old entry followed by an insert of the new.
 */
export const SQL_CREATE_PROBLEMS_FTS_AU = `
CREATE TRIGGER IF NOT EXISTS problems_au
AFTER UPDATE ON problems BEGIN
  INSERT INTO problems_fts(problems_fts, rowid, concept_id, difficulty)
  VALUES ('delete', old.rowid, old.concept_id, old.difficulty);
  INSERT INTO problems_fts(rowid, concept_id, difficulty)
  VALUES (new.rowid, new.concept_id, new.difficulty);
END
`.trim()

// ---------------------------------------------------------------------------
// Ordered list of all DDL statements
// ---------------------------------------------------------------------------

export const SCHEMA_STATEMENTS: readonly string[] = [
  SQL_CREATE_STUDENTS,
  SQL_CREATE_CONCEPT_MASTERY,
  SQL_CREATE_SESSION_HISTORY,
  SQL_CREATE_PROBLEMS,
  SQL_CREATE_TRANSLATION_CACHE,
  SQL_CREATE_PROBLEMS_FTS,
  SQL_CREATE_PROBLEMS_FTS_AI,
  SQL_CREATE_PROBLEMS_FTS_AD,
  SQL_CREATE_PROBLEMS_FTS_AU,
]

// ---------------------------------------------------------------------------
// createSchema
// ---------------------------------------------------------------------------

/**
 * Executes all `CREATE TABLE IF NOT EXISTS` / `CREATE VIRTUAL TABLE IF NOT
 * EXISTS` statements against the provided database connection.
 *
 * This function is idempotent: calling it multiple times on the same database
 * is safe and will not modify existing tables or data.
 *
 * @param db - An open `better-sqlite3` Database instance.
 */
export function createSchema(db: Database): void {
  for (const sql of SCHEMA_STATEMENTS) {
    db.exec(sql)
  }
}
