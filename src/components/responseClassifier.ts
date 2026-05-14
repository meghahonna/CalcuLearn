/**
 * Response Classifier — A5 (faster classifier, tiered).
 *
 * Maps a free-form student input to one of these intents:
 *   correct | partial_correct | misconception | dont_know
 *   meta_explain_differently | meta_skip_ahead | meta_slow_down | off_topic
 *
 * THE GOAL: minimize per-turn latency. Pre-A5, every non-trivial classify
 * call hit the SLM (~8-25s on Gemma Q4). The 5-tier deterministic
 * pipeline below resolves the vast majority of student replies in <5ms,
 * falling through to the SLM only as a last-resort tier 6.
 *
 * Tier   Method                              Latency        Catches
 * ----   ----------------------------------  -------------  -------------------------
 *   1    Meta-phrase regex                   <1ms           "i don't know", "explain
 *                                                            differently", "skip ahead"
 *   2    expected_pattern regex              <1ms           Direct match against the
 *                                                            check's authored pattern
 *   3    Math-aware structural compare       <5ms           "2x" ≡ "$2x$" ≡ "2*x"
 *                                                            ≡ "two x", numeric equiv,
 *                                                            polynomial expansion
 *   4    Misconception keyword overlap       <5ms           "I forgot the inside"
 *                                                            matches forget_inner_deriv
 *   5    Heuristic confidence                <5ms           Hedging + math density →
 *                                                            partial_correct vs off_topic
 *   6    SLM (opt-in fallback)               8-25s          Long, ambiguous, free-form
 *
 * Each call emits a ClassificationResult with `tier` + `latencyMs` so we
 * can measure fast-path hit rate in production telemetry.
 */

import type { DialogueGenerator } from './dialogueGenerator.js'
import type { Misconception } from './contentRetrieval.js'
import { compileExpression } from '../visuals/expr.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClassificationLabel =
  | 'correct'
  | 'partial_correct'
  | 'misconception'
  | 'dont_know'
  | 'meta_explain_differently'
  | 'meta_skip_ahead'
  | 'meta_slow_down'
  | 'off_topic'

export type ClassifierTier = 1 | 2 | 3 | 4 | 5 | 6

export interface ClassificationResult {
  label: ClassificationLabel
  /** Which tier produced this result (1-5 deterministic, 6 = SLM fallback). */
  tier: ClassifierTier
  /** Wall-clock latency in milliseconds. */
  latencyMs: number
  /** Only set when label === 'misconception'. */
  misconception_id?: number
  /** Free-text rationale for logging / UI debug. */
  reason?: string
  /** Confidence in [0,1]. Tiers 1-2 are 1.0; tier 5 is <0.7. */
  confidence: number
}

export interface ClassifyArgs {
  studentInput: string
  expectedAnswer?: string
  expectedPattern?: string | null
  misconceptions?: Misconception[]
  questionContext?: string
}

export interface ClassifierOptions {
  /** If false, tier 6 (SLM fallback) is disabled and we return tier-5 best-effort instead. */
  enableSlmFallback?: boolean
  /** Optional sink called with every result for telemetry / logging. */
  onResult?: (result: ClassificationResult, args: ClassifyArgs) => void
  /** Logger. */
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

// ---------------------------------------------------------------------------
// Tier 1: meta-intent regex patterns
// ---------------------------------------------------------------------------

const DONT_KNOW_PATTERNS = [
  /^\s*i\s*(do\s*not|don\s*'?t|dont)\s*(know|get\s*it|understand|see)/i,
  /^\s*idk\b/i,
  /^\s*no\s*(idea|clue)/i,
  /^\s*help\b.*understand/i,
  /^\s*not\s*sure/i,
  /^\s*i\s*give\s*up/i,
  /^\s*(can\s*you\s*)?help\s*me\s*(out|understand|with)/i,
  /^\s*i'?m\s*(lost|stuck|confused)/i,
]

const META_DIFFERENT_PATTERNS = [
  /explain\s*(it\s*)?(again|differently|another\s*way)/i,
  /can\s*you\s*explain\s*(it\s*)?again/i,
  /show\s*me\s*(another|a\s*different)/i,
  /try\s*again/i,
  /still\s*confused/i,
  /still\s*don\s*'?t\s*get/i,
  /can\s*you\s*break\s*(this|it)\s*down/i,
  /\bdifferent\s*way\b/i,
  /\bsimpler\b.*\bplease\b/i,
  /\beli5\b/i,
]

const META_SKIP_PATTERNS = [
  /skip\s*ahead/i,
  /move\s*on/i,
  /next\s*(part|step|topic)/i,
  /i\s*get\s*it\b.*(let'?s\s*)?(move|continue)/i,
  /\bspeed\s*up\b/i,
  /^got\s*it[\s.,!]*$/i,
  /^makes?\s*sense[\s.,!]*$/i,
]

const META_SLOW_PATTERNS = [
  /slow\s*down/i,
  /too\s*fast/i,
  /go\s*slower/i,
  /\beasier\b/i,
  /one\s*step\s*at\s*a\s*time/i,
  /can\s*you\s*go\s*slower/i,
]

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

// ---------------------------------------------------------------------------
// Tier 3: math-aware structural compare
// ---------------------------------------------------------------------------

const WORD_TO_DIGIT: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
}

/**
 * Normalize an expression for structural compare:
 *   - Lowercase
 *   - Strip LaTeX delimiters ($, \[, \]) and braces around single chars
 *   - Convert simple word numbers ("two") to digits
 *   - Map common LaTeX commands to plain operators (\cdot -> *, \times -> *, etc.)
 *   - Collapse implicit multiplication: "2x" stays "2x" but "2 * x" -> "2*x"
 *   - Strip whitespace
 */
function normalizeMath(s: string): string {
  let out = s.toLowerCase()
  // Replace word numbers BEFORE stripping spaces
  out = out.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (m) =>
    WORD_TO_DIGIT[m] ?? m
  )
  // Strip LaTeX delimiters and common commands
  out = out
    .replace(/\$+/g, '')
    .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
    .replace(/\\(cdot|times)\b/g, '*')
    .replace(/\\div\b/g, '/')
    .replace(/\\(left|right)\b/g, '')
    .replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\s*\{([^}]+)\}/g, 'sqrt($1)')
    .replace(/\\(?:sin|cos|tan|log|ln|exp)\b/g, (m) => m.slice(1))
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\(?:[a-z]+)/g, '') // drop any remaining \commands
    // Drop single-char braces: {x} -> x
    .replace(/\{([a-z0-9])\}/g, '$1')
    // Strip remaining braces — leftover from constructs we couldn't simplify
    .replace(/[{}]/g, '')
  // Strip whitespace
  out = out.replace(/\s+/g, '')
  // Trailing punctuation
  out = out.replace(/[.,;:!?]+$/g, '')
  // Insert explicit multiplication for math juxtaposition:
  //   2x       -> 2*x
  //   2(x+1)   -> 2*(x+1)
  //   (x+1)(x-1) -> (x+1)*(x-1)
  //   (x+1)x   -> (x+1)*x
  // We apply repeatedly until no more insertions happen, which handles
  // chains like 2(x+1)(x-1) -> 2*(x+1)*(x-1).
  let prev: string
  do {
    prev = out
    out = out
      .replace(/(\d)([a-z(])/g, '$1*$2')   // digit -> letter or '('
      .replace(/(\))([a-z0-9(])/g, '$1*$2') // ')' -> letter/digit/'('
  } while (out !== prev)
  return out
}

/**
 * Check whether `input` and `expected` are mathematically equivalent.
 * Strategy:
 *   1. Normalize both with normalizeMath().
 *   2. If they're string-equal after normalization, return 'correct'.
 *   3. If both compile as expressions and evaluate to the same value at
 *      a small set of test points, return 'correct' (symbolic equivalence
 *      via numerical probing).
 *   4. If they evaluate to nearby values at any point, return 'partial_correct'.
 *   5. Otherwise return null (let next tier decide).
 */
function structuralMathCompare(
  input: string,
  expected: string
): { label: 'correct' | 'partial_correct'; reason: string } | null {
  const ni = normalizeMath(input)
  const ne = normalizeMath(expected)
  if (!ni || !ne) return null

  // Direct string-equality after normalization
  if (ni === ne) return { label: 'correct', reason: 'normalized string equal' }

  // Try expression-level comparison via numerical probing
  let fi: ((env: Record<string, number>) => number) | null = null
  let fe: ((env: Record<string, number>) => number) | null = null
  try { fi = compileExpression(ni) } catch { /* not a parseable expression */ }
  try { fe = compileExpression(ne) } catch { /* not a parseable expression */ }
  if (!fi || !fe) return null

  // Probe at a few x values
  const TEST_POINTS = [-1.7, -0.3, 0.5, 1.0, 1.7, 2.5, 4.0]
  let matches = 0
  let valid = 0
  let closeButNotExact = 0
  for (const x of TEST_POINTS) {
    const yi = fi({ x })
    const ye = fe({ x })
    if (!Number.isFinite(yi) || !Number.isFinite(ye)) continue
    valid++
    if (Math.abs(yi - ye) < 1e-6 * (1 + Math.abs(ye))) {
      matches++
    } else if (Math.abs(yi - ye) < 0.05 * (1 + Math.abs(ye))) {
      closeButNotExact++
    }
  }
  if (valid >= 3 && matches === valid) {
    return { label: 'correct', reason: 'numerical equivalence at all probe points' }
  }
  // If most points are close but not exact, the student probably made a sign or
  // coefficient slip — call it partial.
  if (valid >= 3 && (matches + closeButNotExact) >= valid - 1 && matches >= 1) {
    return { label: 'partial_correct', reason: 'close at most probe points; possible slip' }
  }
  return null
}

// ---------------------------------------------------------------------------
// Tier 4: misconception keyword overlap
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'a', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'an', 'and', 'or', 'but', 'if', 'so', 'then', 'than', 'that', 'this',
  'these', 'those', 'as', 'at', 'in', 'on', 'of', 'to', 'for', 'with',
  'by', 'from', 'into', 'about', 'over', 'under', 'i', 'you', 'he', 'she',
  'it', 'we', 'they', 'them', 'my', 'your', 'his', 'her', 'its', 'our',
  'their', 'me', 'us', 'who', 'what', 'when', 'where', 'why', 'how',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'should',
  'could', 'can', 'just', 'so', 'also', 'too', 'very', 'really', 'not',
  'no', 'yes', 'only', 'all', 'some', 'any', 'one', 'two', 'three',
  'student', 'students', 'function', 'problem', 'use', 'using', 'find',
])

function extractKeywords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

/**
 * Score each misconception by keyword overlap with the student input.
 * Returns the best-scoring misconception if its score exceeds a threshold,
 * else null.
 *
 * The threshold is intentionally conservative — we'd rather miss a
 * misconception than mislabel a correct answer.
 */
function misconceptionKeywordMatch(
  input: string,
  misconceptions: Misconception[]
): { misconception_id: number; reason: string; confidence: number } | null {
  if (misconceptions.length === 0) return null
  const inputWords = new Set(extractKeywords(input))
  if (inputWords.size < 3) return null // too short to keyword-match reliably

  let best: { id: number; score: number; name: string } | null = null
  for (const m of misconceptions) {
    // Build the keyword vocab from short_name + the first sentence of description_md.
    // The first sentence is the most diagnostic — later sentences explain why it's
    // wrong, not what the misconception IS.
    const firstSentence = m.description_md.split(/(?<=[.!?])\s/)[0] ?? m.description_md
    const conceptText = `${m.short_name.replace(/_/g, ' ')} ${firstSentence}`
    const conceptWords = extractKeywords(conceptText)
    if (conceptWords.length === 0) continue
    let overlap = 0
    for (const w of conceptWords) {
      if (inputWords.has(w)) overlap++
    }
    // Score normalised by misconception keyword count, capped at 1.
    const score = overlap / Math.min(conceptWords.length, 8)
    if (!best || score > best.score) {
      best = { id: m.id, score, name: m.short_name }
    }
  }

  if (!best) return null
  // Require BOTH:
  //   1. >=60% normalized overlap (proportional)
  //   2. >=3 absolute keyword matches (so a 2-word answer can't trigger)
  //   3. The score is meaningfully higher than the second-best, so we
  //      have a clear winner — otherwise we abstain and let tier 5/6 decide.
  // This is intentionally conservative: a misconception label is a strong
  // signal that triggers a misconception-specific Socratic response, so
  // false positives are worse than false negatives here.
  const totalOverlap = Math.round(best.score * 8) // approximate absolute count
  if (best.score >= 0.6 && totalOverlap >= 3) {
    return {
      misconception_id: best.id,
      reason: `keyword overlap with ${best.name} (score=${best.score.toFixed(2)})`,
      confidence: Math.min(0.85, 0.4 + best.score * 0.5),
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Tier 5: heuristic confidence score
// ---------------------------------------------------------------------------

const HEDGE_WORDS = ['maybe', 'i think', 'i guess', 'sort of', 'kind of', 'probably', 'might', 'perhaps', 'not sure']
const ASSERTION_WORDS = ['therefore', 'because', 'since', 'so', 'gives', 'equals', 'is', 'are']

function heuristicConfidence(
  input: string,
  expectedAnswer?: string
): { label: ClassificationLabel; confidence: number; reason: string } {
  const lower = input.toLowerCase()
  const hasMath = /[\d=+\-*/^()]|\\frac|\\sqrt/.test(input)
  const hedges = HEDGE_WORDS.filter((h) => lower.includes(h)).length
  const assertions = ASSERTION_WORDS.filter((a) => lower.includes(a)).length
  const wordCount = lower.split(/\s+/).filter(Boolean).length

  // Empty / very short with no math → can't tell
  if (wordCount === 0) {
    return { label: 'off_topic', confidence: 0.3, reason: 'empty input' }
  }

  // If the student wrote something containing a number that appears in the
  // expected answer, AND no hedging, lean correct/partial.
  if (expectedAnswer) {
    const expNumbers = expectedAnswer.match(/-?\d+(?:\.\d+)?/g) ?? []
    const hits = expNumbers.filter((n) => input.includes(n)).length
    if (hits > 0 && hedges === 0) {
      return {
        label: 'partial_correct',
        confidence: 0.6,
        reason: `contains ${hits}/${expNumbers.length} expected number(s), no hedging`,
      }
    }
  }

  if (hedges > 0 && hasMath) {
    return { label: 'partial_correct', confidence: 0.5, reason: `${hedges} hedging cue(s) + math` }
  }
  if (hedges > 0) {
    return { label: 'partial_correct', confidence: 0.45, reason: `${hedges} hedging cue(s)` }
  }
  if (hasMath && assertions > 0) {
    return { label: 'partial_correct', confidence: 0.5, reason: 'math + assertion language but no exact match' }
  }
  // Long, prose-heavy response with no math and no hedging — student is
  // explaining something. Probably partial.
  if (wordCount >= 8) {
    return { label: 'partial_correct', confidence: 0.4, reason: 'prose response without clear math' }
  }

  return { label: 'off_topic', confidence: 0.35, reason: 'short prose without math or assertion cues' }
}

// ---------------------------------------------------------------------------
// Public classifier class
// ---------------------------------------------------------------------------

export class ResponseClassifier {
  private readonly enableSlmFallback: boolean
  private readonly onResult: ClassifierOptions['onResult']
  private readonly logger: Pick<Console, 'log' | 'warn' | 'error'>

  constructor(
    private readonly dialogueGenerator: DialogueGenerator,
    opts: ClassifierOptions = {}
  ) {
    this.enableSlmFallback = opts.enableSlmFallback ?? true
    this.onResult = opts.onResult
    this.logger = opts.logger ?? console
  }

  async classify(args: ClassifyArgs): Promise<ClassificationResult> {
    const start = Date.now()
    const input = args.studentInput.trim()

    // ---- Tier 1: meta-intent regex (covers dont_know + 3 meta intents) ----
    if (matchAny(input, DONT_KNOW_PATTERNS)) {
      return this.report({ label: 'dont_know', tier: 1, latencyMs: Date.now() - start, confidence: 1.0, reason: 'tier-1: dont_know phrase' }, args)
    }
    if (matchAny(input, META_DIFFERENT_PATTERNS)) {
      return this.report({ label: 'meta_explain_differently', tier: 1, latencyMs: Date.now() - start, confidence: 1.0, reason: 'tier-1: explain-differently phrase' }, args)
    }
    if (matchAny(input, META_SKIP_PATTERNS)) {
      return this.report({ label: 'meta_skip_ahead', tier: 1, latencyMs: Date.now() - start, confidence: 1.0, reason: 'tier-1: skip-ahead phrase' }, args)
    }
    if (matchAny(input, META_SLOW_PATTERNS)) {
      return this.report({ label: 'meta_slow_down', tier: 1, latencyMs: Date.now() - start, confidence: 1.0, reason: 'tier-1: slow-down phrase' }, args)
    }

    // ---- Tier 2: expected_pattern regex (authored regex match) ----
    if (args.expectedPattern && args.expectedPattern.length > 0) {
      try {
        const re = new RegExp(args.expectedPattern, 'i')
        if (re.test(input)) {
          return this.report({ label: 'correct', tier: 2, latencyMs: Date.now() - start, confidence: 1.0, reason: 'tier-2: expected_pattern matched' }, args)
        }
      } catch {
        // Bad regex in authored content — silently skip
      }
    }

    // ---- Tier 3: math-aware structural compare ----
    if (args.expectedAnswer) {
      const cmp = structuralMathCompare(input, args.expectedAnswer)
      if (cmp) {
        return this.report({
          label: cmp.label,
          tier: 3,
          latencyMs: Date.now() - start,
          confidence: cmp.label === 'correct' ? 0.95 : 0.7,
          reason: `tier-3: ${cmp.reason}`,
        }, args)
      }
    }

    // ---- Tier 4: misconception keyword overlap ----
    if (args.misconceptions && args.misconceptions.length > 0) {
      const m = misconceptionKeywordMatch(input, args.misconceptions)
      if (m) {
        return this.report({
          label: 'misconception',
          tier: 4,
          latencyMs: Date.now() - start,
          confidence: m.confidence,
          misconception_id: m.misconception_id,
          reason: `tier-4: ${m.reason}`,
        }, args)
      }
    }

    // ---- Tier 5: heuristic confidence (always returns SOMETHING) ----
    const heuristic = heuristicConfidence(input, args.expectedAnswer)

    // If confidence is decent OR SLM fallback is disabled, use the heuristic
    if (heuristic.confidence >= 0.5 || !this.enableSlmFallback) {
      return this.report({
        label: heuristic.label,
        tier: 5,
        latencyMs: Date.now() - start,
        confidence: heuristic.confidence,
        reason: `tier-5: ${heuristic.reason}`,
      }, args)
    }

    // ---- Tier 6: SLM fallback (slow path) ----
    const slmResult = await this.classifyWithSlm({
      studentInput: input,
      expectedAnswer: args.expectedAnswer,
      misconceptions: args.misconceptions ?? [],
      questionContext: args.questionContext ?? '',
    })
    return this.report({
      ...slmResult,
      tier: 6,
      latencyMs: Date.now() - start,
    }, args)
  }

  /**
   * Hook for callers to inspect classification results without each one
   * having to wrap the call. Used by Learn Mode + Teach-It-Back for
   * telemetry / debug logging.
   */
  private report(result: ClassificationResult, args: ClassifyArgs): ClassificationResult {
    try {
      this.onResult?.(result, args)
    } catch (e) {
      this.logger.warn(`[classifier] onResult hook threw: ${(e as Error).message}`)
    }
    return result
  }

  // ---- SLM fallback (kept lean — tier 6 only fires for ambiguous cases) ----

  private async classifyWithSlm(args: {
    studentInput: string
    expectedAnswer?: string
    misconceptions: Misconception[]
    questionContext: string
  }): Promise<Omit<ClassificationResult, 'tier' | 'latencyMs'>> {
    const miscList = args.misconceptions
      .map((m, i) => `  ${i + 1}. id=${m.id} name="${m.short_name}" — ${m.description_md.slice(0, 180)}`)
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
      return { label: 'correct', confidence: 0.8, reason: `slm: ${cleaned}` }
    }
    if (cleaned.startsWith('partial')) {
      return { label: 'partial_correct', confidence: 0.7, reason: `slm: ${cleaned}` }
    }
    if (cleaned.startsWith('misconception')) {
      const m = cleaned.match(/misconception:(\d+)/)
      if (m) {
        const id = Number(m[1])
        if (args.misconceptions.some((mc) => mc.id === id)) {
          return { label: 'misconception', misconception_id: id, confidence: 0.75, reason: `slm: ${cleaned}` }
        }
      }
      return { label: 'partial_correct', confidence: 0.55, reason: `slm misconception unparseable: ${cleaned}` }
    }
    if (cleaned.startsWith('off')) {
      return { label: 'off_topic', confidence: 0.7, reason: `slm: ${cleaned}` }
    }
    return { label: 'partial_correct', confidence: 0.4, reason: `slm unparseable: ${cleaned}` }
  }
}

// ---------------------------------------------------------------------------
// Re-exports (back-compat for existing imports)
// ---------------------------------------------------------------------------

export { normalizeMath, structuralMathCompare, misconceptionKeywordMatch, heuristicConfidence }
