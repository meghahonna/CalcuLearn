/**
 * Session Engine orchestration for CalcuLearn.
 */

import type {
  EvaluationResult,
  HintResult,
  KnowledgeState,
  Problem,
  Session,
  SessionSummary,
  TurnRecord,
  TurnResult,
} from '../models/types.js'
import { randomUUID } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import { KnowledgeStateManager } from './knowledgeStateManager.js'
import { ProblemEngine } from './problemEngine.js'
import { AnswerEvaluator } from './answerEvaluator.js'
import { DialogueGenerator } from './dialogueGenerator.js'
import { TranslationLayer } from './translationLayer.js'

export interface SessionEngineOptions {
  ksm: KnowledgeStateManager
  problemEngine: ProblemEngine
  answerEvaluator: AnswerEvaluator
  dialogueGenerator: Pick<DialogueGenerator, 'generateIntroduction' | 'generateFeedback' | 'generateHint'>
  translationLayer: Pick<TranslationLayer, 'translate'>
  /**
   * Database connection used to persist `session_history` rows on `endSession`.
   * Optional for callers that don't need durable session history (e.g. tests
   * that only exercise BKT updates), but required by Reqs 1.4 and 7.2 in
   * production wiring.
   */
  db?: Database
  targetLanguage?: string
  idGenerator?: () => string
}

interface ActiveSession {
  session: Session
  state: KnowledgeState
  startingMastery: Map<string, number>
  consecutiveCorrect: Map<string, number>
  introductionText: string
}

export class SessionEngine {
  private readonly ksm: KnowledgeStateManager
  private readonly problemEngine: ProblemEngine
  private readonly answerEvaluator: AnswerEvaluator
  private readonly dialogueGenerator: SessionEngineOptions['dialogueGenerator']
  private readonly translationLayer: SessionEngineOptions['translationLayer']
  private readonly db: Database | undefined
  private readonly targetLanguage: string
  private readonly idGenerator: () => string
  private readonly sessions = new Map<string, ActiveSession>()

  constructor(options: SessionEngineOptions) {
    this.ksm = options.ksm
    this.problemEngine = options.problemEngine
    this.answerEvaluator = options.answerEvaluator
    this.dialogueGenerator = options.dialogueGenerator
    this.translationLayer = options.translationLayer
    this.db = options.db
    this.targetLanguage = options.targetLanguage ?? 'en'
    this.idGenerator = options.idGenerator ?? (() => randomUUID())
  }

  async beginSession(studentId: string): Promise<Session> {
    const state = this.ksm.loadState(studentId)
    this.ksm.applySessionStartDecay(state)
    const targetConcept = this.ksm.getNextTargetConcept(state)
    if (targetConcept === null) {
      throw new Error('No available target concept for session')
    }

    const session: Session = {
      sessionId: this.idGenerator(),
      studentId,
      startTime: new Date(),
      turns: [],
      currentProblem: null,
      hintCount: 0,
      targetConcept,
    }
    const problem = await this.problemEngine.selectNextProblem(state, session)
    session.currentProblem = problem
    const intro = await this.translationLayer.translate(
      await this.dialogueGenerator.generateIntroduction(problem, state),
      this.targetLanguage
    )

    this.sessions.set(session.sessionId, {
      session,
      state,
      startingMastery: snapshotMastery(state),
      consecutiveCorrect: new Map(),
      introductionText: intro,
    })
    return session
  }

  getIntroduction(sessionId: string): string {
    return this.requireSession(sessionId).introductionText
  }

  async submitAnswer(sessionId: string, rawAnswer: string): Promise<TurnResult> {
    const active = this.requireSession(sessionId)
    const problem = active.session.currentProblem
    if (problem === null) throw new Error('No current problem to answer')

    const result = await this.answerEvaluator.evaluate(problem, rawAnswer)
    this.ksm.updateStateForConcept(active.session.studentId, active.state, result, problem.conceptId)
    this.updateCorrectStreak(active, problem, result)

    const feedbackText = await this.translationLayer.translate(
      await this.dialogueGenerator.generateFeedback(problem, result, active.state),
      this.targetLanguage
    )

    const turn: TurnRecord = {
      turnId: this.idGenerator(),
      problem,
      rawAnswer,
      evaluationResult: result,
      feedbackShown: feedbackText,
      hintsUsed: active.session.hintCount,
      durationMs: 0,
    }
    active.session.turns.push(turn)

    let conceptAdvanced = false
    if (this.shouldAdvance(active, problem.conceptId)) {
      const next = this.ksm.getNextTargetConcept(active.state)
      if (next !== null && next.id !== active.session.targetConcept.id) {
        active.session.targetConcept = next
        conceptAdvanced = true
      }
    }

    active.session.currentProblem = await this.problemEngine.selectNextProblem(active.state, active.session)

    return {
      evaluationResult: result,
      feedbackText,
      turnCount: active.session.turns.length,
      masteryUpdated: true,
      conceptAdvanced,
    }
  }

  async requestHint(sessionId: string): Promise<HintResult> {
    const active = this.requireSession(sessionId)
    const problem = active.session.currentProblem
    if (problem === null) throw new Error('No current problem for hint')

    active.session.hintCount += 1
    this.ksm.applyHintPenalty(active.state, problem.conceptId)
    const text = await this.translationLayer.translate(
      await this.dialogueGenerator.generateHint(problem, active.session.hintCount, active.state),
      this.targetLanguage
    )
    return {
      text,
      hintLevel: active.session.hintCount,
      hintCount: active.session.hintCount,
    }
  }

  async endSession(sessionId: string): Promise<SessionSummary> {
    const active = this.requireSession(sessionId)
    this.ksm.persistState(active.session.studentId, active.state)
    const endTime = new Date()
    const deltas = computeMasteryDeltas(active.startingMastery, active.state)
    const summary: SessionSummary = {
      sessionId,
      studentId: active.session.studentId,
      totalTurns: active.session.turns.length,
      hintsUsed: active.session.hintCount,
      conceptsProgressed: Object.entries(deltas)
        .filter(([, delta]) => delta > 0)
        .map(([conceptId]) => conceptId),
      masteryDeltas: deltas,
      startTime: active.session.startTime,
      endTime,
    }
    this.persistSessionHistory(active.session, endTime)
    this.sessions.delete(sessionId)
    return summary
  }

  /**
   * Inserts a `session_history` row for the completed session (Reqs 1.4, 7.2).
   * No-op when the engine wasn't constructed with a `db` (e.g. tests that
   * exercise only BKT updates). Uses INSERT OR REPLACE so a re-ended session
   * (in case of crash recovery) updates the existing row rather than throwing.
   */
  private persistSessionHistory(session: Session, endTime: Date): void {
    if (this.db === undefined) return
    this.db
      .prepare<[string, string, number, number, string]>(
        `INSERT OR REPLACE INTO session_history
           (session_id, student_id, start_time, end_time, turns_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        session.sessionId,
        session.studentId,
        session.startTime.getTime(),
        endTime.getTime(),
        JSON.stringify(session.turns)
      )
  }

  private requireSession(sessionId: string): ActiveSession {
    const active = this.sessions.get(sessionId)
    if (active === undefined) throw new Error(`Unknown session: ${sessionId}`)
    return active
  }

  private updateCorrectStreak(active: ActiveSession, problem: Problem, result: EvaluationResult): void {
    const current = active.consecutiveCorrect.get(problem.conceptId) ?? 0
    active.consecutiveCorrect.set(problem.conceptId, result.isCorrect ? current + 1 : 0)
  }

  private shouldAdvance(active: ActiveSession, conceptId: string): boolean {
    const mastery = active.state.concepts.get(conceptId)?.masteryProbability ?? 0
    return mastery >= 0.85 && (active.consecutiveCorrect.get(conceptId) ?? 0) >= 3
  }
}

function snapshotMastery(state: KnowledgeState): Map<string, number> {
  return new Map([...state.concepts].map(([id, mastery]) => [id, mastery.masteryProbability]))
}

function computeMasteryDeltas(start: Map<string, number>, state: KnowledgeState): Record<string, number> {
  const deltas: Record<string, number> = {}
  for (const [id, mastery] of state.concepts) {
    deltas[id] = mastery.masteryProbability - (start.get(id) ?? 0)
  }
  return deltas
}
