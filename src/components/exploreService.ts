/**
 * src/components/exploreService.ts — A3 (Explore Mode)
 *
 * Free-form "ask me anything" tutor surface. The student types a
 * question; we route it to one concept via ConceptRouter, then answer
 * using ONLY that concept's pre-authored content under the strict leash:
 * the SLM may paraphrase + connect, never invent new mathematics.
 *
 * Architecture:
 *
 *   start()        -> creates an in-memory session keyed by sessionId
 *   ask(question)  -> routes question -> picks concept -> assembles
 *                     a tight system+user prompt that gives the SLM
 *                     the authored content as ground truth -> returns
 *                     the SLM reply + 2-3 deterministic follow-up chips
 *
 * Conversation memory: we keep the last 6 turns in-memory and pass them
 * to the SLM as context. If the router re-routes (student pivots topic),
 * we drop the old conversation and start the new context fresh.
 *
 * Follow-up chips come straight from the authored content for the
 * routed concept:
 *   - "Show me an example"       -> pulls a worked example
 *   - "Why does this work?"      -> pulls a deep dive (if available)
 *   - "Common mistakes"          -> pulls a misconception
 *   - "A real-world application" -> pulls an application (if available)
 *   - "Open the Learn walkthrough" -> deep-links into Learn Mode
 *
 * Off-topic: if the router returns null, we surface a polite "I can only
 * help with AP Calculus" message and offer 3 random concept suggestions.
 */

import { v4 as uuidv4 } from 'uuid'
import type { DialogueGenerator } from './dialogueGenerator.js'
import type { ContentRetrieval, Misconception, WorkedExample } from './contentRetrieval.js'
import type { ConceptRouter, RouteResult } from './conceptRouter.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExploreTurn {
  role: 'student' | 'agent'
  text: string
  conceptId?: string
  meta?: Record<string, unknown>
}

export interface ExploreSession {
  id: string
  studentId: string
  /** Most recent routed concept (used as the conversation focus). */
  currentConceptId: string | null
  turns: ExploreTurn[]
  createdAt: number
}

export interface FollowUpChip {
  id: string
  label: string
  /** What to do when clicked. The UI maps these to actions. */
  action:
    | { kind: 'ask_followup'; question: string }
    | { kind: 'open_learn'; conceptId: string }
    | { kind: 'open_challenge'; conceptId: string }
}

export interface AskResponse {
  sessionId: string
  agentMessage: string
  routedConceptId: string | null
  routedConceptName: string | null
  /** Whether the question was off-topic. */
  offTopic: boolean
  followUps: FollowUpChip[]
  /** For debug / telemetry — the router's verdict. */
  routerVerdict?: {
    tier: 1 | 2
    confidence: number
    candidates: Array<{ conceptId: string; score: number }>
    latencyMs: number
  }
}

export interface ExploreServiceOptions {
  router: ConceptRouter
  content: ContentRetrieval
  dialogue: DialogueGenerator
  /** Cap on conversation memory. Default 6. */
  maxTurns?: number
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

// ---------------------------------------------------------------------------
// Off-topic suggestions — pick 3 well-known concepts every time
// ---------------------------------------------------------------------------

const OFF_TOPIC_SUGGESTIONS = ['deriv.power-rule', 'integ.riemann', 'limits.definition']

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ExploreService {
  private readonly sessions = new Map<string, ExploreSession>()
  private readonly maxTurns: number
  private readonly logger: Pick<Console, 'log' | 'warn' | 'error'>

  constructor(private readonly opts: ExploreServiceOptions) {
    this.maxTurns = opts.maxTurns ?? 6
    this.logger = opts.logger ?? console
  }

  start(studentId: string): { sessionId: string } {
    const id = uuidv4()
    this.sessions.set(id, {
      id,
      studentId,
      currentConceptId: null,
      turns: [],
      createdAt: Date.now(),
    })
    return { sessionId: id }
  }

  getSession(sessionId: string): ExploreSession | undefined {
    return this.sessions.get(sessionId)
  }

  /** Public for telemetry / tests. */
  resetSession(sessionId: string): void {
    const s = this.sessions.get(sessionId)
    if (s) {
      s.currentConceptId = null
      s.turns = []
    }
  }

  // -------------------------------------------------------- ask

  async ask(sessionId: string, question: string, opts?: { pinConceptId?: string | null }): Promise<AskResponse> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Explore session not found: ${sessionId}`)

    const cleaned = question.trim()
    if (cleaned.length === 0) {
      return {
        sessionId,
        agentMessage: 'What would you like to ask?',
        routedConceptId: null,
        routedConceptName: null,
        offTopic: false,
        followUps: [],
      }
    }

    // 1. Record student turn
    session.turns.push({ role: 'student', text: cleaned })
    this.trimTurns(session)

    // 2. Route to a concept (or use the pinned concept if provided, e.g. from a chip)
    let verdict: RouteResult
    if (opts?.pinConceptId && this.opts.content.isAuthored(opts.pinConceptId)) {
      const concept = this.opts.content.getConcept(opts.pinConceptId)
      verdict = {
        conceptId: opts.pinConceptId,
        conceptName: concept?.name,
        confidence: 1.0,
        tier: 1,
        candidates: [{ conceptId: opts.pinConceptId, score: 1.0 }],
        reason: 'pinned by caller (chip context)',
        latencyMs: 0,
      }
    } else {
      verdict = await this.opts.router.route(cleaned)
    }

    // 3. Off-topic handling
    if (!verdict.conceptId) {
      const suggestions = OFF_TOPIC_SUGGESTIONS
        .map((id) => this.opts.content.getConcept(id))
        .filter((c) => !!c)
        .slice(0, 3)
      const suggList = suggestions
        .map((c) => `"${c!.name}"`)
        .join(', ')
      const offTopicMsg =
        `I can only help with AP Calculus AB/BC. If you'd like, ` +
        `try asking about ${suggList}.`
      session.turns.push({
        role: 'agent', text: offTopicMsg,
        meta: { offTopic: true },
      })
      return {
        sessionId,
        agentMessage: offTopicMsg,
        routedConceptId: null,
        routedConceptName: null,
        offTopic: true,
        followUps: suggestions.map((c) => ({
          id: `suggest_${c!.id}`,
          label: c!.name,
          action: { kind: 'ask_followup', question: `Tell me about ${c!.name}` },
        })),
        routerVerdict: {
          tier: verdict.tier,
          confidence: verdict.confidence,
          candidates: verdict.candidates,
          latencyMs: verdict.latencyMs,
        },
      }
    }

    // 4. Topic pivot: if the student's question switched concepts, reset memory
    if (session.currentConceptId && session.currentConceptId !== verdict.conceptId) {
      this.logger.log(
        `[Explore] pivot: ${session.currentConceptId} -> ${verdict.conceptId}`
      )
      // Keep ONLY the current student turn; drop earlier history
      session.turns = session.turns.slice(-1)
    }
    session.currentConceptId = verdict.conceptId

    // 5. Generate the agent reply using authored content as ground truth
    const agentMessage = await this.generateReply(session, verdict, cleaned)
    session.turns.push({
      role: 'agent',
      text: agentMessage,
      conceptId: verdict.conceptId,
      meta: {
        routerTier: verdict.tier,
        routerConfidence: verdict.confidence,
      },
    })
    this.trimTurns(session)

    // 6. Build follow-up chips from authored content
    const followUps = this.buildFollowUps(verdict.conceptId)

    return {
      sessionId,
      agentMessage,
      routedConceptId: verdict.conceptId,
      routedConceptName: verdict.conceptName ?? null,
      offTopic: false,
      followUps,
      routerVerdict: {
        tier: verdict.tier,
        confidence: verdict.confidence,
        candidates: verdict.candidates,
        latencyMs: verdict.latencyMs,
      },
    }
  }

  // ----------------------------------------------- internals

  private trimTurns(session: ExploreSession): void {
    const max = this.maxTurns * 2 // count student+agent as 2
    while (session.turns.length > max) session.turns.shift()
  }

  /** The strict-leash response prompt. */
  private async generateReply(
    session: ExploreSession,
    verdict: RouteResult,
    question: string
  ): Promise<string> {
    const conceptId = verdict.conceptId!
    const concept = this.opts.content.getConcept(conceptId)
    if (!concept) return "I'm having trouble finding information on that topic — try rephrasing?"

    // Pull GROUND-TRUTH content for the concept
    const explanation = this.opts.content.getExplanation(conceptId, 'on_pace', 0)
      ?? this.opts.content.getExplanation(conceptId, 'novice', 0)
      ?? this.opts.content.getExplanation(conceptId, 'advanced', 0)
    const misconceptions = this.opts.content.listMisconceptions(conceptId).slice(0, 3)
    const examples: WorkedExample | null = this.opts.content.getExample(conceptId, 'on_pace') ?? this.opts.content.getExample(conceptId, 'novice') ?? null

    const historySnippet = session.turns
      .slice(-4, -1) // last few turns BEFORE the current question
      .map((t) => `  [${t.role}]: ${t.text.slice(0, 200)}`)
      .join('\n') || '(none)'

    const system = `You are the Explore Mode tutor inside the CalcuLearn AP Calculus app.

STRICT RULES (non-negotiable):
1. You may ONLY draw on the GROUND TRUTH content provided below. Do NOT
   introduce new formulas, examples, or facts.
2. Be conversational and brief: 2-4 sentences, max ~70 words.
3. Use LaTeX for math. Inline: $f(x)$. Block: $$...$$.
4. Speak directly to one student. "You", not "we" or "students".
5. No emojis. No filler. No "Great question!" openers.
6. End with at most ONE clarifying question, ONLY if the student's
   question is ambiguous. If they asked a direct question, just answer.
7. If the question is too broad ("explain calculus"), pick the SINGLE
   most useful angle from the ground truth — don't try to cover everything.`

    const ground = [
      `CONCEPT: ${concept.name} (${conceptId})`,
      `ONE-LINER: ${concept.one_liner ?? '(none)'}`,
      ``,
      `EXPLANATION:`,
      explanation?.body_md.slice(0, 1500) ?? '(none)',
    ]
    if (misconceptions.length > 0) {
      ground.push('', 'COMMON MISCONCEPTIONS (only mention if relevant):')
      misconceptions.forEach((m, i) => {
        ground.push(`  ${i + 1}. ${m.short_name}: ${m.description_md.slice(0, 200)}`)
      })
    }
    if (examples?.problem_md) {
      ground.push('', `EXAMPLE PROBLEM (if relevant): ${examples.problem_md.slice(0, 200)}`)
    }

    const user = `${ground.join('\n')}

CONVERSATION HISTORY (last few turns, oldest first):
${historySnippet}

STUDENT'S CURRENT QUESTION: "${question.slice(0, 500)}"

Reply now. 2-4 sentences. No prose preamble. No bullet lists. Just answer.`

    try {
      const reply = (await this.opts.dialogue.inferRaw(`${system}\n\n${user}`, 350)).trim()
      if (reply.length === 0) {
        return this.fallbackReply(concept.name, explanation?.body_md ?? '')
      }
      return reply
    } catch (err) {
      this.logger.warn(`[Explore] SLM error: ${(err as Error).message}`)
      return this.fallbackReply(concept.name, explanation?.body_md ?? '')
    }
  }

  /** Deterministic fallback if the SLM is unavailable. */
  private fallbackReply(conceptName: string, explanationMd: string): string {
    const first = explanationMd.split(/(?<=[.!?])\s/)[0]?.trim() ?? ''
    if (first) {
      return `Here's the short version on ${conceptName}: ${first}`
    }
    return `That's about ${conceptName}. Try the Learn Mode walkthrough for a full explanation.`
  }

  private buildFollowUps(conceptId: string): FollowUpChip[] {
    const chips: FollowUpChip[] = []
    // Worked example always — every authored concept has at least one
    const ex = this.opts.content.getExample(conceptId, 'on_pace')
      ?? this.opts.content.getExample(conceptId, 'novice')
    if (ex) {
      chips.push({
        id: 'example',
        label: 'Show me an example',
        action: { kind: 'ask_followup', question: 'Walk me through a worked example.' },
      })
    }
    // Deep dive
    const dives = this.opts.content.listDeepDives(conceptId)
    if (dives.length > 0) {
      chips.push({
        id: 'deep_dive',
        label: 'Why does this work?',
        action: { kind: 'ask_followup', question: 'Explain why this is true, not just how to use it.' },
      })
    }
    // Misconceptions
    const miscs = this.opts.content.listMisconceptions(conceptId)
    if (miscs.length > 0) {
      chips.push({
        id: 'misconceptions',
        label: 'Common mistakes',
        action: { kind: 'ask_followup', question: 'What are the most common mistakes here?' },
      })
    }
    // Application
    const apps = this.opts.content.listApplications(conceptId)
    if (apps.length > 0) {
      chips.push({
        id: 'application',
        label: 'A real-world use',
        action: { kind: 'ask_followup', question: 'Give me a real-world application.' },
      })
    }
    // Deep links
    chips.push({
      id: 'open_learn',
      label: 'Open Learn walkthrough',
      action: { kind: 'open_learn', conceptId },
    })
    return chips.slice(0, 4) // keep it visually tight
  }
}
