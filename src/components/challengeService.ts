/**
 * ChallengeService — Phase E (Challenge Mode)
 *
 * Provides the runtime support for Challenge Mode:
 *   - Aggregates all challenge content for a concept (applications,
 *     deep dives, stretch problems).
 *   - Generates Socratic feedback on application-problem answers using
 *     the pre-authored solution_outline_md. The SLM remains on a strict
 *     leash — it only paraphrases / probes against the outline.
 *
 * No new persistence. All data comes from the Phase A content tables
 * plus the existing `problems` table (is_challenge=1 rows).
 */

import type { Database } from 'better-sqlite3'
import type { DialogueGenerator } from './dialogueGenerator.js'
import type { ContentRetrieval, DeepDive, Application } from './contentRetrieval.js'
import type { AdaptiveRouter } from './adaptiveRouter.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StretchProblem {
  id: string
  concept_id: string
  difficulty: string
  stem: string
  application_context: string | null
  solution_steps: Array<{ step_md?: string; why_md?: string }>
}

export interface ChallengeBundle {
  conceptId: string
  conceptName: string
  oneLiner: string | null
  /** Whether Phase D has marked this concept as unlocked for this student. */
  unlocked: boolean
  /** Whether this concept has *any* challenge content at all. */
  hasContent: boolean
  applications: Application[]
  deepDives: DeepDive[]
  stretchProblems: StretchProblem[]
}

export interface FeedbackResponse {
  /** A short Socratic response to the student's answer. */
  message: string
  /** The full solution outline (pre-authored) so the UI can reveal on demand. */
  solutionOutlineMd: string
  /** Optional probing question to keep the dialogue going. */
  probe?: string
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface ChallengeServiceOptions {
  db: Database
  contentRetrieval: ContentRetrieval
  dialogueGenerator: DialogueGenerator
  adaptiveRouter?: AdaptiveRouter
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

export class ChallengeService {
  private readonly db: Database
  private readonly content: ContentRetrieval
  private readonly dialogue: DialogueGenerator
  private readonly adaptiveRouter: AdaptiveRouter | undefined
  private readonly logger: Pick<Console, 'log' | 'warn' | 'error'>

  constructor(opts: ChallengeServiceOptions) {
    this.db = opts.db
    this.content = opts.contentRetrieval
    this.dialogue = opts.dialogueGenerator
    this.adaptiveRouter = opts.adaptiveRouter
    this.logger = opts.logger ?? console
  }

  // -----------------------------------------------------------------
  // List concepts that have *any* challenge-worthy content.
  // Used by the topic picker.
  // -----------------------------------------------------------------

  listChallengeableConcepts(studentId: string): Array<{
    conceptId: string
    conceptName: string
    oneLiner: string | null
    unlocked: boolean
    applicationCount: number
    deepDiveCount: number
    stretchProblemCount: number
  }> {
    const authored = this.content.listAuthoredConceptIds()
    const out: ReturnType<ChallengeService['listChallengeableConcepts']> = []

    for (const conceptId of authored) {
      const concept = this.content.getConcept(conceptId)
      if (!concept) continue

      const appCount = this.countRows(
        'SELECT COUNT(*) AS c FROM concept_applications WHERE concept_id = ?',
        conceptId
      )
      const ddCount = this.countRows(
        'SELECT COUNT(*) AS c FROM concept_deep_dives WHERE concept_id = ?',
        conceptId
      )
      const stretchCount = this.countRows(
        'SELECT COUNT(*) AS c FROM problems WHERE concept_id = ? AND is_challenge = 1',
        conceptId
      )

      // Only include concepts that have at least one piece of challenge content.
      if (appCount === 0 && ddCount === 0 && stretchCount === 0) continue

      const sig = this.adaptiveRouter?.getSignals(studentId, conceptId)
      out.push({
        conceptId,
        conceptName: concept.name,
        oneLiner: concept.one_liner,
        unlocked: !!sig?.challengeUnlocked,
        applicationCount: appCount,
        deepDiveCount: ddCount,
        stretchProblemCount: stretchCount,
      })
    }

    // Sort: unlocked first, then by name
    return out.sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
      return a.conceptName.localeCompare(b.conceptName)
    })
  }

  // -----------------------------------------------------------------
  // Full challenge bundle for one concept.
  // -----------------------------------------------------------------

  getChallengeBundle(studentId: string, conceptId: string): ChallengeBundle {
    const concept = this.content.getConcept(conceptId)
    if (!concept) throw new Error(`Concept not found: ${conceptId}`)

    const applications = this.content.listApplications(conceptId)
    const deepDives = this.content.listDeepDives(conceptId)
    const stretchProblems = this.loadStretchProblems(conceptId)

    const sig = this.adaptiveRouter?.getSignals(studentId, conceptId)

    return {
      conceptId,
      conceptName: concept.name,
      oneLiner: concept.one_liner,
      unlocked: !!sig?.challengeUnlocked,
      hasContent:
        applications.length > 0 ||
        deepDives.length > 0 ||
        stretchProblems.length > 0,
      applications,
      deepDives,
      stretchProblems,
    }
  }

  // -----------------------------------------------------------------
  // Socratic feedback on an application-problem answer.
  // -----------------------------------------------------------------

  async feedbackOnApplication(args: {
    applicationId: number
    studentAnswer: string
  }): Promise<FeedbackResponse> {
    const app = this.loadApplicationById(args.applicationId)
    if (!app) throw new Error(`Application not found: ${args.applicationId}`)

    const studentAnswer = (args.studentAnswer ?? '').trim()
    if (studentAnswer.length === 0) {
      return {
        message: "Take a swing at it — what's your first step?",
        solutionOutlineMd: app.solution_outline_md,
      }
    }

    const prompt = `You are a Socratic AP Calculus tutor.

STRICT RULES:
1. You may ONLY paraphrase or reference the SOLUTION OUTLINE below. Never introduce new math.
2. Be brief: 2-3 short sentences max.
3. End with a question that nudges the student toward the next step.
4. Use plain English. LaTeX only when echoing math from the outline.
5. No emojis. No exclamation marks.

APPLICATION PROBLEM:
${app.problem_md}

PRE-AUTHORED SOLUTION OUTLINE (the only math you may reference):
${app.solution_outline_md}

STUDENT'S ANSWER:
${studentAnswer}

TASK: Give brief Socratic feedback. Tell the student what part of their answer is on
track relative to the outline (if any), then ask a guiding question pointing to the
NEXT step in the outline they haven't yet shown. Do not reveal the final answer.`

    const message = await this.safeInfer(
      prompt,
      "Let's check your reasoning. Walk me through how you set up the model.",
      256
    )

    return {
      message,
      solutionOutlineMd: app.solution_outline_md,
    }
  }

  // -----------------------------------------------------------------
  // Socratic probe after a student reads a deep dive.
  // -----------------------------------------------------------------

  async probeAfterDeepDive(args: {
    deepDiveId: number
    studentReflection: string
  }): Promise<FeedbackResponse> {
    const dd = this.loadDeepDiveById(args.deepDiveId)
    if (!dd) throw new Error(`Deep dive not found: ${args.deepDiveId}`)

    const reflection = (args.studentReflection ?? '').trim()
    const prompt = `You are a Socratic AP Calculus tutor responding to a student
who just read a "why does this work" derivation.

STRICT RULES:
1. You may ONLY paraphrase or reference the DEEP DIVE below. Never introduce new math.
2. Be brief: 2-3 short sentences max.
3. End with a question that probes the student's understanding of WHY (not HOW).
4. No emojis. No filler.

DEEP DIVE TITLE: ${dd.title}

DEEP DIVE CONTENT:
${dd.body_md}

STUDENT'S REFLECTION:
${reflection || '(student has not written anything yet)'}

TASK: Briefly acknowledge what the student got right (if anything), then ask ONE probing
question that tests whether they understood the core "why". Reference a specific step or
phrase from the deep dive in your question.`

    const message = await this.safeInfer(
      prompt,
      'What was the key step in that derivation that made it click?',
      256
    )

    return {
      message,
      solutionOutlineMd: dd.body_md,
    }
  }

  // -----------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------

  private loadStretchProblems(conceptId: string): StretchProblem[] {
    const rows = this.db
      .prepare(
        `SELECT id, concept_id, difficulty, stem, application_context, solution_steps_json
         FROM problems
         WHERE concept_id = ? AND is_challenge = 1
         ORDER BY difficulty`
      )
      .all(conceptId) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: r['id'] as string,
      concept_id: r['concept_id'] as string,
      difficulty: r['difficulty'] as string,
      stem: r['stem'] as string,
      application_context: (r['application_context'] as string) ?? null,
      solution_steps: r['solution_steps_json']
        ? (JSON.parse(r['solution_steps_json'] as string) as Array<{
            step_md?: string
            why_md?: string
          }>)
        : [],
    }))
  }

  private loadApplicationById(id: number): Application | null {
    const row = this.db
      .prepare(
        `SELECT id, concept_id, context, problem_md, solution_outline_md
         FROM concept_applications WHERE id = ?`
      )
      .get(id) as Record<string, unknown> | undefined
    if (!row) return null
    return {
      id: row['id'] as number,
      concept_id: row['concept_id'] as string,
      context: (row['context'] as string) ?? null,
      problem_md: row['problem_md'] as string,
      solution_outline_md: row['solution_outline_md'] as string,
    }
  }

  private loadDeepDiveById(id: number): DeepDive | null {
    const row = this.db
      .prepare(
        `SELECT id, concept_id, title, body_md
         FROM concept_deep_dives WHERE id = ?`
      )
      .get(id) as Record<string, unknown> | undefined
    if (!row) return null
    return {
      id: row['id'] as number,
      concept_id: row['concept_id'] as string,
      title: row['title'] as string,
      body_md: row['body_md'] as string,
    }
  }

  private countRows(sql: string, ...params: unknown[]): number {
    const row = this.db.prepare(sql).get(...params) as { c: number } | undefined
    return row?.c ?? 0
  }

  private async safeInfer(
    prompt: string,
    fallback: string,
    maxTokens = 256
  ): Promise<string> {
    try {
      const out = await this.dialogue.inferRaw(prompt, maxTokens)
      const trimmed = (out ?? '').trim()
      return trimmed.length > 0 ? trimmed : fallback
    } catch (err) {
      this.logger.warn(`[ChallengeService] inference fell back: ${(err as Error).message}`)
      return fallback
    }
  }
}
