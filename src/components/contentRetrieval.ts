/**
 * Content Retrieval DAO for Phase A authored content.
 *
 * Read-only access to the concept content tables. The Socratic runtime
 * (LearnModeService) uses this to fetch the right pre-authored block for
 * the current state — explanation, example, misconception, check, etc.
 *
 * The on-device SLM never invents calculus content. It only paraphrases,
 * probes, and transitions between blocks pulled from here.
 */

import type { Database } from 'better-sqlite3'

export type Tier = 'novice' | 'on_pace' | 'advanced'

export interface ConceptMeta {
  id: string
  name: string
  topic: string | null
  difficulty: number | null
  description: string | null
  track: 'AB' | 'BC' | 'BOTH'
  prerequisites: string[]
  one_liner: string | null
  authoring_status: string
}

export interface Explanation {
  id: number
  concept_id: string
  tier: Tier
  framing_index: number
  body_md: string
  intuition_md: string | null
}

export interface ExampleStep {
  step_md: string
  why_md: string
}

export interface WorkedExample {
  id: number
  concept_id: string
  tier: Tier
  problem_md: string
  steps: ExampleStep[]
}

export interface Misconception {
  id: number
  concept_id: string
  short_name: string
  description_md: string
  why_wrong_md: string
  socratic_response_md: string
}

export interface Check {
  id: number
  concept_id: string
  tier: Tier
  question_md: string
  expected_answer_md: string
  expected_pattern: string | null
  misconception_id_if_wrong: number | null
}

export interface DeepDive {
  id: number
  concept_id: string
  title: string
  body_md: string
}

export interface Application {
  id: number
  concept_id: string
  context: string | null
  problem_md: string
  solution_outline_md: string
}

export class ContentRetrieval {
  constructor(private readonly db: Database) {}

  // --- Concept meta ----------------------------------------------------

  getConcept(conceptId: string): ConceptMeta | null {
    const row = this.db
      .prepare(
        `SELECT id, name, topic, difficulty, description, track,
                prerequisites_json, one_liner, authoring_status
         FROM concepts WHERE id = ?`
      )
      .get(conceptId) as Record<string, unknown> | undefined
    if (!row) return null
    return {
      id: row['id'] as string,
      name: row['name'] as string,
      topic: (row['topic'] as string) ?? null,
      difficulty: (row['difficulty'] as number) ?? null,
      description: (row['description'] as string) ?? null,
      track: ((row['track'] as string) ?? 'BOTH') as 'AB' | 'BC' | 'BOTH',
      prerequisites: row['prerequisites_json']
        ? (JSON.parse(row['prerequisites_json'] as string) as string[])
        : [],
      one_liner: (row['one_liner'] as string) ?? null,
      authoring_status: (row['authoring_status'] as string) ?? 'not_started',
    }
  }

  /** True if the concept has any authored content. */
  isAuthored(conceptId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM concept_explanations WHERE concept_id = ? LIMIT 1`
      )
      .get(conceptId) as { 1: number } | undefined
    return !!row
  }

  /** All concept ids that have any authored explanation row. */
  listAuthoredConceptIds(): string[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT concept_id FROM concept_explanations ORDER BY concept_id`
      )
      .all() as Array<{ concept_id: string }>
    return rows.map((r) => r.concept_id)
  }

  // --- Explanations ----------------------------------------------------

  /**
   * Get an explanation for the given tier and framing.
   * If framingIndex is omitted, returns the primary framing (index 0).
   * Returns null if no row exists.
   */
  getExplanation(
    conceptId: string,
    tier: Tier,
    framingIndex = 0
  ): Explanation | null {
    const row = this.db
      .prepare(
        `SELECT id, concept_id, tier, framing_index, body_md, intuition_md
         FROM concept_explanations
         WHERE concept_id = ? AND tier = ? AND framing_index = ?`
      )
      .get(conceptId, tier, framingIndex) as
      | (Record<string, unknown>)
      | undefined
    if (!row) return null
    return {
      id: row['id'] as number,
      concept_id: row['concept_id'] as string,
      tier: row['tier'] as Tier,
      framing_index: row['framing_index'] as number,
      body_md: row['body_md'] as string,
      intuition_md: (row['intuition_md'] as string) ?? null,
    }
  }

  /** All explanations for a tier (multiple framings if available). */
  getAllExplanations(conceptId: string, tier: Tier): Explanation[] {
    const rows = this.db
      .prepare(
        `SELECT id, concept_id, tier, framing_index, body_md, intuition_md
         FROM concept_explanations
         WHERE concept_id = ? AND tier = ?
         ORDER BY framing_index`
      )
      .all(conceptId, tier) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: row['id'] as number,
      concept_id: row['concept_id'] as string,
      tier: row['tier'] as Tier,
      framing_index: row['framing_index'] as number,
      body_md: row['body_md'] as string,
      intuition_md: (row['intuition_md'] as string) ?? null,
    }))
  }

  /**
   * Returns the next framing for a tier (i.e., framing_index = currentIndex + 1)
   * if it exists, else null. Used when the student says "explain it differently".
   */
  getNextFraming(
    conceptId: string,
    tier: Tier,
    currentIndex: number
  ): Explanation | null {
    return this.getExplanation(conceptId, tier, currentIndex + 1)
  }

  // --- Examples --------------------------------------------------------

  getExample(conceptId: string, tier: Tier): WorkedExample | null {
    const row = this.db
      .prepare(
        `SELECT id, concept_id, tier, problem_md, steps_json
         FROM concept_examples
         WHERE concept_id = ? AND tier = ?
         ORDER BY id LIMIT 1`
      )
      .get(conceptId, tier) as Record<string, unknown> | undefined
    if (!row) return null
    return {
      id: row['id'] as number,
      concept_id: row['concept_id'] as string,
      tier: row['tier'] as Tier,
      problem_md: row['problem_md'] as string,
      steps: JSON.parse(row['steps_json'] as string) as ExampleStep[],
    }
  }

  // --- Misconceptions --------------------------------------------------

  getMisconception(misconceptionId: number): Misconception | null {
    const row = this.db
      .prepare(
        `SELECT id, concept_id, short_name, description_md, why_wrong_md, socratic_response_md
         FROM concept_misconceptions WHERE id = ?`
      )
      .get(misconceptionId) as Record<string, unknown> | undefined
    if (!row) return null
    return this.rowToMisconception(row)
  }

  getMisconceptionByShortName(
    conceptId: string,
    shortName: string
  ): Misconception | null {
    const row = this.db
      .prepare(
        `SELECT id, concept_id, short_name, description_md, why_wrong_md, socratic_response_md
         FROM concept_misconceptions WHERE concept_id = ? AND short_name = ?`
      )
      .get(conceptId, shortName) as Record<string, unknown> | undefined
    if (!row) return null
    return this.rowToMisconception(row)
  }

  /** All misconceptions for a concept — used by the classifier prompt. */
  listMisconceptions(conceptId: string): Misconception[] {
    const rows = this.db
      .prepare(
        `SELECT id, concept_id, short_name, description_md, why_wrong_md, socratic_response_md
         FROM concept_misconceptions WHERE concept_id = ? ORDER BY id`
      )
      .all(conceptId) as Array<Record<string, unknown>>
    return rows.map((r) => this.rowToMisconception(r))
  }

  private rowToMisconception(row: Record<string, unknown>): Misconception {
    return {
      id: row['id'] as number,
      concept_id: row['concept_id'] as string,
      short_name: row['short_name'] as string,
      description_md: row['description_md'] as string,
      why_wrong_md: row['why_wrong_md'] as string,
      socratic_response_md: row['socratic_response_md'] as string,
    }
  }

  // --- Checks ----------------------------------------------------------

  /** All checks for a concept at a given tier. */
  listChecks(conceptId: string, tier: Tier): Check[] {
    const rows = this.db
      .prepare(
        `SELECT id, concept_id, tier, question_md, expected_answer_md,
                expected_pattern, misconception_id_if_wrong
         FROM concept_checks WHERE concept_id = ? AND tier = ? ORDER BY id`
      )
      .all(conceptId, tier) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: row['id'] as number,
      concept_id: row['concept_id'] as string,
      tier: row['tier'] as Tier,
      question_md: row['question_md'] as string,
      expected_answer_md: row['expected_answer_md'] as string,
      expected_pattern: (row['expected_pattern'] as string) ?? null,
      misconception_id_if_wrong:
        (row['misconception_id_if_wrong'] as number) ?? null,
    }))
  }

  // --- Deep Dives ------------------------------------------------------

  listDeepDives(conceptId: string): DeepDive[] {
    const rows = this.db
      .prepare(
        `SELECT id, concept_id, title, body_md
         FROM concept_deep_dives WHERE concept_id = ? ORDER BY id`
      )
      .all(conceptId) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: row['id'] as number,
      concept_id: row['concept_id'] as string,
      title: row['title'] as string,
      body_md: row['body_md'] as string,
    }))
  }

  // --- Applications ----------------------------------------------------

  listApplications(conceptId: string): Application[] {
    const rows = this.db
      .prepare(
        `SELECT id, concept_id, context, problem_md, solution_outline_md
         FROM concept_applications WHERE concept_id = ? ORDER BY id`
      )
      .all(conceptId) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: row['id'] as number,
      concept_id: row['concept_id'] as string,
      context: (row['context'] as string) ?? null,
      problem_md: row['problem_md'] as string,
      solution_outline_md: row['solution_outline_md'] as string,
    }))
  }
}
