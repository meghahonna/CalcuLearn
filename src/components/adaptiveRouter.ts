/**
 * AdaptiveRouter — Phase D
 *
 * Records per-(student, concept) engagement signals and uses them to:
 *   1. Classify the student's archetype on this concept
 *      (struggling | on_pace | advanced | unknown).
 *   2. Recommend a routing action when conditions are met
 *      (e.g., fail-twice -> suggest Learn Mode, ace-3 -> unlock Challenge).
 *
 * Signals come from two sources:
 *   - SessionEngine (Practice attempts, hints, confidence chips)
 *   - LearnModeService (Learn engagements, "I don't know" clicks, completions)
 *
 * Recommendations are returned to the UI via /api/adaptive/suggestion and
 * surfaced as proactive nudges ("Stuck? Open Learn Mode for X").
 *
 * No SLM calls. Pure deterministic logic on top of the signals table —
 * always sub-millisecond, no inference budget.
 */

import type { Database } from 'better-sqlite3'

// ---------- Types ----------

export type Archetype = 'struggling' | 'on_pace' | 'advanced' | 'unknown'
export type Confidence = 'got_it' | 'guessed' | 'shaky'

export interface RecentAttempt {
  ts: number
  source: 'practice' | 'learn'
  correct: boolean
  hints: number
  durationMs?: number
  confidence?: Confidence
}

export interface SignalRow {
  studentId: string
  conceptId: string
  recentAttempts: RecentAttempt[]
  practiceAttempts: number
  practiceCorrect: number
  practiceHintsUsed: number
  dontKnowCount: number
  learnEngagements: number
  learnCompletions: number
  consecutiveFailures: number
  consecutiveAces: number
  archetype: Archetype
  archetypeUpdatedAt: number | null
  lastConfidence: Confidence | null
  lastConfidenceAt: number | null
  challengeUnlocked: boolean
  updatedAt: number
}

export interface RoutingSuggestion {
  conceptId: string
  archetype: Archetype
  /** What we recommend the student do next. */
  action:
    | { kind: 'open_learn'; tier: 'novice' | 'on_pace'; reason: string }
    | { kind: 'unlock_challenge'; reason: string }
    | { kind: 'continue_practice'; reason: string }
    | { kind: 'try_alt_framing'; reason: string }
    | { kind: 'none' }
  /** Human-readable rationale for the UI to display. */
  message: string
}

const RECENT_WINDOW = 10 // keep last 10 attempts per concept
const ARCHETYPE_MIN_ATTEMPTS = 2

// ---------- Service ----------

export interface AdaptiveRouterOptions {
  db: Database
  /** Override clock for tests. */
  now?: () => number
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

export class AdaptiveRouter {
  private readonly db: Database
  private readonly now: () => number
  private readonly logger: Pick<Console, 'log' | 'warn' | 'error'>

  constructor(opts: AdaptiveRouterOptions) {
    this.db = opts.db
    this.now = opts.now ?? (() => Date.now())
    this.logger = opts.logger ?? console
  }

  // ----------------------------------------------------- Read

  getSignals(studentId: string, conceptId: string): SignalRow {
    const row = this.db
      .prepare(
        `SELECT * FROM student_concept_signals
         WHERE student_id = ? AND concept_id = ?`
      )
      .get(studentId, conceptId) as Record<string, unknown> | undefined

    if (!row) return this.emptyRow(studentId, conceptId)
    return this.rowToSignal(row)
  }

  /** All non-empty signal rows for a student (used by /api/adaptive/profile). */
  listSignalsForStudent(studentId: string): SignalRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM student_concept_signals WHERE student_id = ? ORDER BY updated_at DESC`
      )
      .all(studentId) as Array<Record<string, unknown>>
    return rows.map((r) => this.rowToSignal(r))
  }

  // ----------------------------------------------------- Record

  /** Record a Practice attempt. Updates rolling counters and re-classifies. */
  recordPracticeAttempt(args: {
    studentId: string
    conceptId: string
    correct: boolean
    hintsUsed: number
    durationMs?: number
  }): SignalRow {
    const cur = this.getSignals(args.studentId, args.conceptId)
    const recent = pushRecent(cur.recentAttempts, {
      ts: this.now(),
      source: 'practice',
      correct: args.correct,
      hints: args.hintsUsed,
      durationMs: args.durationMs,
    })

    const next: SignalRow = {
      ...cur,
      recentAttempts: recent,
      practiceAttempts: cur.practiceAttempts + 1,
      practiceCorrect: cur.practiceCorrect + (args.correct ? 1 : 0),
      practiceHintsUsed: cur.practiceHintsUsed + args.hintsUsed,
      consecutiveFailures: args.correct ? 0 : cur.consecutiveFailures + 1,
      consecutiveAces: args.correct && args.hintsUsed === 0 ? cur.consecutiveAces + 1 : 0,
      updatedAt: this.now(),
    }
    this.classifyAndUnlock(next)
    this.upsert(next)
    return next
  }

  /** Record a Learn Mode engagement (start of a walkthrough). */
  recordLearnEngagement(args: {
    studentId: string
    conceptId: string
  }): SignalRow {
    const cur = this.getSignals(args.studentId, args.conceptId)
    const next: SignalRow = {
      ...cur,
      learnEngagements: cur.learnEngagements + 1,
      updatedAt: this.now(),
    }
    this.classifyAndUnlock(next)
    this.upsert(next)
    return next
  }

  /** Record a completed Learn Mode walkthrough. */
  recordLearnCompletion(args: { studentId: string; conceptId: string }): SignalRow {
    const cur = this.getSignals(args.studentId, args.conceptId)
    const next: SignalRow = {
      ...cur,
      learnCompletions: cur.learnCompletions + 1,
      updatedAt: this.now(),
    }
    this.classifyAndUnlock(next)
    this.upsert(next)
    return next
  }

  /** Record an "I don't know" click during Practice or Learn. */
  recordDontKnow(args: { studentId: string; conceptId: string }): SignalRow {
    const cur = this.getSignals(args.studentId, args.conceptId)
    const next: SignalRow = {
      ...cur,
      dontKnowCount: cur.dontKnowCount + 1,
      updatedAt: this.now(),
    }
    this.classifyAndUnlock(next)
    this.upsert(next)
    return next
  }

  /** Record a self-reported confidence chip after Practice. */
  recordConfidence(args: {
    studentId: string
    conceptId: string
    confidence: Confidence
  }): SignalRow {
    const cur = this.getSignals(args.studentId, args.conceptId)
    // Append to the most recent attempt if exists
    const recent = [...cur.recentAttempts]
    if (recent.length > 0) {
      recent[recent.length - 1] = { ...recent[recent.length - 1]!, confidence: args.confidence }
    }
    const next: SignalRow = {
      ...cur,
      recentAttempts: recent,
      lastConfidence: args.confidence,
      lastConfidenceAt: this.now(),
      updatedAt: this.now(),
    }
    this.classifyAndUnlock(next)
    this.upsert(next)
    return next
  }

  // ----------------------------------------------------- Suggestion

  /**
   * Produce a routing suggestion for the student on this concept based on
   * the signals collected so far.
   */
  suggest(studentId: string, conceptId: string): RoutingSuggestion {
    const s = this.getSignals(studentId, conceptId)

    // Rule 1: 2+ consecutive failures => suggest Learn Mode (struggling).
    if (s.consecutiveFailures >= 2) {
      return {
        conceptId,
        archetype: s.archetype,
        action: {
          kind: 'open_learn',
          tier: 'novice',
          reason: `${s.consecutiveFailures} attempts in a row missed`,
        },
        message: `Looks like this is tricky right now. Want to walk through it step-by-step in Learn Mode?`,
      }
    }

    // Rule 2: 3+ consecutive aces (no hints) => unlock Challenge if not already.
    if (s.consecutiveAces >= 3 && !s.challengeUnlocked) {
      return {
        conceptId,
        archetype: s.archetype,
        action: {
          kind: 'unlock_challenge',
          reason: `${s.consecutiveAces} in a row without hints`,
        },
        message: `You're on a roll. Ready for a challenge problem?`,
      }
    }

    // Rule 3: high "I don't know" rate -> suggest Learn Mode at novice.
    if (s.dontKnowCount >= 2) {
      return {
        conceptId,
        archetype: s.archetype,
        action: {
          kind: 'open_learn',
          tier: 'novice',
          reason: `${s.dontKnowCount} "I don't know" clicks`,
        },
        message: `Let's slow down and rebuild from the basics.`,
      }
    }

    // Rule 4: confidence is shaky despite correct answers -> alt framing.
    if (s.lastConfidence === 'shaky' || s.lastConfidence === 'guessed') {
      return {
        conceptId,
        archetype: s.archetype,
        action: {
          kind: 'try_alt_framing',
          reason: `Self-reported ${s.lastConfidence}`,
        },
        message: `You said you weren't sure on that one. Want a quick refresher?`,
      }
    }

    // Default: keep practicing.
    return {
      conceptId,
      archetype: s.archetype,
      action: { kind: 'continue_practice', reason: 'no triggers' },
      message: '',
    }
  }

  // ----------------------------------------------------- Internals

  private classifyAndUnlock(s: SignalRow): void {
    s.archetype = this.classifyArchetype(s)
    s.archetypeUpdatedAt = this.now()

    // Unlock challenge mode when student is advanced AND has 3+ aces.
    if (s.archetype === 'advanced' && s.consecutiveAces >= 3) {
      s.challengeUnlocked = true
    }
  }

  /**
   * Per-concept archetype classifier. Pure function over the signal row.
   * Designed to be conservative: 'unknown' until we have enough data.
   */
  private classifyArchetype(s: SignalRow): Archetype {
    const totalAttempts = s.practiceAttempts
    if (totalAttempts < ARCHETYPE_MIN_ATTEMPTS && s.learnEngagements === 0) {
      return 'unknown'
    }

    const accuracy = totalAttempts === 0 ? 0 : s.practiceCorrect / totalAttempts
    const hintRate = totalAttempts === 0 ? 0 : s.practiceHintsUsed / totalAttempts

    // Struggling signals
    const strugglingSignals =
      Number(s.consecutiveFailures >= 2) +
      Number(s.dontKnowCount >= 2) +
      Number(accuracy < 0.4 && totalAttempts >= 3) +
      Number(hintRate >= 1.0 && totalAttempts >= 3) +
      Number(s.lastConfidence === 'shaky')

    // Advanced signals
    const advancedSignals =
      Number(s.consecutiveAces >= 3) +
      Number(accuracy >= 0.85 && totalAttempts >= 3) +
      Number(hintRate <= 0.1 && totalAttempts >= 3 && accuracy >= 0.75)

    if (strugglingSignals >= 2) return 'struggling'
    if (advancedSignals >= 2) return 'advanced'
    if (totalAttempts >= ARCHETYPE_MIN_ATTEMPTS) return 'on_pace'
    return 'unknown'
  }

  private emptyRow(studentId: string, conceptId: string): SignalRow {
    return {
      studentId,
      conceptId,
      recentAttempts: [],
      practiceAttempts: 0,
      practiceCorrect: 0,
      practiceHintsUsed: 0,
      dontKnowCount: 0,
      learnEngagements: 0,
      learnCompletions: 0,
      consecutiveFailures: 0,
      consecutiveAces: 0,
      archetype: 'unknown',
      archetypeUpdatedAt: null,
      lastConfidence: null,
      lastConfidenceAt: null,
      challengeUnlocked: false,
      updatedAt: this.now(),
    }
  }

  private rowToSignal(r: Record<string, unknown>): SignalRow {
    return {
      studentId: r['student_id'] as string,
      conceptId: r['concept_id'] as string,
      recentAttempts: r['recent_attempts_json']
        ? (JSON.parse(r['recent_attempts_json'] as string) as RecentAttempt[])
        : [],
      practiceAttempts: (r['practice_attempts'] as number) ?? 0,
      practiceCorrect: (r['practice_correct'] as number) ?? 0,
      practiceHintsUsed: (r['practice_hints_used'] as number) ?? 0,
      dontKnowCount: (r['dont_know_count'] as number) ?? 0,
      learnEngagements: (r['learn_engagements'] as number) ?? 0,
      learnCompletions: (r['learn_completions'] as number) ?? 0,
      consecutiveFailures: (r['consecutive_failures'] as number) ?? 0,
      consecutiveAces: (r['consecutive_aces'] as number) ?? 0,
      archetype: ((r['archetype'] as string) ?? 'unknown') as Archetype,
      archetypeUpdatedAt: (r['archetype_updated_at'] as number) ?? null,
      lastConfidence: ((r['last_confidence'] as string) ?? null) as Confidence | null,
      lastConfidenceAt: (r['last_confidence_at'] as number) ?? null,
      challengeUnlocked: !!(r['challenge_unlocked'] as number),
      updatedAt: (r['updated_at'] as number) ?? Date.now(),
    }
  }

  private upsert(s: SignalRow): void {
    this.db
      .prepare(
        `INSERT INTO student_concept_signals
           (student_id, concept_id, recent_attempts_json,
            practice_attempts, practice_correct, practice_hints_used,
            dont_know_count, learn_engagements, learn_completions,
            consecutive_failures, consecutive_aces,
            archetype, archetype_updated_at,
            last_confidence, last_confidence_at,
            challenge_unlocked, updated_at)
         VALUES
           (@studentId, @conceptId, @recent_attempts_json,
            @practice_attempts, @practice_correct, @practice_hints_used,
            @dont_know_count, @learn_engagements, @learn_completions,
            @consecutive_failures, @consecutive_aces,
            @archetype, @archetype_updated_at,
            @last_confidence, @last_confidence_at,
            @challenge_unlocked, @updated_at)
         ON CONFLICT(student_id, concept_id) DO UPDATE SET
           recent_attempts_json   = excluded.recent_attempts_json,
           practice_attempts      = excluded.practice_attempts,
           practice_correct       = excluded.practice_correct,
           practice_hints_used    = excluded.practice_hints_used,
           dont_know_count        = excluded.dont_know_count,
           learn_engagements      = excluded.learn_engagements,
           learn_completions      = excluded.learn_completions,
           consecutive_failures   = excluded.consecutive_failures,
           consecutive_aces       = excluded.consecutive_aces,
           archetype              = excluded.archetype,
           archetype_updated_at   = excluded.archetype_updated_at,
           last_confidence        = excluded.last_confidence,
           last_confidence_at     = excluded.last_confidence_at,
           challenge_unlocked     = excluded.challenge_unlocked,
           updated_at             = excluded.updated_at`
      )
      .run({
        studentId: s.studentId,
        conceptId: s.conceptId,
        recent_attempts_json: JSON.stringify(s.recentAttempts),
        practice_attempts: s.practiceAttempts,
        practice_correct: s.practiceCorrect,
        practice_hints_used: s.practiceHintsUsed,
        dont_know_count: s.dontKnowCount,
        learn_engagements: s.learnEngagements,
        learn_completions: s.learnCompletions,
        consecutive_failures: s.consecutiveFailures,
        consecutive_aces: s.consecutiveAces,
        archetype: s.archetype,
        archetype_updated_at: s.archetypeUpdatedAt,
        last_confidence: s.lastConfidence,
        last_confidence_at: s.lastConfidenceAt,
        challenge_unlocked: s.challengeUnlocked ? 1 : 0,
        updated_at: s.updatedAt,
      })
  }
}

// ---------- Helpers ----------

function pushRecent(arr: RecentAttempt[], a: RecentAttempt): RecentAttempt[] {
  const next = [...arr, a]
  return next.length > RECENT_WINDOW ? next.slice(-RECENT_WINDOW) : next
}
