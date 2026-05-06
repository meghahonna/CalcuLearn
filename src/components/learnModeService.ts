/**
 * LearnModeService — Phase B Socratic runtime.
 *
 * Drives a Learn Mode walkthrough end-to-end: pulls pre-authored content
 * from the DB, wraps it in a Socratic conversational shell rendered by the
 * on-device SLM, classifies student responses, and advances a state machine.
 *
 * The SLM is on a STRICT LEASH: it may only paraphrase, probe, or transition
 * between content blocks. It must not introduce new mathematical content.
 *
 * State machine:
 *
 *   intro  ->  explain  ->  check_understanding  ->  example
 *                ^                  |                    |
 *                |                  v                    v
 *                |         alt_framing            check_understanding_2
 *                |                  |                    |
 *                |                  v                    v
 *                +--- (loop on dont_know if framings exhausted)
 *                                                        v
 *                                                  practice_lite
 *                                                        v
 *                                                       done
 *
 * Sessions are kept in memory (Map). Persistence across server restarts
 * is deferred to Phase D.
 */

import { v4 as uuidv4 } from 'uuid'
import type { DialogueGenerator } from './dialogueGenerator.js'
import type { ResponseClassifier, ClassificationResult } from './responseClassifier.js'
import type { AdaptiveRouter } from './adaptiveRouter.js'
import type {
  ContentRetrieval,
  Tier,
  Explanation,
  WorkedExample,
  Check,
  Misconception,
} from './contentRetrieval.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LearnStage =
  | 'intro'
  | 'explain'
  | 'check_understanding'
  | 'example'
  | 'check_understanding_2'
  | 'practice_lite'
  | 'done'
  | 'aborted'

export interface LearnTurn {
  /** Who said it ("agent" = SLM, "student" = user) */
  role: 'agent' | 'student'
  text: string
  /** Optional metadata: which content block backed this turn, classifier result, etc. */
  meta?: Record<string, unknown>
}

export interface LearnSession {
  id: string
  studentId: string
  conceptId: string
  conceptName: string
  tier: Tier
  /** Index of the framing currently shown (so we know what's "next" if student says "differently") */
  currentFramingIndex: number
  /** Index of the check question we're on within the current stage's checklist */
  checkIndex: number
  /** Which checks this session has used (concept_checks rows by tier) */
  checks: Check[]
  /** All misconceptions for this concept — passed to classifier */
  misconceptions: Misconception[]
  stage: LearnStage
  turns: LearnTurn[]
  startedAt: number
  /** True if all framings exhausted and student still doesn't get it */
  framingsExhausted: boolean
}

export interface LearnTurnResponse {
  sessionId: string
  stage: LearnStage
  /** The agent's message to display */
  agentMessage: string
  /** Optional visible content block (raw markdown) the UI can render alongside */
  contentBlock?: {
    type: 'explanation' | 'intuition' | 'example' | 'check' | 'misconception'
    body_md: string
    title?: string
  }
  /** Whether the walkthrough is complete */
  done: boolean
  /** Available student actions the UI can surface as quick-reply chips */
  suggestedActions?: string[]
}

// ---------------------------------------------------------------------------
// Strict-mode SLM prompt builders
// ---------------------------------------------------------------------------

const SOCRATIC_SYSTEM = `You are a Socratic AP Calculus tutor inside the CalcuLearn app.

STRICT RULES:
1. You may ONLY paraphrase or refer to the CONTENT BLOCK provided.
2. You must NOT introduce new mathematical facts, formulas, or examples
   that are not in the content block.
3. Be brief. 1-3 sentences per turn.
4. Be Socratic: ask the student a question rather than lecturing.
5. Use plain English. LaTeX only when echoing math from the content block.
6. No emojis. No filler.
7. Write to one student. Use "you", not "we".
8. If the content block is empty or irrelevant, say "let's look at this together" and ask a question to anchor the student.`

function shorten(s: string, max = 1500): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '...'
}

function buildIntroPrompt(args: { conceptName: string; oneLiner: string | null }): string {
  return `${SOCRATIC_SYSTEM}

CONTENT BLOCK:
Concept: ${args.conceptName}
One-liner: ${args.oneLiner ?? '(no one-liner)'}

TASK: Greet the student briefly (1 sentence), name the concept, and ask a low-stakes opener
question to gauge what they already know. End with a question.`
}

function buildExplainTransitionPrompt(args: {
  conceptName: string
  explanation: Explanation
}): string {
  return `${SOCRATIC_SYSTEM}

CONTENT BLOCK:
${shorten(args.explanation.body_md)}

${args.explanation.intuition_md ? `INTUITION HINT:\n${shorten(args.explanation.intuition_md, 600)}` : ''}

TASK: In ONE sentence, transition the student into the explanation above (which the UI will
display in full alongside your message). Do not repeat the explanation. End with a brief
prompt like "take a moment, then I'll ask you a quick check."`
}

function buildCheckPrompt(args: { check: Check }): string {
  return `${SOCRATIC_SYSTEM}

CONTENT BLOCK (the question to ask):
${shorten(args.check.question_md)}

TASK: Present this check question to the student naturally. You may paraphrase the framing slightly
but you MUST keep the actual question exactly as written (including any LaTeX). End with the question.`
}

function buildAltFramingPrompt(args: { explanation: Explanation }): string {
  return `${SOCRATIC_SYSTEM}

CONTENT BLOCK (a different way to explain it):
${shorten(args.explanation.body_md)}

TASK: Acknowledge the student is finding it tricky (1 sentence), then transition to the new
framing above (which the UI will render). Do not repeat the explanation in full. Encourage them.`
}

function buildExampleTransitionPrompt(args: { example: WorkedExample }): string {
  return `${SOCRATIC_SYSTEM}

CONTENT BLOCK (the worked example to walk through):
${shorten(args.example.problem_md)}

TASK: In ONE sentence, transition the student to a worked example. Tell them you will walk
through it together. Then ask: "What's the very first thing you would try?" End with that question.`
}

function buildMisconceptionPrompt(args: {
  misconception: Misconception
  studentInput: string
}): string {
  return `${SOCRATIC_SYSTEM}

CONTENT BLOCK (the Socratic response for this misconception):
${shorten(args.misconception.socratic_response_md)}

STUDENT RESPONSE WAS: "${shorten(args.studentInput, 300)}"

TASK: Deliver the Socratic response above to address this specific misconception. You may
paraphrase slightly but keep the question intact. End with the question.`
}

function buildEncouragementPrompt(args: { conceptName: string }): string {
  return `${SOCRATIC_SYSTEM}

CONTENT BLOCK:
The student got the check question correct. Concept: ${args.conceptName}.

TASK: One sentence of brief, calm encouragement. Then transition: "let's try a worked example."
End with that transition.`
}

function buildPartialPrompt(args: { check: Check; studentInput: string }): string {
  return `${SOCRATIC_SYSTEM}

CONTENT BLOCK:
Question: ${shorten(args.check.question_md, 600)}
Expected answer: ${shorten(args.check.expected_answer_md, 400)}
Student's response: "${shorten(args.studentInput, 300)}"

TASK: The student is on the right track but not all the way there. In ONE sentence, name the
piece they got right, then ask a guiding question that nudges them toward the missing piece.
Do not give the answer.`
}

function buildDontKnowPrompt(args: { conceptName: string }): string {
  return `${SOCRATIC_SYSTEM}

CONTENT BLOCK:
The student said they don't know. Concept: ${args.conceptName}.

TASK: Reassure them in ONE sentence that not knowing is fine. Tell them you'll show them a
different way to think about it. End with a brief lead-in like "ready?"`
}

function buildDonePrompt(args: { conceptName: string }): string {
  return `${SOCRATIC_SYSTEM}

CONTENT BLOCK:
Concept just covered: ${args.conceptName}.

TASK: Briefly congratulate the student in ONE sentence (no exclamation marks). Then suggest
they try a practice problem or move to the next concept. End with a question.`
}

// ---------------------------------------------------------------------------
// LearnModeService
// ---------------------------------------------------------------------------

export interface LearnModeServiceOptions {
  contentRetrieval: ContentRetrieval
  dialogueGenerator: DialogueGenerator
  responseClassifier: ResponseClassifier
  /** Default tier when one isn't specified; used by start(). */
  defaultTier?: Tier
  /** Hard cap on session duration; aborts if exceeded. */
  maxDurationMs?: number
  /** Phase D: optional engagement-signal tracker. */
  adaptiveRouter?: AdaptiveRouter
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

export class LearnModeService {
  private readonly content: ContentRetrieval
  private readonly dialogue: DialogueGenerator
  private readonly classifier: ResponseClassifier
  private readonly defaultTier: Tier
  private readonly maxDurationMs: number
  private readonly logger: Pick<Console, 'log' | 'warn' | 'error'>
  private readonly adaptiveRouter: AdaptiveRouter | undefined
  private readonly sessions = new Map<string, LearnSession>()

  constructor(opts: LearnModeServiceOptions) {
    this.content = opts.contentRetrieval
    this.dialogue = opts.dialogueGenerator
    this.classifier = opts.responseClassifier
    this.defaultTier = opts.defaultTier ?? 'on_pace'
    this.maxDurationMs = opts.maxDurationMs ?? 30 * 60 * 1000 // 30 min
    this.logger = opts.logger ?? console
    this.adaptiveRouter = opts.adaptiveRouter
  }

  // ------------------------------------------------------------------ start

  async start(args: {
    studentId: string
    conceptId: string
    tier?: Tier
  }): Promise<LearnTurnResponse> {
    const concept = this.content.getConcept(args.conceptId)
    if (!concept) throw new Error(`Concept not found: ${args.conceptId}`)
    if (!this.content.isAuthored(args.conceptId)) {
      throw new Error(`Concept ${args.conceptId} has no authored content yet.`)
    }

    const tier = args.tier ?? this.defaultTier
    const checks = this.content.listChecks(args.conceptId, tier)
    const misconceptions = this.content.listMisconceptions(args.conceptId)

    const session: LearnSession = {
      id: uuidv4(),
      studentId: args.studentId,
      conceptId: args.conceptId,
      conceptName: concept.name,
      tier,
      currentFramingIndex: 0,
      checkIndex: 0,
      checks,
      misconceptions,
      stage: 'intro',
      turns: [],
      startedAt: Date.now(),
      framingsExhausted: false,
    }
    this.sessions.set(session.id, session)

    // Phase D: record Learn engagement.
    this.adaptiveRouter?.recordLearnEngagement({
      studentId: args.studentId,
      conceptId: args.conceptId,
    })

    // Compose the intro turn
    const introMsg = await this.safeInfer(
      buildIntroPrompt({ conceptName: concept.name, oneLiner: concept.one_liner }),
      `Let's look at ${concept.name}. What do you already know about it?`,
      192
    )
    session.turns.push({ role: 'agent', text: introMsg, meta: { stage: 'intro' } })
    return {
      sessionId: session.id,
      stage: session.stage,
      agentMessage: introMsg,
      done: false,
      suggestedActions: ['I know a little', "I don't know anything about it", 'Let\'s start'],
    }
  }

  // -------------------------------------------------------------- get state

  getSession(sessionId: string): LearnSession | undefined {
    return this.sessions.get(sessionId)
  }

  // ---------------------------------------------------------------- respond

  async respond(args: {
    sessionId: string
    studentInput: string
  }): Promise<LearnTurnResponse> {
    const session = this.sessions.get(args.sessionId)
    if (!session) throw new Error(`Learn session not found: ${args.sessionId}`)

    if (Date.now() - session.startedAt > this.maxDurationMs) {
      session.stage = 'aborted'
      return {
        sessionId: session.id,
        stage: 'aborted',
        agentMessage: 'This session has run long. Want to come back to it later?',
        done: true,
      }
    }

    session.turns.push({ role: 'student', text: args.studentInput })

    // Branch by current stage
    switch (session.stage) {
      case 'intro':
        return await this.afterIntro(session, args.studentInput)
      case 'explain':
        return await this.afterExplain(session, args.studentInput)
      case 'check_understanding':
        return await this.afterCheck(session, args.studentInput, 'check_understanding')
      case 'example':
        return await this.afterExample(session, args.studentInput)
      case 'check_understanding_2':
        return await this.afterCheck(session, args.studentInput, 'check_understanding_2')
      case 'practice_lite':
        return await this.afterPracticeLite(session, args.studentInput)
      case 'done':
      case 'aborted':
        return {
          sessionId: session.id,
          stage: session.stage,
          agentMessage: 'This walkthrough is complete. Pick another concept when you are ready.',
          done: true,
        }
    }
  }

  // ------------------------------------------------------------ stage logic

  private async afterIntro(
    session: LearnSession,
    studentInput: string
  ): Promise<LearnTurnResponse> {
    // We don't strictly classify the intro response; treat it as context for tier hint.
    // For now: always advance to explanation at the chosen tier.
    return await this.deliverExplanation(session)
  }

  private async deliverExplanation(session: LearnSession): Promise<LearnTurnResponse> {
    session.stage = 'explain'
    const explanation = this.content.getExplanation(
      session.conceptId,
      session.tier,
      session.currentFramingIndex
    )
    if (!explanation) {
      // No explanation at all — fall back to "done" gracefully.
      session.stage = 'done'
      const msg = `I do not have an explanation authored for ${session.conceptName} yet.`
      session.turns.push({ role: 'agent', text: msg, meta: { stage: 'done', reason: 'no_explanation' } })
      return {
        sessionId: session.id,
        stage: session.stage,
        agentMessage: msg,
        done: true,
      }
    }

    const transition = await this.safeInfer(
      buildExplainTransitionPrompt({ conceptName: session.conceptName, explanation }),
      `Take a look at this — I will ask you a quick check after.`,
      96
    )
    session.turns.push({
      role: 'agent',
      text: transition,
      meta: { stage: 'explain', explanation_id: explanation.id },
    })

    return {
      sessionId: session.id,
      stage: session.stage,
      agentMessage: transition,
      contentBlock: {
        type: 'explanation',
        body_md: explanation.body_md,
        title: `${session.conceptName} (${session.tier})`,
      },
      done: false,
      suggestedActions: ['I read it — ask me', "Explain it differently", "I don't understand"],
    }
  }

  private async afterExplain(
    session: LearnSession,
    studentInput: string
  ): Promise<LearnTurnResponse> {
    // Quick classification for meta intents (no SLM cost on these)
    const classification = await this.classifier.classify({
      studentInput,
      misconceptions: session.misconceptions,
    })

    if (classification.label === 'meta_explain_differently' || classification.label === 'dont_know') {
      if (classification.label === 'dont_know') {
        this.adaptiveRouter?.recordDontKnow({
          studentId: session.studentId,
          conceptId: session.conceptId,
        })
      }
      return await this.tryAltFraming(session, classification.label === 'dont_know' ? studentInput : '')
    }

    if (classification.label === 'meta_skip_ahead') {
      return await this.deliverCheck(session, 'check_understanding')
    }

    // Default: move to a check question
    return await this.deliverCheck(session, 'check_understanding')
  }

  private async tryAltFraming(
    session: LearnSession,
    studentInput: string
  ): Promise<LearnTurnResponse> {
    const next = this.content.getNextFraming(
      session.conceptId,
      session.tier,
      session.currentFramingIndex
    )

    if (!next) {
      // No more framings at this tier; offer to step down a tier (novice) if not already.
      if (session.tier !== 'novice') {
        session.tier = 'novice'
        session.currentFramingIndex = 0
        session.checks = this.content.listChecks(session.conceptId, 'novice')
        session.checkIndex = 0
        const msg = await this.safeInfer(
          buildDontKnowPrompt({ conceptName: session.conceptName }),
          `No problem — let me try a simpler version of this.`,
          96
        )
        session.turns.push({
          role: 'agent',
          text: msg,
          meta: { stage: 'tier_step_down', new_tier: 'novice' },
        })
        // Now actually deliver the novice framing
        return await this.deliverExplanation(session)
      }

      // Already at novice and out of framings — be honest with the student
      session.framingsExhausted = true
      const msg = `That's the explanations I have for this concept. Want to look at a worked example to see it in action?`
      session.turns.push({ role: 'agent', text: msg, meta: { stage: 'framings_exhausted' } })
      return {
        sessionId: session.id,
        stage: session.stage,
        agentMessage: msg,
        done: false,
        suggestedActions: ['Yes, show me an example', 'Try a check question instead'],
      }
    }

    // Advance to the next framing
    session.currentFramingIndex = next.framing_index
    const transition = await this.safeInfer(
      buildAltFramingPrompt({ explanation: next }),
      `Let me try a different angle. Take a look.`,
      96
    )
    session.turns.push({
      role: 'agent',
      text: transition,
      meta: { stage: 'alt_framing', explanation_id: next.id, framing_index: next.framing_index },
    })
    return {
      sessionId: session.id,
      stage: session.stage,
      agentMessage: transition,
      contentBlock: {
        type: 'explanation',
        body_md: next.body_md,
        title: `${session.conceptName} (alternate framing)`,
      },
      done: false,
      suggestedActions: ['I read it — ask me', 'Explain it differently', "I'm ready for a check"],
    }
  }

  private async deliverCheck(
    session: LearnSession,
    nextStage: 'check_understanding' | 'check_understanding_2'
  ): Promise<LearnTurnResponse> {
    session.stage = nextStage
    if (session.checkIndex >= session.checks.length) {
      // No more checks at this tier — go straight to example or done.
      if (nextStage === 'check_understanding') {
        return await this.deliverExample(session)
      } else {
        return await this.completeSession(session)
      }
    }

    const check = session.checks[session.checkIndex]
    const ask = await this.safeInfer(
      buildCheckPrompt({ check }),
      check.question_md,
      192
    )
    session.turns.push({
      role: 'agent',
      text: ask,
      meta: { stage: nextStage, check_id: check.id },
    })

    return {
      sessionId: session.id,
      stage: session.stage,
      agentMessage: ask,
      contentBlock: { type: 'check', body_md: check.question_md },
      done: false,
      suggestedActions: ["I don't know", 'Explain it differently'],
    }
  }

  private async afterCheck(
    session: LearnSession,
    studentInput: string,
    fromStage: 'check_understanding' | 'check_understanding_2'
  ): Promise<LearnTurnResponse> {
    const check = session.checks[session.checkIndex]
    const classification = await this.classifier.classify({
      studentInput,
      expectedAnswer: check.expected_answer_md,
      expectedPattern: check.expected_pattern,
      misconceptions: session.misconceptions,
      questionContext: check.question_md,
    })

    return await this.handleClassifiedAnswer(session, studentInput, classification, fromStage)
  }

  private async handleClassifiedAnswer(
    session: LearnSession,
    studentInput: string,
    classification: ClassificationResult,
    fromStage: 'check_understanding' | 'check_understanding_2'
  ): Promise<LearnTurnResponse> {
    const check = session.checks[session.checkIndex]

    // Route by classification
    switch (classification.label) {
      case 'correct': {
        session.checkIndex++
        // Move to next stage based on where we are
        if (fromStage === 'check_understanding') {
          // After first check passed: deliver worked example
          const intro = await this.safeInfer(
            buildEncouragementPrompt({ conceptName: session.conceptName }),
            `Nice. Let's look at a worked example.`,
            64
          )
          session.turns.push({
            role: 'agent',
            text: intro,
            meta: { stage: 'check_correct_transition', classification: classification.label },
          })
          // Then immediately deliver the example
          return await this.deliverExample(session, intro)
        } else {
          // After second check passed: completion
          return await this.completeSession(session)
        }
      }
      case 'partial_correct': {
        const probe = await this.safeInfer(
          buildPartialPrompt({ check, studentInput }),
          `You're on the right track. Can you tell me more about what you're doing in the next step?`,
          128
        )
        session.turns.push({
          role: 'agent',
          text: probe,
          meta: { stage: fromStage, classification: classification.label },
        })
        return {
          sessionId: session.id,
          stage: session.stage,
          agentMessage: probe,
          done: false,
          suggestedActions: ['Try again', "I don't know"],
        }
      }
      case 'misconception': {
        const misc = classification.misconception_id
          ? this.content.getMisconception(classification.misconception_id)
          : null
        if (!misc) {
          // Treat as partial
          const probe = await this.safeInfer(
            buildPartialPrompt({ check, studentInput }),
            `Let's think this through. What was your reasoning?`,
            128
          )
          session.turns.push({ role: 'agent', text: probe, meta: { stage: fromStage } })
          return {
            sessionId: session.id,
            stage: session.stage,
            agentMessage: probe,
            done: false,
          }
        }
        const reply = await this.safeInfer(
          buildMisconceptionPrompt({ misconception: misc, studentInput }),
          misc.socratic_response_md,
          192
        )
        session.turns.push({
          role: 'agent',
          text: reply,
          meta: {
            stage: fromStage,
            classification: 'misconception',
            misconception_id: misc.id,
            misconception_short_name: misc.short_name,
          },
        })
        return {
          sessionId: session.id,
          stage: session.stage,
          agentMessage: reply,
          contentBlock: {
            type: 'misconception',
            body_md: misc.description_md,
            title: `Common slip: ${misc.short_name.replace(/_/g, ' ')}`,
          },
          done: false,
          suggestedActions: ['Try again', "Explain it differently"],
        }
      }
      case 'dont_know':
      case 'meta_explain_differently': {
        if (classification.label === 'dont_know') {
          this.adaptiveRouter?.recordDontKnow({
            studentId: session.studentId,
            conceptId: session.conceptId,
          })
        }
        return await this.tryAltFraming(session, studentInput)
      }
      case 'meta_skip_ahead': {
        if (fromStage === 'check_understanding') {
          return await this.deliverExample(session)
        }
        return await this.completeSession(session)
      }
      case 'meta_slow_down': {
        if (session.tier !== 'novice') {
          session.tier = 'novice'
          session.currentFramingIndex = 0
          session.checks = this.content.listChecks(session.conceptId, 'novice')
          session.checkIndex = 0
          return await this.deliverExplanation(session)
        }
        // Already novice — try alt framing
        return await this.tryAltFraming(session, studentInput)
      }
      case 'off_topic': {
        const msg = `Let's stay focused. Here is the question again — take your best shot.`
        session.turns.push({
          role: 'agent',
          text: msg,
          meta: { stage: fromStage, classification: 'off_topic' },
        })
        return {
          sessionId: session.id,
          stage: session.stage,
          agentMessage: msg,
          contentBlock: { type: 'check', body_md: check.question_md },
          done: false,
        }
      }
    }
  }

  private async deliverExample(
    session: LearnSession,
    precedingMessage?: string
  ): Promise<LearnTurnResponse> {
    session.stage = 'example'
    const example = this.content.getExample(session.conceptId, session.tier)
    if (!example) {
      // No example at this tier — go straight to second check or done
      return await this.deliverCheck(session, 'check_understanding_2')
    }
    const intro = await this.safeInfer(
      buildExampleTransitionPrompt({ example }),
      `Let's walk through this together. What's the very first thing you would try?`,
      128
    )
    const stepsMd = example.steps
      .map((s, i) => `**Step ${i + 1}.** ${s.step_md}\n\n*Why:* ${s.why_md}`)
      .join('\n\n')
    const fullExample = `**Problem:** ${example.problem_md}\n\n${stepsMd}`
    session.turns.push({
      role: 'agent',
      text: intro,
      meta: { stage: 'example', example_id: example.id, preceding: precedingMessage },
    })
    return {
      sessionId: session.id,
      stage: session.stage,
      agentMessage: intro,
      contentBlock: {
        type: 'example',
        body_md: fullExample,
        title: `Worked example`,
      },
      done: false,
      suggestedActions: ['I followed it', "I don't get a step", 'Try a check'],
    }
  }

  private async afterExample(
    session: LearnSession,
    studentInput: string
  ): Promise<LearnTurnResponse> {
    const cls = await this.classifier.classify({
      studentInput,
      misconceptions: session.misconceptions,
    })
    if (cls.label === 'dont_know' || cls.label === 'meta_explain_differently') {
      return await this.tryAltFraming(session, studentInput)
    }
    // Otherwise advance to second check
    return await this.deliverCheck(session, 'check_understanding_2')
  }

  private async afterPracticeLite(
    session: LearnSession,
    studentInput: string
  ): Promise<LearnTurnResponse> {
    return await this.completeSession(session)
  }

  private async completeSession(session: LearnSession): Promise<LearnTurnResponse> {
    session.stage = 'done'
    // Phase D: record Learn completion.
    this.adaptiveRouter?.recordLearnCompletion({
      studentId: session.studentId,
      conceptId: session.conceptId,
    })
    const msg = await this.safeInfer(
      buildDonePrompt({ conceptName: session.conceptName }),
      `Good work on ${session.conceptName}. Want to try a practice problem to lock it in?`,
      96
    )
    session.turns.push({ role: 'agent', text: msg, meta: { stage: 'done' } })
    return {
      sessionId: session.id,
      stage: session.stage,
      agentMessage: msg,
      done: true,
      suggestedActions: ['Try a practice problem', 'Pick another concept', 'End for now'],
    }
  }

  // -------------------------------------------------------------- internals

  private async safeInfer(prompt: string, fallback: string, maxTokens = 192): Promise<string> {
    try {
      const out = await this.dialogue.inferRaw(prompt, maxTokens)
      const trimmed = (out ?? '').trim()
      return trimmed.length > 0 ? trimmed : fallback
    } catch (err) {
      this.logger.warn(`[LearnMode] inference fell back: ${(err as Error).message}`)
      return fallback
    }
  }
}
