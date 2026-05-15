/**
 * src/components/conceptRouter.ts — A3 (Explore Mode)
 *
 * Routes a free-form student question to ONE concept ID using a two-tier
 * pipeline (mirrors the classifier pattern from A5):
 *
 *   Tier 1 (deterministic, <5ms): TF-IDF-flavored keyword scoring against
 *     each concept's name + one-liner + alias keywords. Returns top-N
 *     candidates with scores.
 *
 *   Tier 2 (SLM, ~1-2s): If tier 1 produces a tied or low-confidence
 *     winner, ask the SLM to pick from the top candidates. Constrained
 *     output ("chain_rule" | "off_topic" | etc) so the parse is cheap.
 *
 * Off-topic detection: if the best tier-1 score is below a small
 * threshold AND the SLM either picks off_topic or returns an unknown id,
 * we route to off_topic and the caller surfaces a "I can only help with
 * AP Calculus" message.
 *
 * Caching: the keyword index is built once at construction time from
 * the concept catalog. Re-querying is O(C) where C ~ 20.
 */

import type { DialogueGenerator } from './dialogueGenerator.js'
import type { ContentRetrieval } from './contentRetrieval.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteResult {
  conceptId: string | null      // null = off_topic
  conceptName?: string
  confidence: number            // 0-1
  tier: 1 | 2                   // which tier resolved it
  candidates: Array<{ conceptId: string; score: number }>  // for transparency
  reason: string
  latencyMs: number
}

export interface RouterOptions {
  /** Skip the SLM tier entirely (deterministic-only mode). Default false. */
  disableSlmDisambiguation?: boolean
  /** Number of tier-1 candidates to pass to the SLM. Default 3. */
  topN?: number
  /** Minimum tier-1 score to skip the SLM and accept directly. Default 0.55. */
  acceptThreshold?: number
  /** Maximum tier-1 score below which we treat as off-topic. Default 0.08. */
  offTopicThreshold?: number
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

// ---------------------------------------------------------------------------
// Keyword vocab — what we INDEX each concept by
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'should',
  'could', 'can', 'and', 'or', 'but', 'if', 'so', 'then', 'than',
  'that', 'this', 'these', 'those', 'as', 'at', 'in', 'on', 'of', 'to',
  'for', 'with', 'by', 'from', 'into', 'about', 'over', 'under',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them', 'my', 'your',
  'his', 'her', 'its', 'our', 'their', 'me', 'us',
  'what', 'when', 'where', 'why', 'how', 'who',
  'just', 'also', 'too', 'very', 'really', 'not', 'no', 'yes',
  'only', 'all', 'some', 'any', 'one', 'two', 'three',
  'use', 'using', 'find', 'help', 'please', 'show',
])

/**
 * Hand-curated aliases per concept. The student probably says
 * "derivative" rather than "the derivative as a limit", or "max" rather
 * than "optimisation". Adding aliases ensures the router catches the
 * student's vernacular.
 */
const CONCEPT_ALIASES: Record<string, string[]> = {
  'limits.definition':       ['limit', 'limits', 'approaches', 'tends to', 'what is a limit', 'definition of limit'],
  'limits.one-sided':        ['one sided', 'one-sided', 'left limit', 'right limit', 'from the left', 'from the right'],
  'limits.infinity':         ['limits at infinity', 'horizontal asymptote', 'asymptote', 'end behavior', 'long run'],
  'limits.lhopital':         ['l hopital', 'lhopital', 'l hospital', 'lhopitals rule', 'indeterminate', 'zero over zero', '0/0', 'infinity over infinity', 'apply lhopital'],
  'continuity.definition':   ['continuous', 'continuity', 'connected', 'no break'],
  'continuity.types':        ['discontinuity', 'jump', 'hole', 'removable', 'infinite discontinuity'],
  'deriv.power-rule':        ['power rule', 'derivative of x squared', 'derivative of x cubed', 'derivative of x to the n', 'd/dx'],
  'deriv.chain-rule':        ['chain rule', 'composition', 'inside outside', 'nested function', 'differentiate composition', 'sin x squared', 'cos x squared', 'derivative of sin'],
  'deriv.product-rule':      ['product rule', 'derivative of a product', 'multiplying functions'],
  'deriv.quotient-rule':     ['quotient rule', 'derivative of a fraction', 'dividing functions', 'derivative of a ratio'],
  'deriv.implicit':          ['implicit', 'implicit differentiation', 'curve', 'dy/dx', 'differentiate both sides'],
  'deriv.related-rates':     ['related rates', 'cone draining', 'ladder', 'shadow', 'rate', 'expanding circle', 'water level'],
  'deriv.optimisation':      ['optimization', 'optimisation', 'max', 'min', 'maximum', 'minimum', 'critical point', 'biggest', 'smallest', 'maximize', 'minimize', 'optimize'],
  'integ.riemann':           ['riemann sum', 'riemann', 'rectangles under', 'area under', 'midpoint rule', 'trapezoidal'],
  'integ.substitution':      ['u substitution', 'u-substitution', 'substitution', 'change of variable'],
  'integ.by-parts':          ['integration by parts', 'by parts', 'ibp', 'integrate by parts'],
  'integ.ftc':               ['fundamental theorem', 'ftc', 'antiderivative connects'],
  'integ.definite-apps':     ['definite integral', 'application', 'displacement', 'total change', 'area between curves'],
  'ode.separable':           ['separable', 'separable ode', 'differential equation', 'separation of variables', 'dy/dx equals'],
  'ode.first-order-linear':  ['first order linear', 'integrating factor', 'linear ode', 'first-order linear'],
}

interface ConceptIndexEntry {
  conceptId: string
  conceptName: string
  oneLiner: string | null
  /** keyword -> weight (higher = more diagnostic of this concept) */
  vocab: Map<string, number>
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9'\s/.-]/g, ' ')
    .replace(/['-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
}

function buildIndex(concepts: Array<{ id: string; name: string; one_liner: string | null }>): ConceptIndexEntry[] {
  const entries: ConceptIndexEntry[] = concepts.map((c) => {
    const vocab = new Map<string, number>()
    // Name tokens get the highest weight — students usually say the
    // canonical concept name.
    for (const w of tokenize(c.name)) {
      vocab.set(w, (vocab.get(w) ?? 0) + 3)
    }
    // One-liner tokens get medium weight.
    for (const w of tokenize(c.one_liner ?? '')) {
      vocab.set(w, (vocab.get(w) ?? 0) + 1.5)
    }
    // Hand-curated aliases get high weight (these are what students
    // actually say).
    for (const alias of CONCEPT_ALIASES[c.id] ?? []) {
      for (const w of tokenize(alias)) {
        vocab.set(w, (vocab.get(w) ?? 0) + 2.5)
      }
    }
    return {
      conceptId: c.id,
      conceptName: c.name,
      oneLiner: c.one_liner,
      vocab,
    }
  })

  // IDF down-weighting: tokens that appear in many concepts are less
  // diagnostic. Words like "rule", "function", "derivative" are nearly
  // useless for picking between concepts. We compute the document
  // frequency (DF) and divide each token's weight by log2(2 + DF).
  const df = new Map<string, number>()
  for (const e of entries) {
    for (const tok of e.vocab.keys()) {
      df.set(tok, (df.get(tok) ?? 0) + 1)
    }
  }
  for (const e of entries) {
    for (const [tok, w] of e.vocab) {
      const d = df.get(tok) ?? 1
      // Boost rare tokens, dampen common ones. log2(2) = 1, log2(22) ~ 4.5.
      const idfFactor = 1 / Math.log2(2 + d)
      e.vocab.set(tok, w * idfFactor)
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// ConceptRouter
// ---------------------------------------------------------------------------

export class ConceptRouter {
  private readonly index: ConceptIndexEntry[]
  private readonly opts: Required<Omit<RouterOptions, 'logger'>> & { logger: Pick<Console, 'log' | 'warn' | 'error'> }

  constructor(
    private readonly content: ContentRetrieval,
    private readonly dialogue: DialogueGenerator,
    opts: RouterOptions = {}
  ) {
    this.opts = {
      disableSlmDisambiguation: opts.disableSlmDisambiguation ?? false,
      topN: opts.topN ?? 3,
      acceptThreshold: opts.acceptThreshold ?? 0.55,
      offTopicThreshold: opts.offTopicThreshold ?? 0.08,
      logger: opts.logger ?? console,
    }
    // Pull all concepts from ContentRetrieval — we route only to authored ones.
    const conceptIds = content.listAuthoredConceptIds()
    const concepts = conceptIds
      .map((id) => content.getConcept(id))
      .filter((c): c is NonNullable<ReturnType<typeof content.getConcept>> => !!c)
    this.index = buildIndex(concepts)
    this.opts.logger.log(
      `[ConceptRouter] Indexed ${this.index.length} concepts. ` +
      `Vocab sizes: min=${Math.min(...this.index.map((e) => e.vocab.size))} ` +
      `max=${Math.max(...this.index.map((e) => e.vocab.size))}`
    )
  }

  async route(question: string): Promise<RouteResult> {
    const start = Date.now()
    const tokens = tokenize(question)
    if (tokens.length === 0) {
      return {
        conceptId: null,
        confidence: 0,
        tier: 1,
        candidates: [],
        reason: 'empty input',
        latencyMs: Date.now() - start,
      }
    }

    // Tier 1: keyword scoring across all concepts
    const tokenSet = new Set(tokens)
    const scored = this.index.map((entry) => {
      let raw = 0
      let hits = 0
      for (const tok of tokenSet) {
        const w = entry.vocab.get(tok)
        if (w) {
          raw += w
          hits++
        }
      }
      // Normalize by question length to penalize very short questions
      // that happen to share one rare word.
      const norm = raw / Math.max(2, Math.sqrt(tokens.length))
      return { conceptId: entry.conceptId, conceptName: entry.conceptName, score: norm, hits }
    })
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, this.opts.topN)

    const bestScore = top[0]?.score ?? 0
    const candidates = top.map((t) => ({ conceptId: t.conceptId, score: Number(t.score.toFixed(3)) }))

    // Off-topic: too low even at the top
    if (bestScore < this.opts.offTopicThreshold) {
      return {
        conceptId: null,
        confidence: 0.5,
        tier: 1,
        candidates,
        reason: `tier-1: best score ${bestScore.toFixed(3)} below off-topic threshold ${this.opts.offTopicThreshold}`,
        latencyMs: Date.now() - start,
      }
    }

    // Strong tier-1 winner: accept without SLM
    const secondScore = top[1]?.score ?? 0
    const margin = bestScore - secondScore
    if (bestScore >= this.opts.acceptThreshold && margin >= 0.2) {
      return {
        conceptId: top[0]!.conceptId,
        conceptName: top[0]!.conceptName,
        confidence: Math.min(0.95, 0.5 + bestScore * 0.3),
        tier: 1,
        candidates,
        reason: `tier-1: clear winner (score ${bestScore.toFixed(3)}, margin ${margin.toFixed(3)})`,
        latencyMs: Date.now() - start,
      }
    }

    // Ambiguous — disambiguate with SLM (or accept tier-1 best if disabled)
    if (this.opts.disableSlmDisambiguation) {
      return {
        conceptId: top[0]!.conceptId,
        conceptName: top[0]!.conceptName,
        confidence: Math.min(0.7, 0.3 + bestScore * 0.3),
        tier: 1,
        candidates,
        reason: `tier-1: best of ambiguous candidates (slm disabled)`,
        latencyMs: Date.now() - start,
      }
    }

    const slmPick = await this.disambiguateWithSlm(question, top)
    return {
      conceptId: slmPick.conceptId,
      conceptName: slmPick.conceptId
        ? this.index.find((e) => e.conceptId === slmPick.conceptId)?.conceptName
        : undefined,
      confidence: slmPick.confidence,
      tier: 2,
      candidates,
      reason: `tier-2: ${slmPick.reason}`,
      latencyMs: Date.now() - start,
    }
  }

  private async disambiguateWithSlm(
    question: string,
    candidates: Array<{ conceptId: string; conceptName: string; score: number }>
  ): Promise<{ conceptId: string | null; confidence: number; reason: string }> {
    const list = candidates
      .map((c, i) => `  ${i + 1}. id=${c.conceptId} — ${c.conceptName}`)
      .join('\n')

    const prompt = `You are a router for an AP Calculus AB/BC tutor app.

The student's question is below. Pick the SINGLE best matching concept from
the candidate list, or "off_topic" if the question isn't about calculus.

STUDENT QUESTION: "${question.slice(0, 400)}"

CANDIDATES:
${list}

Reply with ONLY the concept id (e.g. "${candidates[0]?.conceptId}") OR the
literal string "off_topic". No prose. No punctuation.`

    let raw = ''
    try {
      raw = (await this.dialogue.inferRaw(prompt, 32)).trim()
    } catch (err) {
      this.opts.logger.warn(`[ConceptRouter] SLM error: ${(err as Error).message}`)
      // Fall back to tier-1 best
      return {
        conceptId: candidates[0]?.conceptId ?? null,
        confidence: 0.4,
        reason: `slm failed; fell back to tier-1 best`,
      }
    }
    const cleaned = raw.toLowerCase().replace(/['"`.,;:!?]/g, '').trim()
    if (cleaned.startsWith('off_topic') || cleaned.startsWith('off topic') || cleaned === 'off') {
      return { conceptId: null, confidence: 0.85, reason: `slm: off_topic` }
    }
    // Match against candidate ids (allow tolerant matching — student might
    // wrap in quotes or repeat words)
    for (const c of candidates) {
      if (cleaned.includes(c.conceptId.toLowerCase())) {
        return { conceptId: c.conceptId, confidence: 0.85, reason: `slm picked ${c.conceptId}` }
      }
    }
    // Couldn't parse — default to tier-1 best with lower confidence
    return {
      conceptId: candidates[0]?.conceptId ?? null,
      confidence: 0.5,
      reason: `slm output unparseable ("${raw.slice(0, 40)}"); fell back to tier-1 best`,
    }
  }
}
