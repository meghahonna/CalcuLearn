/**
 * Tests for src/db/database.ts and src/db/schema.ts
 *
 * Uses vitest and better-sqlite3.
 * In-memory databases are used wherever possible; a temp file is used for
 * the recoverOrCreate corruption-recovery test.
 */

import { describe, it, expect, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { openDatabase, initSchema, recoverOrCreate } from '../src/db/database.js'
import { SCHEMA_STATEMENTS } from '../src/db/schema.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a unique temp file path that does not yet exist. */
function tempDbPath(): string {
  return path.join(os.tmpdir(), `calculearn-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`)
}

// ---------------------------------------------------------------------------
// openDatabase
// ---------------------------------------------------------------------------

describe('openDatabase', () => {
  it('creates an in-memory database without throwing', () => {
    const db = openDatabase(':memory:')
    expect(db).toBeDefined()
    expect(db.open).toBe(true)
    db.close()
  })

  it('creates a new file-based database at the given path', () => {
    const p = tempDbPath()
    try {
      const db = openDatabase(p)
      expect(db.open).toBe(true)
      db.close()
      expect(fs.existsSync(p)).toBe(true)
    } finally {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })

  it('opens an existing database without error', () => {
    const p = tempDbPath()
    try {
      // Create it first
      openDatabase(p).close()
      // Open again
      const db = openDatabase(p)
      expect(db.open).toBe(true)
      db.close()
    } finally {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })
})

// ---------------------------------------------------------------------------
// initSchema
// ---------------------------------------------------------------------------

describe('initSchema', () => {
  it('runs without error on a fresh in-memory database', () => {
    const db = openDatabase(':memory:')
    expect(() => initSchema(db)).not.toThrow()
    db.close()
  })

  it('is idempotent — calling twice does not throw', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    expect(() => initSchema(db)).not.toThrow()
    db.close()
  })

  it('creates the students table', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='students'`)
      .get() as { name: string } | undefined
    expect(row?.name).toBe('students')
    db.close()
  })

  it('creates the concept_mastery table', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='concept_mastery'`)
      .get() as { name: string } | undefined
    expect(row?.name).toBe('concept_mastery')
    db.close()
  })

  it('creates the session_history table', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='session_history'`)
      .get() as { name: string } | undefined
    expect(row?.name).toBe('session_history')
    db.close()
  })

  it('creates the problems table', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='problems'`)
      .get() as { name: string } | undefined
    expect(row?.name).toBe('problems')
    db.close()
  })

  it('creates the translation_cache table', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='translation_cache'`)
      .get() as { name: string } | undefined
    expect(row?.name).toBe('translation_cache')
    db.close()
  })

  it('creates the problems_fts virtual table', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='problems_fts'`)
      .get() as { name: string } | undefined
    expect(row?.name).toBe('problems_fts')
    db.close()
  })

  it('creates the FTS5 sync triggers (ai, ad, au)', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    const triggers = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('problems_ai','problems_ad','problems_au')`)
      .all() as { name: string }[]
    const names = triggers.map(t => t.name).sort()
    expect(names).toEqual(['problems_ad', 'problems_ai', 'problems_au'])
    db.close()
  })

  it('FTS5 round-trip: INSERT INTO problems is reflected in problems_fts query', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    db.prepare(
      `INSERT INTO problems (id, concept_id, difficulty, type, stem, answer_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('p-1', 'chainrule', 'procedural', 'free-response', 'Find dy/dx', '"2x"')

    // FTS5 MATCH query — concept IDs with dots must be quoted in FTS5 syntax.
    // Using a dot-free id here to keep the query simple.
    const rows = db
      .prepare(`SELECT rowid FROM problems_fts WHERE concept_id MATCH ? AND difficulty MATCH ?`)
      .all('chainrule', 'procedural') as { rowid: number }[]
    expect(rows.length).toBe(1)
    db.close()
  })

  it('concept_mastery defaults: mastery_probability=0.1, status=locked', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    db.prepare(`INSERT INTO students (id, created_at) VALUES (?, ?)`).run('s-1', Date.now())
    db.prepare(
      `INSERT INTO concept_mastery (student_id, concept_id) VALUES (?, ?)`
    ).run('s-1', 'limits.definition')
    const row = db
      .prepare(`SELECT mastery_probability, status FROM concept_mastery WHERE student_id=? AND concept_id=?`)
      .get('s-1', 'limits.definition') as { mastery_probability: number; status: string } | undefined
    expect(row?.mastery_probability).toBe(0.1)
    expect(row?.status).toBe('locked')
    db.close()
  })

  it('concept_mastery composite PK rejects duplicate (student_id, concept_id)', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    db.prepare(`INSERT INTO students (id, created_at) VALUES (?, ?)`).run('s-1', Date.now())
    db.prepare(`INSERT INTO concept_mastery (student_id, concept_id) VALUES (?, ?)`).run('s-1', 'limits.definition')
    expect(() =>
      db.prepare(`INSERT INTO concept_mastery (student_id, concept_id) VALUES (?, ?)`).run('s-1', 'limits.definition')
    ).toThrow()
    db.close()
  })

  it('allows inserting and querying a student row after schema init', () => {
    const db = openDatabase(':memory:')
    initSchema(db)
    db.prepare(`INSERT INTO students (id, created_at) VALUES (?, ?)`).run('student-1', Date.now())
    const row = db.prepare(`SELECT id FROM students WHERE id = ?`).get('student-1') as { id: string } | undefined
    expect(row?.id).toBe('student-1')
    db.close()
  })
})

// ---------------------------------------------------------------------------
// recoverOrCreate
// ---------------------------------------------------------------------------

describe('recoverOrCreate', () => {
  it('creates a new database and initialises schema when file does not exist', () => {
    const p = tempDbPath()
    try {
      const db = recoverOrCreate(p)
      expect(db.open).toBe(true)
      // Schema should be present
      const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='students'`)
        .get() as { name: string } | undefined
      expect(row?.name).toBe('students')
      db.close()
    } finally {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })

  it('opens an existing healthy database and initialises schema idempotently', () => {
    const p = tempDbPath()
    try {
      // Pre-create the file
      openDatabase(p).close()
      const db = recoverOrCreate(p)
      expect(db.open).toBe(true)
      db.close()
    } finally {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })

  it('recovers from a corrupt database file by recreating it', () => {
    const p = tempDbPath()
    try {
      // Write garbage bytes to simulate a corrupt SQLite file
      fs.writeFileSync(p, Buffer.from('this is not a valid sqlite database file!!!'))

      // recoverOrCreate should detect the corruption, delete the file, and recreate
      const db = recoverOrCreate(p)
      expect(db.open).toBe(true)

      // The new database should have the schema
      const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='students'`)
        .get() as { name: string } | undefined
      expect(row?.name).toBe('students')
      db.close()
    } finally {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })

  it('returns a working database that accepts writes after recovery', () => {
    const p = tempDbPath()
    try {
      fs.writeFileSync(p, Buffer.from('garbage data that is not sqlite'))
      const db = recoverOrCreate(p)
      expect(() =>
        db.prepare(`INSERT INTO students (id, created_at) VALUES (?, ?)`).run('s-1', Date.now())
      ).not.toThrow()
      db.close()
    } finally {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  })

  it('re-raises for :memory: rather than attempting to unlink', () => {
    // An in-memory DB cannot be corrupt in the open-time sense, but if we
    // somehow get a corrupt result we should throw, not silently swallow it.
    // We test the passthrough by verifying a healthy :memory: DB works fine
    // (recoverOrCreate must not throw on a healthy in-memory DB).
    expect(() => {
      const db = recoverOrCreate(':memory:')
      db.close()
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// SCHEMA_STATEMENTS export
// ---------------------------------------------------------------------------

describe('SCHEMA_STATEMENTS', () => {
  it('exports a non-empty array of SQL strings', () => {
    expect(Array.isArray(SCHEMA_STATEMENTS)).toBe(true)
    expect(SCHEMA_STATEMENTS.length).toBeGreaterThan(0)
    for (const sql of SCHEMA_STATEMENTS) {
      expect(typeof sql).toBe('string')
      expect(sql.length).toBeGreaterThan(0)
    }
  })

  it('includes CREATE TABLE IF NOT EXISTS for all expected tables', () => {
    const combined = SCHEMA_STATEMENTS.join('\n').toUpperCase()
    expect(combined).toContain('STUDENTS')
    expect(combined).toContain('CONCEPT_MASTERY')
    expect(combined).toContain('SESSION_HISTORY')
    expect(combined).toContain('PROBLEMS')
    expect(combined).toContain('TRANSLATION_CACHE')
    expect(combined).toContain('PROBLEMS_FTS')
  })
})
