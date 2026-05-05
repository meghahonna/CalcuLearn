/**
 * Knowledge State Manager for CalcuLearn.
 *
 * Maintains per-student mastery probabilities for every calculus concept using
 * Bayesian Knowledge Tracing (BKT). Persists state to and loads state from the
 * local SQLite `concept_mastery` table.
 *
 * ## BKT design decisions
 *
 * ### Per-turn forgetting removed (Reqs 2.4, 2.5)
 * The standard BKT formula includes a forgetting transition applied on every
 * answer: `afterForgetting = afterLearning × (1 − P_FORGET)`. This creates two
 * problems:
 *   - A correct answer stops increasing mastery above ~0.940 (violates Req 2.4).
 *   - An incorrect answer can *increase* mastery below ~0.22 because P_LEARN
 *     always applies (violates Req 2.5 for hints).
 *
 * Forgetting is a function of *time elapsed without practice*, not of the
 * number of attempts. Docking 5% every time a student answers a question
 * penalises engagement. The fix: remove the per-turn forgetting multiplication
 * from `bktUpdate` and apply it as a time-based decay in `applySessionStartDecay`,
 * called by the Session Engine after `loadState`. P_FORGET is still used
 * (Req 2.2 is satisfied), just in the right place.
 *
 * ### Hint penalty is not a BKT incorrect update (Req 2.5)
 * Using `bktUpdate(prior, false)` for hints is conceptually wrong: a hint is a
 * request for help, not a wrong answer. With P_LEARN = 0.20, even an incorrect
 * BKT update raises mastery from low priors. Instead, `applyHintPenalty` uses a
 * fixed multiplicative penalty: `mastery × (1 − P_HINT_PENALTY)`. This is
 * strictly monotone-decreasing for all priors in [0, 1] and has clear semantics:
 * "every hint costs you 5% mastery."
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 7.4
 */

import type { Database } from 'better-sqlite3'
import type {
  KnowledgeState,
  ConceptMastery,
  ConceptNode,
  EvaluationResult,
} from '../models/types.js'
import {
  DEFAULT_MASTERY_PRIOR,
  REVIEW_THRESHOLD,
} from '../models/constants.js'
import { assertMasteryProbability } from '../models/validation.js'

// ---------------------------------------------------------------------------
// BKT constants (calibrated for the calculus domain — Requirement 2.2)
// ---------------------------------------------------------------------------

/** Probability of transitioning from unmastered to mastered after a single attempt. */
const P_LEARN = 0.20

/**
 * Per-week forgetting rate. Applied as a time-based decay in
 * `applySessionStartDecay`, NOT on every answer attempt.
 * See module-level doc for rationale.
 */
const P_FORGET = 0.05

/** Probability of a correct answer despite not having mastered the concept. */
const P_GUESS = 0.20

/** Probability of an incorrect answer despite having mastered the concept. */
const P_SLIP = 0.10

/**
 * Multiplicative mastery penalty applied per hint request.
 * A hint costs the student 5% of their current mastery probability.
 *
 * Numerically equal to P_FORGET, but models a different phenomenon:
 * P_FORGET is time-based decay between sessions; P_HINT_PENALTY is an
 * in-session engagement signal. Do NOT unify these constants — they may
 * be tuned independently as the model is calibrated.
 */
// IMPORTANT: do not unify P_HINT_PENALTY and P_FORGET — they model different phenomena.
const P_HINT_PENALTY = 0.05

// ---------------------------------------------------------------------------
// Mastery thresholds
// ---------------------------------------------------------------------------

/** Mastery probability at or above which a concept is considered mastered. */
const MASTERY_THRESHOLD = 0.85

// ---------------------------------------------------------------------------
// bktUpdate — pure BKT update function (no per-turn forgetting)
// ---------------------------------------------------------------------------

/**
 * Applies one step of Bayesian Knowledge Tracing to produce an updated mastery
 * probability.
 *
 * Formula:
 *   1. Compute the marginal P(observation) via the law of total probability.
 *   2. Bayes update: posterior = P(mastered | observation).
 *   3. Learning transition: afterLearning = posterior + (1 − posterior) × P_LEARN.
 *
 * The forgetting transition is intentionally omitted here. Forgetting is
 * time-dependent and is applied separately in `applySessionStartDecay`.
 *
 * The output is clamped to [0.0, 1.0] as a final safety guard (Req 2.3).
 *
 * Properties guaranteed by this formula:
 *   - For any prior in [0.0, 1.0]: output is in [0.0, 1.0] (Property 3).
 *   - For any prior in [0.0, 1.0]: bktUpdate(prior, true) > prior (Property 1).
 *   - For any prior in [0.0, 1.0]: bktUpdate(prior, false) < prior is NOT
 *     guaranteed here — use `applyHintPenalty` for the hint-penalty property.
 *
 * @param masteryPrior - Current mastery probability, must be in [0.0, 1.0].
 * @param isCorrect    - Whether the student's answer was correct.
 * @returns Updated mastery probability in [0.0, 1.0].
 *
 * Requirements: 2.2, 2.3
 */
export function bktUpdate(masteryPrior: number, isCorrect: boolean): number {
  // Step 1: Marginal probability of the observed outcome.
  const p_obs = isCorrect
    ? masteryPrior * (1 - P_SLIP) + (1 - masteryPrior) * P_GUESS
    : masteryPrior * P_SLIP + (1 - masteryPrior) * (1 - P_GUESS)

  // Guard against division by zero (degenerate floating-point inputs).
  if (p_obs <= 0) {
    return masteryPrior
  }

  // Step 2: Bayes update — posterior P(mastered | observation).
  const posterior = isCorrect
    ? (masteryPrior * (1 - P_SLIP)) / p_obs
    : (masteryPrior * P_SLIP) / p_obs

  // Step 3: Learning transition (no forgetting — see module doc).
  const afterLearning = posterior + (1 - posterior) * P_LEARN

  // Clamp to [0.0, 1.0] as a final safety guard (Requirement 2.3).
  return Math.min(1.0, Math.max(0.0, afterLearning))
}

// ---------------------------------------------------------------------------
// Row types for SQLite queries
// ---------------------------------------------------------------------------

interface ConceptMasteryRow {
  concept_id: string
  mastery_probability: number
  attempt_count: number
  correct_count: number
  last_attempted: number | null
  status: string
}

// ---------------------------------------------------------------------------
// KnowledgeStateManager class
// ---------------------------------------------------------------------------

/**
 * Manages per-student knowledge states backed by a local SQLite database.
 *
 * ### Persistence policy
 * `updateStateForConcept` persists immediately after each answer so that a
 * crash mid-session loses at most the current in-flight turn. `applyHintPenalty`
 * does NOT persist — hints are frequent and the mastery delta is small; the
 * Session Engine flushes the full state at session end (Req 1.4). This asymmetry
 * is intentional: answer results are durable, hint penalties are best-effort.
 *
 * The `conceptNodes` map is used to resolve prerequisite relationships when
 * computing the next target concept. Populate it via the constructor or
 * `registerConcepts` before calling `getNextTargetConcept`.
 */
export class KnowledgeStateManager {
  private readonly db: Database
  private readonly conceptNodes: Map<string, ConceptNode>

  constructor(db: Database, conceptNodes: readonly ConceptNode[] = []) {
    this.db = db
    this.conceptNodes = new Map(conceptNodes.map((n) => [n.id, n]))
  }

  /**
   * Registers (or replaces) the concept graph used for prerequisite resolution.
   * Call this after constructing the manager if concepts are loaded lazily.
   */
  registerConcepts(nodes: readonly ConceptNode[]): void {
    this.conceptNodes.clear()
    for (const node of nodes) {
      this.conceptNodes.set(node.id, node)
    }
  }

  // -------------------------------------------------------------------------
  // loadState
  // -------------------------------------------------------------------------

  /**
   * Loads the KnowledgeState for `studentId` from the `concept_mastery` table.
   *
   * If the student has no rows in `concept_mastery`, a fresh state is created
   * with all registered concepts initialised to the default mastery prior of
   * 0.1 and status `'locked'`. The fresh state is NOT automatically persisted —
   * call `persistState` to write it.
   *
   * `lastUpdated` is set to the most recent `last_attempted` timestamp across
   * all loaded rows, or `new Date(0)` for a brand-new student.
   *
   * @param studentId - UUID of the student.
   * @returns The student's current KnowledgeState.
   *
   * Requirements: 2.1, 2.8, 7.4
   */
  loadState(studentId: string): KnowledgeState {
    const rows = this.db
      .prepare<[string], ConceptMasteryRow>(
        `SELECT concept_id, mastery_probability, attempt_count, correct_count,
                last_attempted, status
         FROM concept_mastery
         WHERE student_id = ?`
      )
      .all(studentId)

    const concepts = new Map<string, ConceptMastery>()
    let maxLastAttempted = 0

    if (rows.length === 0) {
      // New student — initialise all known concepts to the default prior.
      for (const [conceptId] of this.conceptNodes) {
        concepts.set(conceptId, this._defaultMastery(conceptId))
      }
    } else {
      for (const row of rows) {
        if (row.last_attempted !== null && row.last_attempted > maxLastAttempted) {
          maxLastAttempted = row.last_attempted
        }
        concepts.set(row.concept_id, {
          conceptId: row.concept_id,
          masteryProbability: row.mastery_probability,
          attemptCount: row.attempt_count,
          correctCount: row.correct_count,
          lastAttempted: row.last_attempted !== null ? new Date(row.last_attempted) : null,
          status: row.status as ConceptMastery['status'],
        })
      }

      // Ensure any concepts added to the graph after the student's last session
      // are present with default values.
      for (const [conceptId] of this.conceptNodes) {
        if (!concepts.has(conceptId)) {
          concepts.set(conceptId, this._defaultMastery(conceptId))
        }
      }
    }

    return {
      studentId,
      lastUpdated: maxLastAttempted > 0 ? new Date(maxLastAttempted) : new Date(0),
      concepts,
      sessionHistory: [],
    }
  }

  // -------------------------------------------------------------------------
  // persistState
  // -------------------------------------------------------------------------

  /**
   * Upserts all ConceptMastery rows for `studentId` in a single transaction.
   *
   * Uses `INSERT OR REPLACE` so that both new and existing rows are handled
   * without a separate SELECT.
   *
   * @param studentId - UUID of the student.
   * @param state     - The KnowledgeState to persist.
   *
   * Requirements: 2.1, 7.4
   */
  persistState(studentId: string, state: KnowledgeState): void {
    // Ensure the student row exists before inserting concept_mastery rows.
    this.db
      .prepare<[string, number]>(
        `INSERT OR IGNORE INTO students (id, created_at) VALUES (?, ?)`
      )
      .run(studentId, Date.now())

    const upsert = this.db.prepare<
      [string, string, number, number, number, number | null, string]
    >(
      `INSERT OR REPLACE INTO concept_mastery
         (student_id, concept_id, mastery_probability, attempt_count,
          correct_count, last_attempted, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )

    const persistAll = this.db.transaction(() => {
      for (const [, mastery] of state.concepts) {
        assertMasteryProbability(mastery.masteryProbability)
        upsert.run(
          studentId,
          mastery.conceptId,
          mastery.masteryProbability,
          mastery.attemptCount,
          mastery.correctCount,
          mastery.lastAttempted !== null ? mastery.lastAttempted.getTime() : null,
          mastery.status
        )
      }
    })

    persistAll()
  }

  // -------------------------------------------------------------------------
  // updateStateForConcept
  // -------------------------------------------------------------------------

  /**
   * Applies a BKT update for a specific `conceptId`, updates the in-memory
   * state, and persists the change to SQLite immediately.
   *
   * The concept's `attemptCount` is always incremented. `correctCount` is
   * incremented only when `result.isCorrect` is true.
   *
   * Status transitions:
   *   - `'locked'` / `'available'` → `'in-progress'` on first attempt
   *   - `'in-progress'` → `'mastered'` when masteryProbability >= 0.85
   *   - `'mastered'` → `'in-progress'` when masteryProbability drops below 0.7
   *     (regression; concept is flagged for review — Requirement 2.7)
   *
   * The Session Engine always knows the current target concept independently of
   * the EvaluationResult, so it calls this method directly rather than the
   * now-removed `updateState` wrapper.
   *
   * @param studentId - UUID of the student.
   * @param state     - Current KnowledgeState (mutated in place).
   * @param result    - EvaluationResult from the Answer Evaluator.
   * @param conceptId - ID of the concept being updated.
   * @returns The updated KnowledgeState.
   *
   * Requirements: 2.2, 2.3, 2.4, 2.7
   */
  updateStateForConcept(
    studentId: string,
    state: KnowledgeState,
    result: EvaluationResult,
    conceptId: string
  ): KnowledgeState {
    const existing = state.concepts.get(conceptId) ?? this._defaultMastery(conceptId)

    const newProbability = bktUpdate(existing.masteryProbability, result.isCorrect)

    const newAttemptCount = existing.attemptCount + 1
    const newCorrectCount = existing.correctCount + (result.isCorrect ? 1 : 0)

    // Determine new status via the shared resolver (same logic as applySessionStartDecay).
    const newStatus = this._resolveStatus(existing.status, newProbability)

    const updated: ConceptMastery = {
      conceptId,
      masteryProbability: newProbability,
      attemptCount: newAttemptCount,
      correctCount: newCorrectCount,
      lastAttempted: new Date(),
      status: newStatus,
    }

    state.concepts.set(conceptId, updated)
    state.lastUpdated = new Date()

    // Persist immediately so a mid-session crash loses at most the current turn.
    this.persistState(studentId, state)

    return state
  }

  // -------------------------------------------------------------------------
  // applyHintPenalty
  // -------------------------------------------------------------------------

  /**
   * Applies a fixed multiplicative mastery penalty for a hint request.
   *
   * A hint is a request for help, not a wrong answer. Using a BKT incorrect
   * update for hints is conceptually wrong: with P_LEARN = 0.20, even an
   * incorrect BKT update raises mastery from low priors. Instead, this method
   * applies: `newMastery = prior × (1 − P_HINT_PENALTY)`.
   *
   * This is strictly monotone-decreasing for all priors in [0, 1] and has
   * clear semantics: "every hint costs you 5% of your current mastery."
   *
   * The penalty is applied in-memory only. The Session Engine flushes the full
   * state at session end (Req 1.4). This is intentional — see class-level doc.
   *
   * @param state     - Current KnowledgeState (mutated in place).
   * @param conceptId - ID of the concept to penalise.
   * @returns The updated ConceptMastery for the penalised concept.
   *
   * Requirements: 2.5, 1.3
   */
  applyHintPenalty(state: KnowledgeState, conceptId: string): ConceptMastery {
    const existing = state.concepts.get(conceptId) ?? this._defaultMastery(conceptId)
    const penalisedProbability = Math.max(0.0, existing.masteryProbability * (1 - P_HINT_PENALTY))

    const updated: ConceptMastery = {
      ...existing,
      masteryProbability: penalisedProbability,
    }

    state.concepts.set(conceptId, updated)
    state.lastUpdated = new Date()

    return updated
  }

  // -------------------------------------------------------------------------
  // applySessionStartDecay
  // -------------------------------------------------------------------------

  /**
   * Applies time-based forgetting decay to all concepts in `state`.
   *
   * Forgetting is modelled as exponential decay based on days elapsed since
   * each concept was last attempted:
   *
   *   newMastery = mastery × (1 − P_FORGET) ^ (daysSinceLastAttempt / 7)
   *
   * This means a concept loses P_FORGET (5%) of its mastery per week of
   * inactivity. Concepts never attempted (`lastAttempted = null`) are not
   * decayed — they are already at the default prior.
   *
   * Call this from the Session Engine immediately after `loadState`, before
   * presenting the first problem.
   *
   * The decay is applied in-memory only. The Session Engine flushes the full
   * state at session end (Req 1.4). This matches the persistence policy of
   * `applyHintPenalty` — see class-level doc.
   *
   * @param state - Current KnowledgeState (mutated in place).
   * @param now   - Reference timestamp for computing elapsed time (defaults to
   *                `new Date()`; injectable for testing).
   * @returns The same state object with decayed mastery values.
   *
   * Requirements: 2.2, 2.7 (P_FORGET used here; regression flag applied)
   */
  applySessionStartDecay(state: KnowledgeState, now: Date = new Date()): KnowledgeState {
    const nowMs = now.getTime()
    const msPerWeek = 7 * 24 * 60 * 60 * 1000

    for (const [conceptId, mastery] of state.concepts) {
      if (mastery.lastAttempted === null) continue

      const elapsedMs = nowMs - mastery.lastAttempted.getTime()
      if (elapsedMs <= 0) continue

      const weeksElapsed = elapsedMs / msPerWeek
      const decayFactor = Math.pow(1 - P_FORGET, weeksElapsed)
      const decayed = Math.max(0.0, mastery.masteryProbability * decayFactor)

      // Apply the same status-resolution logic as updateStateForConcept so that
      // Req 2.7 fires here too: a mastered concept that decays below 0.7 is
      // flagged for review before the session even starts.
      const newStatus = this._resolveStatus(mastery.status, decayed)

      state.concepts.set(conceptId, {
        ...mastery,
        masteryProbability: decayed,
        status: newStatus,
      })
    }

    state.lastUpdated = now
    return state
  }

  // -------------------------------------------------------------------------
  // getMasteryScore
  // -------------------------------------------------------------------------

  /**
   * Returns the mastery probability for `conceptId` in `state`, or the default
   * prior of 0.1 if the concept is not present.
   *
   * @param state     - The student's current KnowledgeState.
   * @param conceptId - ID of the concept to query.
   * @returns Mastery probability in [0.0, 1.0].
   *
   * Requirements: 2.6
   */
  getMasteryScore(state: KnowledgeState, conceptId: string): number {
    return state.concepts.get(conceptId)?.masteryProbability ?? DEFAULT_MASTERY_PRIOR
  }

  // -------------------------------------------------------------------------
  // getNextTargetConcept
  // -------------------------------------------------------------------------

  /**
   * Identifies the best FrontierConcept to target next.
   *
   * A concept is eligible when:
   *   1. All its prerequisites have masteryProbability >= 0.7 (prerequisite gate).
   *   2. Its own masteryProbability < 0.85 (not yet mastered).
   *
   * Among eligible concepts, the one with the highest readiness score is
   * selected:
   *   readiness = min(prerequisite masteries) × (1 − own mastery)
   *
   * For concepts with no prerequisites, `min(prerequisite masteries)` is
   * treated as 1.0 so that they are always eligible and scored purely on
   * (1 − own mastery).
   *
   * If no eligible concept exists (all mastered or all locked), the fallback
   * selects the concept with the lowest mastery among those whose prerequisites
   * are met (or have no prerequisites). This ensures the fallback never
   * violates the prerequisite gate.
   *
   * @param state - The student's current KnowledgeState.
   * @returns The ConceptNode that should be targeted next.
   * @throws {Error} If no concept nodes have been registered.
   *
   * Requirements: 2.6, 2.7, 2.8
   */
  getNextTargetConcept(state: KnowledgeState): ConceptNode {
    if (this.conceptNodes.size === 0) {
      throw new Error('KnowledgeStateManager: no concept nodes registered')
    }

    let bestConcept: ConceptNode | null = null
    let bestScore = -Infinity

    // Fallback: lowest-mastery concept among those with met prerequisites.
    let fallbackConcept: ConceptNode | null = null
    let fallbackMastery = Infinity

    for (const [conceptId, node] of this.conceptNodes) {
      const ownMastery = this.getMasteryScore(state, conceptId)

      // Check prerequisite gate (used for both main path and fallback).
      const prereqMasteries = node.prerequisites.map((prereqId) =>
        this.getMasteryScore(state, prereqId)
      )
      const allPrereqsMet =
        prereqMasteries.length === 0 || prereqMasteries.every((m) => m >= REVIEW_THRESHOLD)

      // Track fallback among prereq-gated concepts only.
      if (allPrereqsMet && ownMastery < fallbackMastery) {
        fallbackMastery = ownMastery
        fallbackConcept = node
      }

      // Skip already-mastered concepts for the main selection.
      if (ownMastery >= MASTERY_THRESHOLD) continue

      if (!allPrereqsMet) continue

      // Compute readiness score.
      const minPrereqMastery = prereqMasteries.length === 0 ? 1.0 : Math.min(...prereqMasteries)
      const readiness = minPrereqMastery * (1 - ownMastery)

      if (readiness > bestScore) {
        bestScore = readiness
        bestConcept = node
      }
    }

    // Return the best eligible concept, or the prereq-gated fallback.
    return bestConcept ?? fallbackConcept!
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Creates a default ConceptMastery record for a new student. */
  private _defaultMastery(conceptId: string): ConceptMastery {
    return {
      conceptId,
      masteryProbability: DEFAULT_MASTERY_PRIOR,
      attemptCount: 0,
      correctCount: 0,
      lastAttempted: null,
      status: 'locked',
    }
  }

  /**
   * Computes the new status for a concept given its previous status and updated
   * mastery probability.
   *
   * This is the single source of truth for status transitions, shared by both
   * `updateStateForConcept` (answer-driven updates) and `applySessionStartDecay`
   * (time-driven decay). Keeping the logic in one place ensures Req 2.7 fires
   * consistently regardless of which code path changed the mastery value.
   *
   * Transitions:
   *   - any → `'mastered'`    when newProb >= 0.85
   *   - `'mastered'` → `'in-progress'`  when newProb < 0.7  (regression flag, Req 2.7)
   *   - `'locked'` / `'available'` → `'in-progress'`  on first attempt
   *   - otherwise: status unchanged
   */
  private _resolveStatus(
    prevStatus: ConceptMastery['status'],
    newProb: number
  ): ConceptMastery['status'] {
    if (newProb >= MASTERY_THRESHOLD) return 'mastered'
    if (prevStatus === 'mastered' && newProb < REVIEW_THRESHOLD) return 'in-progress'
    if (prevStatus === 'locked' || prevStatus === 'available') return 'in-progress'
    return prevStatus
  }
}
