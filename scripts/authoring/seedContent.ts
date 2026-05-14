/**
 * scripts/authoring/seedContent.ts
 *
 * Loads every JSON file in content/concepts/ and upserts the rows into
 * SQLite. Idempotent — re-running wipes a concept's child rows and
 * re-inserts them, so JSON is the single source of truth.
 *
 * Also seeds the `concepts` base table from src/data/concepts.ts so
 * that authored content has rows to FK to.
 *
 * Run:  npx tsx scripts/authoring/seedContent.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { CONCEPTS } from '../../src/data/concepts.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = process.env['DB_PATH'] ?? './data/calculearn.sqlite'
const CONTENT_DIR = path.resolve(__dirname, '../../content/concepts')

interface ConceptJson {
  concept_id: string
  name: string
  track: 'AB' | 'BC' | 'BOTH'
  one_liner: string
  prerequisites: string[]
  explanations: Array<{
    tier: string
    framing_index: number
    body_md: string
    intuition_md?: string
  }>
  examples: Array<{
    tier: string
    problem_md: string
    steps: Array<{ step_md: string; why_md: string }>
  }>
  misconceptions: Array<{
    short_name: string
    description_md: string
    why_wrong_md: string
    socratic_response_md: string
  }>
  checks: Array<{
    tier: string
    question_md: string
    expected_answer_md: string
    expected_pattern?: string
    misconception_short_name_if_wrong?: string
  }>
  deep_dives: Array<{ title: string; body_md: string }>
  applications: Array<{
    context?: string
    problem_md: string
    solution_outline_md: string
  }>
}

// ---------------------------------------------------------------------------
// Open DB
// ---------------------------------------------------------------------------

const db = new BetterSqlite3(DB_PATH)
db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')

// ---------------------------------------------------------------------------
// Step 1: seed the `concepts` base table from CONCEPTS in src/data
// ---------------------------------------------------------------------------

function seedConceptsTable(): void {
  const upsert = db.prepare(`
    INSERT INTO concepts (id, name, topic, difficulty, description)
    VALUES (@id, @name, @topic, @difficulty, @description)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      topic = excluded.topic,
      difficulty = excluded.difficulty,
      description = excluded.description
  `)
  const tx = db.transaction(() => {
    for (const c of CONCEPTS) {
      upsert.run({
        id: c.id,
        name: c.name,
        topic: c.topic,
        difficulty: c.difficulty,
        description: c.description,
      })
    }
  })
  tx()
  console.log(`[seed] Upserted ${CONCEPTS.length} rows into concepts`)
}

// ---------------------------------------------------------------------------
// Step 2: seed authored content from JSON files
// ---------------------------------------------------------------------------

const stmts = {
  upsertConceptMeta: db.prepare(`
    UPDATE concepts SET
      track = @track,
      prerequisites_json = @prerequisites_json,
      one_liner = @one_liner,
      authoring_status = 'draft'
    WHERE id = @concept_id
  `),
  clearChildren: {
    explanations: db.prepare('DELETE FROM concept_explanations WHERE concept_id = ?'),
    examples: db.prepare('DELETE FROM concept_examples WHERE concept_id = ?'),
    misconceptions: db.prepare('DELETE FROM concept_misconceptions WHERE concept_id = ?'),
    checks: db.prepare('DELETE FROM concept_checks WHERE concept_id = ?'),
    deep_dives: db.prepare('DELETE FROM concept_deep_dives WHERE concept_id = ?'),
    applications: db.prepare('DELETE FROM concept_applications WHERE concept_id = ?'),
  },
  insertExplanation: db.prepare(`
    INSERT INTO concept_explanations
      (concept_id, tier, framing_index, body_md, intuition_md)
    VALUES
      (@concept_id, @tier, @framing_index, @body_md, @intuition_md)
  `),
  insertExample: db.prepare(`
    INSERT INTO concept_examples
      (concept_id, tier, problem_md, steps_json)
    VALUES
      (@concept_id, @tier, @problem_md, @steps_json)
  `),
  insertMisconception: db.prepare(`
    INSERT INTO concept_misconceptions
      (concept_id, short_name, description_md, why_wrong_md, socratic_response_md)
    VALUES
      (@concept_id, @short_name, @description_md, @why_wrong_md, @socratic_response_md)
  `),
  insertCheck: db.prepare(`
    INSERT INTO concept_checks
      (concept_id, tier, question_md, expected_answer_md, expected_pattern, misconception_id_if_wrong)
    VALUES
      (@concept_id, @tier, @question_md, @expected_answer_md, @expected_pattern, @misconception_id)
  `),
  insertDeepDive: db.prepare(`
    INSERT INTO concept_deep_dives
      (concept_id, title, body_md)
    VALUES
      (@concept_id, @title, @body_md)
  `),
  insertApplication: db.prepare(`
    INSERT INTO concept_applications
      (concept_id, context, problem_md, solution_outline_md)
    VALUES
      (@concept_id, @context, @problem_md, @solution_outline_md)
  `),
  findMisconceptionId: db.prepare(`
    SELECT id FROM concept_misconceptions WHERE concept_id = ? AND short_name = ?
  `),
}

function seedContentFile(c: ConceptJson): void {
  const tx = db.transaction(() => {
    // Update concept meta with authored fields
    stmts.upsertConceptMeta.run({
      concept_id: c.concept_id,
      track: c.track,
      prerequisites_json: JSON.stringify(c.prerequisites),
      one_liner: c.one_liner,
    })

    // Wipe children for full reproducibility
    Object.values(stmts.clearChildren).forEach((s) => s.run(c.concept_id))

    // Insert children
    for (const e of c.explanations) {
      stmts.insertExplanation.run({
        concept_id: c.concept_id,
        tier: e.tier,
        framing_index: e.framing_index,
        body_md: e.body_md,
        intuition_md: e.intuition_md ?? null,
      })
    }
    for (const ex of c.examples) {
      stmts.insertExample.run({
        concept_id: c.concept_id,
        tier: ex.tier,
        problem_md: ex.problem_md,
        steps_json: JSON.stringify(ex.steps),
      })
    }
    for (const m of c.misconceptions) {
      stmts.insertMisconception.run({
        concept_id: c.concept_id,
        short_name: m.short_name,
        description_md: m.description_md,
        why_wrong_md: m.why_wrong_md,
        socratic_response_md: m.socratic_response_md,
      })
    }
    for (const ch of c.checks) {
      let miscId: number | null = null
      if (ch.misconception_short_name_if_wrong) {
        const row = stmts.findMisconceptionId.get(
          c.concept_id,
          ch.misconception_short_name_if_wrong
        ) as { id: number } | undefined
        miscId = row?.id ?? null
      }
      stmts.insertCheck.run({
        concept_id: c.concept_id,
        tier: ch.tier,
        question_md: ch.question_md,
        expected_answer_md: ch.expected_answer_md,
        expected_pattern: ch.expected_pattern ?? null,
        misconception_id: miscId,
      })
    }
    for (const d of c.deep_dives) {
      stmts.insertDeepDive.run({
        concept_id: c.concept_id,
        title: d.title,
        body_md: d.body_md,
      })
    }
    for (const a of c.applications) {
      stmts.insertApplication.run({
        concept_id: c.concept_id,
        context: a.context ?? null,
        problem_md: a.problem_md,
        solution_outline_md: a.solution_outline_md,
      })
    }
  })
  tx()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log(`[seed] DB: ${DB_PATH}`)
  console.log(`[seed] Content dir: ${CONTENT_DIR}`)

  // 1. Seed concepts base table from in-memory CONCEPTS
  seedConceptsTable()

  // 2. Seed authored content (if any)
  if (!fs.existsSync(CONTENT_DIR)) {
    console.warn(`[seed] No content/concepts/ directory; skipping content seed.`)
    db.close()
    return
  }

  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))

  if (files.length === 0) {
    console.log(`[seed] No concept JSON files found; skipping content seed.`)
    db.close()
    return
  }

  console.log(`[seed] Loading ${files.length} concept files`)
  for (const f of files) {
    const filepath = path.join(CONTENT_DIR, f)
    const c = JSON.parse(fs.readFileSync(filepath, 'utf8')) as ConceptJson

    // Verify concept exists in base concepts table (else FK will fail)
    const exists = db
      .prepare(`SELECT 1 FROM concepts WHERE id = ?`)
      .get(c.concept_id)
    if (!exists) {
      console.warn(
        `[seed]   ! ${c.concept_id} not in concepts table; ` +
        `add to src/data/concepts.ts. Skipping.`
      )
      continue
    }

    seedContentFile(c)
    console.log(
      `[seed]   ✓ ${c.concept_id}: ` +
      `${c.explanations.length} explanations, ` +
      `${c.examples.length} examples, ` +
      `${c.misconceptions.length} misconceptions, ` +
      `${c.checks.length} checks, ` +
      `${c.deep_dives.length} deep dives, ` +
      `${c.applications.length} applications`
    )
  }

  db.close()
  console.log(`[seed] Done.`)
}

main()
