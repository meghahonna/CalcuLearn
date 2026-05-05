/**
 * Shared TypeScript interfaces and type aliases for CalcuLearn.
 *
 * This module defines the canonical data models used across all components:
 * Session Engine, Knowledge State Manager, Problem Engine, Dialogue Generator,
 * Answer Evaluator, and Translation Layer.
 */

// ---------------------------------------------------------------------------
// Primitive / scalar types
// ---------------------------------------------------------------------------

/**
 * IETF language tag identifying a natural language (e.g. 'en', 'es', 'fr',
 * 'zh-Hans'). Used by the Translation Layer to select the target language for
 * NLLB-200 inference.
 */
export type LanguageCode = string

/**
 * A parsed mathematical expression produced by the Answer Evaluator.
 * Carries both the original raw string and its canonical LaTeX form so that
 * downstream components can display or compare it without re-parsing.
 */
export interface MathExpression {
  /** The original string as submitted by the student or stored in the problem bank. */
  raw: string
  /** Canonical LaTeX representation of the expression. */
  latex: string
  /** Semantic category of the expression. */
  type: 'symbolic' | 'numeric' | 'text'
}

// ---------------------------------------------------------------------------
// Curriculum taxonomy
// ---------------------------------------------------------------------------

/**
 * The five top-level topics that make up the K-12 calculus curriculum covered
 * by CalcuLearn. Every ConceptNode belongs to exactly one topic.
 */
export type CalculusTopic = 'limits' | 'continuity' | 'derivatives' | 'integrals' | 'ode'

/**
 * The four difficulty tiers used to ladder problems within a concept.
 * The Problem Engine maps a student's mastery probability to a tier:
 *   - conceptual  : mastery < 0.3
 *   - procedural  : mastery in [0.3, 0.6)
 *   - application : mastery in [0.6, 0.8)
 *   - proof-sketch: mastery >= 0.8
 */
export type DifficultyLevel = 'conceptual' | 'procedural' | 'application' | 'proof-sketch'

/**
 * The four problem formats supported by the Answer Evaluator.
 */
export type ProblemType = 'multiple-choice' | 'free-response' | 'fill-in' | 'explain-concept'

// ---------------------------------------------------------------------------
// Concept graph
// ---------------------------------------------------------------------------

/**
 * A single learnable concept in the calculus curriculum, represented as a node
 * in the Knowledge Space Theory prerequisite DAG.
 *
 * Concept IDs follow the convention `<topic>.<slug>`, e.g. `"deriv.chain-rule"`.
 */
export interface ConceptNode {
  /** Unique identifier, e.g. `"deriv.chain-rule"`. */
  id: string
  /** Human-readable name shown in the UI. */
  name: string
  /** Top-level curriculum topic this concept belongs to. */
  topic: CalculusTopic
  /** IDs of concepts that must be mastered before this one becomes available. */
  prerequisites: string[]
  /** Intrinsic difficulty on a 1–5 scale (1 = easiest, 5 = hardest). */
  difficulty: 1 | 2 | 3 | 4 | 5
  /** Short description of what the concept covers. */
  description: string
  /** Specific skills or knowledge the student should acquire. */
  learningObjectives: string[]
}

// ---------------------------------------------------------------------------
// Knowledge state
// ---------------------------------------------------------------------------

/**
 * Mastery record for a single concept, maintained by the Knowledge State
 * Manager using Bayesian Knowledge Tracing (BKT).
 */
export interface ConceptMastery {
  /** The concept this record belongs to. */
  conceptId: string
  /**
   * BKT posterior probability that the student has mastered this concept.
   * Always in [0.0, 1.0].
   */
  masteryProbability: number
  /** Total number of answer submissions for this concept. */
  attemptCount: number
  /** Number of correct submissions for this concept. */
  correctCount: number
  /** Timestamp of the most recent attempt, or null if never attempted. */
  lastAttempted: Date | null
  /**
   * Lifecycle status of the concept for this student:
   * - locked      : prerequisites not yet met
   * - available   : prerequisites met, not yet started
   * - in-progress : at least one attempt made
   * - mastered    : masteryProbability >= 0.85 sustained over 3+ correct answers
   */
  status: 'locked' | 'available' | 'in-progress' | 'mastered'
}

/**
 * The complete knowledge model for a single student, persisted in local SQLite
 * and loaded at the start of every session.
 */
export interface KnowledgeState {
  /** Locally generated UUID identifying the student. */
  studentId: string
  /** Timestamp of the most recent BKT update. */
  lastUpdated: Date
  /**
   * Map from conceptId to its mastery record.
   * All concepts in the curriculum are present; new students start at 0.1.
   */
  concepts: Map<string, ConceptMastery>
  /** Ordered list of past session summaries, most recent last. */
  sessionHistory: SessionSummary[]
}

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------

/**
 * A single step in the canonical solution to a problem.
 * Used by the Answer Evaluator for partial-credit scoring and by the Dialogue
 * Generator to construct Socratic hints.
 */
export interface SolutionStep {
  /** 1-based position of this step in the full solution. */
  stepNumber: number
  /** Plain-language description of what this step accomplishes. */
  description: string
  /** LaTeX expression produced at the end of this step. */
  expression: string
  /** Socratic hint the Dialogue Generator may surface for this step. */
  hint: string
}

/**
 * A known student misconception associated with a concept or problem.
 * The Answer Evaluator matches student answers against `incorrectPattern` to
 * identify which misconceptions are active.
 */
export interface Misconception {
  /** Unique identifier for this misconception. */
  id: string
  /** Human-readable description of the misconception. */
  description: string
  /**
   * Pattern (literal substring or regex) that characterises the incorrect
   * answer produced by a student holding this misconception. Matching strategy
   * is controlled by `matchType`.
   */
  incorrectPattern: string
  /**
   * How `incorrectPattern` is matched against the student's answer.
   *   - `'substring'` (default): case-insensitive literal substring match.
   *     Safe for patterns containing regex metacharacters like `(`, `)`, `+`,
   *     `=`, which are common in calculus answers (e.g. `'f(3) = 7'`).
   *   - `'regex'`: pattern is compiled as a case-insensitive RegExp. Use only
   *     when the pattern is intentionally a regex (e.g. `'^0\\/0$'`).
   */
  matchType?: 'substring' | 'regex'
  /** ID of the concept whose remediation addresses this misconception. */
  remediationConceptId: string
}

/**
 * A calculus exercise drawn from the problem bank or generated on-the-fly by
 * the Dialogue Generator.
 */
export interface Problem {
  /** Unique identifier for this problem. */
  id: string
  /** ID of the concept this problem targets. */
  conceptId: string
  /** Difficulty tier of this problem. */
  difficulty: DifficultyLevel
  /** Format / interaction type of this problem. */
  type: ProblemType
  /** LaTeX-formatted problem statement shown to the student. */
  stem: string
  /** The canonical correct answer. */
  answer: MathExpression
  /** Ordered list of solution steps used for evaluation and hinting. */
  solutionSteps: SolutionStep[]
  /** Known misconceptions that may produce incorrect answers for this problem. */
  commonMisconceptions: Misconception[]
  /** True if this problem was generated by the Dialogue Generator at runtime. */
  isGenerated: boolean
}

/**
 * A template used by the Problem Engine to generate novel problem variants
 * when the curated bank is exhausted for a given concept and difficulty tier.
 */
export interface ProblemTemplate {
  /** Unique identifier for this template. */
  id: string
  /** ID of the concept this template targets. */
  conceptId: string
  /** Difficulty tier of problems produced from this template. */
  difficulty: DifficultyLevel
  /**
   * Problem stem with placeholder tokens (e.g. `{{a}}`, `{{b}}`) that are
   * substituted with sampled parameter values during generation.
   */
  templateStem: string
  /**
   * Numeric ranges for each placeholder parameter.
   * Keys match the placeholder names used in `templateStem`.
   */
  parameterRanges: Record<string, { min: number; max: number }>
  /**
   * Template for the expected answer, using the same placeholder tokens as
   * `templateStem`. Filled in after parameter substitution.
   */
  answerTemplate: string
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * The structured output produced by the Answer Evaluator for a single student
 * submission. Consumed by the Knowledge State Manager (BKT update) and the
 * Dialogue Generator (feedback generation).
 */
export interface EvaluationResult {
  /** ID of the problem that was evaluated. */
  problemId: string
  /** Whether the student's answer is fully correct. */
  isCorrect: boolean
  /**
   * Partial credit score in [0.0, 1.0].
   * 1.0 means fully correct; 0.0 means no credit awarded.
   */
  partialCredit: number
  /** Misconceptions identified in the student's answer. */
  misconceptions: Misconception[]
  /** The evaluation strategy that determined correctness. */
  evaluationMethod: 'symbolic' | 'numeric' | 'llm'
  /** The raw answer string as submitted by the student. */
  rawAnswer: string
  /** The parsed form of the student's answer, or null if parsing failed. */
  parsedAnswer: MathExpression | null
  /** Ordered list of feedback hints to surface in the UI. */
  feedbackHints: string[]
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * A single answer-submission event within a session, recording everything
 * needed to reconstruct the interaction and compute session statistics.
 */
export interface TurnRecord {
  /** Unique identifier for this turn. */
  turnId: string
  /** The problem the student was answering. */
  problem: Problem
  /** The raw answer string submitted by the student. */
  rawAnswer: string
  /** The evaluation result for this turn. */
  evaluationResult: EvaluationResult
  /** The feedback text that was displayed to the student after this turn. */
  feedbackShown: string
  /** Number of hints the student used before submitting this answer. */
  hintsUsed: number
  /** Wall-clock duration of this turn in milliseconds. */
  durationMs: number
}

/**
 * The runtime context for an active tutoring session.
 * Maintained in memory by the Session Engine and persisted at session end.
 */
export interface Session {
  /** Unique identifier for this session. */
  sessionId: string
  /** ID of the student this session belongs to. */
  studentId: string
  /** Timestamp when the session was started. */
  startTime: Date
  /** Ordered list of completed turns, most recent last. */
  turns: TurnRecord[]
  /** The problem currently presented to the student, or null between turns. */
  currentProblem: Problem | null
  /** Total number of hints requested in this session. */
  hintCount: number
  /** The concept currently being targeted for instruction. */
  targetConcept: ConceptNode
}

/**
 * Compact summary of a completed session, stored in the student's
 * KnowledgeState history and returned by `SessionEngine.endSession`.
 */
export interface SessionSummary {
  /** ID of the session this summary describes. */
  sessionId: string
  /** ID of the student. */
  studentId: string
  /** Total number of answer submissions in the session. */
  totalTurns: number
  /** Total number of hints requested in the session. */
  hintsUsed: number
  /** IDs of concepts whose mastery probability increased during the session. */
  conceptsProgressed: string[]
  /**
   * Change in mastery probability for each concept touched during the session.
   * Positive values indicate improvement; negative values indicate regression.
   */
  masteryDeltas: Record<string, number>
  /** Timestamp when the session started. */
  startTime: Date
  /** Timestamp when the session ended. */
  endTime: Date
}

// ---------------------------------------------------------------------------
// Return types for SessionEngine methods
// ---------------------------------------------------------------------------

/**
 * Returned by `SessionEngine.requestHint`. Carries the hint text and metadata
 * about how many hints have been used so far.
 */
export interface HintResult {
  /** The Socratic hint text to display to the student. */
  text: string
  /** The 1-based level of this hint (higher = more revealing). */
  hintLevel: number
  /** Total number of hints used in the current session after this request. */
  hintCount: number
}

/**
 * Returned by `SessionEngine.submitAnswer`. Aggregates the evaluation outcome
 * with session-level progress indicators.
 */
export interface TurnResult {
  /** Full evaluation result for the submitted answer. */
  evaluationResult: EvaluationResult
  /** Localised feedback text generated by the Dialogue Generator. */
  feedbackText: string
  /** Total number of completed turns in the session after this submission. */
  turnCount: number
  /** Whether the BKT mastery probability was updated as a result of this turn. */
  masteryUpdated: boolean
  /** Whether the session advanced to a new target concept after this turn. */
  conceptAdvanced: boolean
}
