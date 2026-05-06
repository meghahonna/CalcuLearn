/**
 * Response Classifier — Phase B Socratic runtime.
 *
 * Maps a free-form student input to one of five intents that the
 * LearnModeService state machine can act on.
 *
 * Strategy:
 *   1. Cheap pattern checks first (regex on expected_pattern, "i don't
 *      know" phrases). These resolve in microseconds without an SLM call.
 *   2. If none fire, call the SLM with a small constrained prompt asking
 *      it to pick one of the labels.
 *
 * The classifier is intentionally separated from the dialogue generator so
 * we can swap the underlying model or add a faster local classifier later.
 */

import type { DialogueGenerator } from './dialogueGenerator.js'
import type { Misconception } from './contentRetrieval.js'

export type ClassificationLabel =
  | 'correct'
  | 'partial_correct'
  | 'misconception'
  | 'dont_know'
  | 'meta_explain_differently'
  | 'meta_skip_ahead'
  | 'meta_slow_down'
  | 'off_topic'

export interface ClassificationResult {
  label: ClassificationLabel
  /** Only set when label === 'misconception' */
  misconception_id?: number
  /** Free-text rationale (for logging / UI debug) */
  reason?: string
}

const DONT_KNOW_PATTERNS = [
  /^\s*i\s*(do\s*not|don\s*'?t|dont)\s*(know|get\s*it|understand|see)/i,
  /^\s*idk\b/i,
  /^\s*no\s*(idea|clue)/i,
  /^\s*help\b.*understand/i,
  /^\s*not\s*sure/i,
]

const META_DIFFERENT_PATTERNS = [
  /explain\s*(it\s*)?(again|differently|another\s*way)/i,
  /can\s*you\s*explain\s*(it\s*)?again/i,
  /show\s*me\s*(another|a\s*different)/i,
  /try\s*again/i,
  /still\s*confused/i,
  /still\s*don\s*'?t\s*get/i,
]

const META_SKIP_PATTERNS = [
  /skip\s*ahead/i,
  /move\s*on/i,
  /next\s*(part|step|topic)/i,
  /i\s*get\s*it\b.*(let'?s\s*)?(move|continue)/i,
  /\bspeed\s*up\b/i,
]

const META_SLOW_PATTERNS = [
  /slow\s*down/i,
  /too\s*fast/i,
  /go\s*slower/i,
  /\beasier\b/i,
]

export class ResponseClassifier {
  constructor(private readonly dialogueGenerator: DialogueGenerator) {}

  /**
   * Classify the student's input.
   *
   * @param studentInput        Raw text from the student.
   * @param expectedAnswer      The expected answer (for the current check).
   * @param expectedPattern     Optional regex pattern to match correctness fast.
   * @param misconceptions      The full misconception catalog for the concept.
   * @param questionContext     The question we're checking against (for the SLM prompt).
   */
  async classify(args: {
    studentInput: string
    expectedAnswer?: string
    expectedPattern?: string | null
    misconceptions?: Misconception[]
    questionContext?: string
  }): Promise<ClassificationResult> {
    const input = args.studentInput.trim()

    // ---- Fast meta-intent paths (no SLM call) ----
    if (this.matchAny(input, DONT_KNOW_PATTERNS)) {
      return { label: 'dont_know', reason: 'matched dont_know pattern' }
    }
    if (this.matchAny(input, META_DIFFERENT_PATTERNS)) {
      return { label: 'meta_explain_differently', reason: 'matched explain-differently pattern' }
    }
    if (this.matchAny(input, META_SKIP_PATTERNS)) {
      return { label: 'meta_skip_ahead', reason: 'matched skip pattern' }
    }
    if (this.matchAny(input, META_SLOW_PATTERNS)) {
      return { label: 'meta_slow_down', reason: 'matched slow-down pattern' }
    }

    // ---- Fast correctness check via expected_pattern ----
    if (args.expectedPattern && args.expectedPattern.length > 0) {
      try {
        const re = new RegExp(args.expectedPattern, 'i')
        if (re.test(input)) {
          return { label: 'correct', reason: 'expected_pattern matched' }
        }
      } catch {
        // bad regex from authored content — silently fall through to SLM
      }
    }

    // ---- Heuristic fast path: short answers exact-match ----
    if (args.expectedAnswer) {
      const heuristic = quickAnswerMatch(input, args.expectedAnswer)
      if (heuristic !== null) return { label: heuristic, reason: 'heuristic match' }
    }

    // ---- SLM-based classification (slow path) ----
    return await this.classifyWithSlm({
      studentInput: input,
      expectedAnswer: args.expectedAnswer,
      misconceptions: args.misconceptions ?? [],
      questionContext: args.questionContext ?? '',
    })
  }

  private matchAny(text: string, patterns: RegExp[]): boolean {
    return patterns.some((p) => p.test(text))
  }

  private async classifyWithSlm(args: {
    studentInput: string
    expectedAnswer?: string
    misconceptions: Misconception[]
    questionContext: string
  }): Promise<ClassificationResult> {
    const miscList = args.misconceptions
      .map((m, i) => `  ${i + 1}. id=${m.id} name="${m.short_name}" — ${m.description_md.slice(0, 200)}`)
      .join('\n')

    const prompt = `You are a strict classifier. Classify the student's response into ONE label.

QUESTION: ${args.questionContext || '(none)'}
EXPECTED ANSWER: ${args.expectedAnswer || '(unknown)'}

STUDENT RESPONSE: "${args.studentInput}"

Possible misconceptions for this concept:
${miscList || '(none)'}

Choose ONE label from this list:
  correct           - the response matches the expected answer
  partial_correct   - on the right track but incomplete or has a small error
  misconception:N   - the response shows misconception with id=N from the list above
  off_topic         - response is unrelated to the question

Respond with ONLY the label word (e.g. "correct" or "misconception:7"). No prose, no punctuation.`

    const out = (await this.dialogueGenerator.inferRaw(prompt, 32)).toLowerCase()
    const cleaned = out.replace(/[^a-z0-9_:]/g, '')

    if (cleaned.startsWith('correct')) {
      return { label: 'correct', reason: `slm: ${cleaned}` }
    }
    if (cleaned.startsWith('partial')) {
      return { label: 'partial_correct', reason: `slm: ${cleaned}` }
    }
    if (cleaned.startsWith('misconception')) {
      const m = cleaned.match(/misconception:(\d+)/)
      if (m) {
        const id = Number(m[1])
        // Verify it's a real misconception in our catalog
        if (args.misconceptions.some((mc) => mc.id === id)) {
          return { label: 'misconception', misconception_id: id, reason: `slm: ${cleaned}` }
        }
      }
      return { label: 'partial_correct', reason: `slm misconception unparseable: ${cleaned}` }
    }
    if (cleaned.startsWith('off')) {
      return { label: 'off_topic', reason: `slm: ${cleaned}` }
    }

    // Unparseable SLM output -> default to partial_correct so the student gets a probe
    return { label: 'partial_correct', reason: `slm unparseable: ${cleaned}` }
  }
}

// ---------- Heuristic answer matcher (no SLM call) ----------

/**
 * Quick match for short, numeric, or single-symbol answers. Returns
 * 'correct' / 'partial_correct' / 'off_topic' if confident, else null.
 * The classifier falls back to an SLM call when this returns null.
 */
function quickAnswerMatch(
  input: string,
  expected: string
): 'correct' | 'partial_correct' | 'off_topic' | null {
  const normExp = normalizeForCompare(expected)
  const normIn = normalizeForCompare(input)

  // Short answers (<= 25 chars normalized) get exact-equality check
  if (normExp.length <= 25 && normIn.length <= 80) {
    if (normIn === normExp) return 'correct'
    // Pure number / single symbol mismatch -> off_topic if the input
    // doesn't even contain a digit/var the expected does
    if (/^[\-+]?\d+(\.\d+)?$/.test(normExp)) {
      // Expected is a plain number
      if (/^[\-+]?\d+(\.\d+)?$/.test(normIn)) {
        // Both are numbers but mismatch -> partial (could be small slip)
        return 'partial_correct'
      }
      // Input is not a number at all
      return null // let SLM decide (could be a worded answer)
    }
  }

  // Numeric expected with units / coefficient: extract the number,
  // see if input contains it.
  const expNum = expected.match(/-?\d+(?:\.\d+)?/)?.[0]
  if (expNum && input.includes(expNum)) {
    // Only call this a partial match — the SLM/structure verifies the rest
    return 'partial_correct'
  }

  return null
}

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/\$/g, '')             // strip LaTeX delimiters
    .replace(/\\\\/g, '')        // strip backslashes from LaTeX
    .replace(/\s+/g, '')            // strip whitespace
    .replace(/[.,;:!?]+$/g, '')      // trailing punctuation
}

