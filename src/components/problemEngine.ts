/**
 * Problem Engine for CalcuLearn.
 *
 * Selects curated problems from SQLite by target concept and mastery-derived
 * difficulty. When the curated bank for that slice is exhausted by recent
 * turns, delegates to the Dialogue Generator to create and cache a variant.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import type { Database } from 'better-sqlite3'
import type {
  ConceptNode,
  DifficultyLevel,
  KnowledgeState,
  Misconception,
  Problem,
  ProblemTemplate,
  Session,
  SolutionStep,
} from '../models/types.js'
import {
  DEFAULT_MASTERY_PRIOR,
  PREREQUISITE_MASTERY_THRESHOLD,
} from '../models/constants.js'

const RECENT_TURN_LIMIT = 5
const DEFAULT_MISCONCEPTION_WINDOW = 20
const MISCONCEPTION_BOOST = 3
const MAX_CANDIDATES_TO_HYDRATE = 256

interface ProblemRow {
  id: string
  concept_id: string
  difficulty: DifficultyLevel
  type: Problem['type']
  stem: string
  answer_json: string
  solution_steps_json: string
  misconceptions_json: string
  is_generated: number
}

export interface DialogueProblemGenerator {
  generateProblemVariant(template: ProblemTemplate, difficulty: DifficultyLevel): Promise<Problem>
}

export interface ProblemEngineOptions {
  dialogueGenerator?: DialogueProblemGenerator
  misconceptionWindow?: number
  rng?: () => number
}

export class ProblemEngineError extends Error {}
export class PrerequisiteNotMetError extends ProblemEngineError {}
export class ProblemBankExhaustedError extends ProblemEngineError {}
export class UnknownTargetConceptError extends ProblemEngineError {}

interface ActiveMisconceptions {
  misconceptionIds: Set<string>
  remediationConceptIds: Set<string>
}

/**
 * Maps BKT mastery to the required difficulty tier.
 *
 * Requirement 3.1:
 *   < 0.3       conceptual
 *   [0.3, 0.6) procedural
 *   [0.6, 0.8) application
 *   >= 0.8      proof-sketch
 */
export function difficultyForMastery(mastery: number): DifficultyLevel {
  if (mastery < 0.3) return 'conceptual'
  if (mastery < 0.6) return 'procedural'
  if (mastery < 0.8) return 'application'
  return 'proof-sketch'
}

export class ProblemEngine {
  private readonly db: Database
  private readonly conceptNodes: Map<string, ConceptNode>
  private readonly dialogueGenerator?: DialogueProblemGenerator
  private readonly misconceptionWindow: number
  private readonly rng: () => number

  constructor(db: Database, concepts: readonly ConceptNode[], options: ProblemEngineOptions = {}) {
    this.db = db
    this.conceptNodes = new Map(concepts.map((concept) => [concept.id, concept]))
    this.dialogueGenerator = options.dialogueGenerator
    this.misconceptionWindow = Math.max(
      0,
      Math.floor(options.misconceptionWindow ?? DEFAULT_MISCONCEPTION_WINDOW)
    )
    this.rng = options.rng ?? Math.random
  }

  async selectNextProblem(state: KnowledgeState, session: Session): Promise<Problem> {
    const target = session.targetConcept
    this.assertKnownTargetConcept(target)
    this.assertPrerequisitesMet(target, state)

    const mastery = state.concepts.get(target.id)?.masteryProbability ?? DEFAULT_MASTERY_PRIOR
    const difficulty = difficultyForMastery(mastery)
    const recentIds = new Set(
      session.turns.slice(-RECENT_TURN_LIMIT).map((turn) => turn.problem.id)
    )

    const candidates = this.queryProblems(target.id, difficulty)
    const unseenCandidates = candidates.filter((problem) => !recentIds.has(problem.id))

    if (unseenCandidates.length > 0) {
      return this.weightedSample(unseenCandidates, this.getActiveMisconceptions(session))
    }

    if (candidates.length > 0) {
      // Req 3.3 takes precedence over Req 3.2's "unless no other problems exist"
      // clause: once every curated candidate is in the last-5 window, generate a
      // fresh variant instead of replaying a recent problem. If no generator is
      // configured, generateVariant raises ProblemBankExhaustedError.
      return this.generateVariant(this.problemToTemplate(candidates[0]), difficulty)
    }

    return this.generateVariant(this.emptyTemplate(target.id, difficulty), difficulty)
  }

  async generateVariant(template: ProblemTemplate, difficulty: DifficultyLevel): Promise<Problem> {
    if (this.dialogueGenerator === undefined) {
      throw new ProblemBankExhaustedError(
        `No curated problems remain for ${template.conceptId}/${difficulty}, and no DialogueGenerator was provided`
      )
    }

    const generated = await this.dialogueGenerator.generateProblemVariant(template, difficulty)
    const problem: Problem = { ...generated, difficulty, isGenerated: true }
    this.cacheGeneratedProblem(problem)
    return problem
  }

  getSolutionSteps(problem: Problem): SolutionStep[] {
    return problem.solutionSteps
  }

  private queryProblems(conceptId: string, difficulty: DifficultyLevel): Problem[] {
    const rows = this.db
      .prepare<[string, string], ProblemRow>(
        `SELECT p.id, p.concept_id, p.difficulty, p.type, p.stem,
                p.answer_json, p.solution_steps_json, p.misconceptions_json,
                p.is_generated
         FROM problems p
         JOIN problems_fts fts ON p.rowid = fts.rowid
         WHERE fts.concept_id MATCH ? AND fts.difficulty MATCH ?
         ORDER BY p.id
         LIMIT ${MAX_CANDIDATES_TO_HYDRATE}`
      )
      .all(quoteFtsTerm(conceptId), quoteFtsTerm(difficulty))

    return rows.map(rowToProblem)
  }

  private assertPrerequisitesMet(concept: ConceptNode, state: KnowledgeState): void {
    for (const prereqId of concept.prerequisites) {
      const mastery = state.concepts.get(prereqId)?.masteryProbability ?? DEFAULT_MASTERY_PRIOR
      if (mastery < PREREQUISITE_MASTERY_THRESHOLD) {
        throw new PrerequisiteNotMetError(
          `Cannot select problem for "${concept.id}": prerequisite "${prereqId}" has mastery ${mastery}`
        )
      }
    }
  }

  private assertKnownTargetConcept(concept: ConceptNode): void {
    if (!this.conceptNodes.has(concept.id)) {
      throw new UnknownTargetConceptError(
        `Cannot select problem for unknown target concept "${concept.id}"`
      )
    }
  }

  private getActiveMisconceptions(session: Session): ActiveMisconceptions {
    const active: ActiveMisconceptions = {
      misconceptionIds: new Set<string>(),
      remediationConceptIds: new Set<string>(),
    }
    const recentTurns =
      this.misconceptionWindow === 0 ? [] : session.turns.slice(-this.misconceptionWindow)
    for (const turn of recentTurns) {
      for (const misconception of turn.evaluationResult.misconceptions) {
        active.misconceptionIds.add(misconception.id)
        active.remediationConceptIds.add(misconception.remediationConceptId)
      }
    }
    return active
  }

  private weightedSample(candidates: Problem[], activeMisconceptions: ActiveMisconceptions): Problem {
    const weights = candidates.map((problem) =>
      problem.commonMisconceptions.some((misconception) =>
        activeMisconceptions.misconceptionIds.has(misconception.id) ||
        activeMisconceptions.remediationConceptIds.has(misconception.remediationConceptId)
      )
        ? MISCONCEPTION_BOOST
        : 1
    )

    const total = weights.reduce((sum, weight) => sum + weight, 0)
    let pick = this.rng() * total
    for (let i = 0; i < candidates.length; i++) {
      pick -= weights[i]
      if (pick < 0) return candidates[i]
    }
    return candidates[candidates.length - 1]
  }

  private problemToTemplate(problem: Problem): ProblemTemplate {
    return {
      id: `${problem.id}-variant-template`,
      conceptId: problem.conceptId,
      difficulty: problem.difficulty,
      templateStem: problem.stem,
      // Empty parameterRanges means this is not a deterministic placeholder
      // template; Task 10's Dialogue Generator should produce a fresh problem
      // in the same spirit as the source stem.
      parameterRanges: {},
      answerTemplate: problem.answer.raw,
    }
  }

  private emptyTemplate(conceptId: string, difficulty: DifficultyLevel): ProblemTemplate {
    return {
      id: `${conceptId}-${difficulty}-empty-template`,
      conceptId,
      difficulty,
      templateStem: `Generate a ${difficulty} calculus problem for ${conceptId}.`,
      // No curated exemplar exists for this slice, so this is a free-form prompt
      // rather than a parameterized template.
      parameterRanges: {},
      answerTemplate: '',
    }
  }

  private cacheGeneratedProblem(problem: Problem): void {
    this.db
      .prepare<[string, string, string, string, string, string, string, string, number]>(
        `INSERT OR IGNORE INTO problems
          (id, concept_id, difficulty, type, stem,
           answer_json, solution_steps_json, misconceptions_json, is_generated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        problem.id,
        problem.conceptId,
        problem.difficulty,
        problem.type,
        problem.stem,
        JSON.stringify(problem.answer),
        JSON.stringify(problem.solutionSteps),
        JSON.stringify(problem.commonMisconceptions),
        1
      )
  }
}

function rowToProblem(row: ProblemRow): Problem {
  return {
    id: row.id,
    conceptId: row.concept_id,
    difficulty: row.difficulty,
    type: row.type,
    stem: row.stem,
    answer: JSON.parse(row.answer_json) as Problem['answer'],
    solutionSteps: JSON.parse(row.solution_steps_json) as SolutionStep[],
    commonMisconceptions: JSON.parse(row.misconceptions_json) as Misconception[],
    isGenerated: row.is_generated === 1,
  }
}

function quoteFtsTerm(term: string): string {
  return `"${term.replace(/"/g, '""')}"`
}
