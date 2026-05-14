/**
 * TeachBackService — A2 (Feynman technique)
 *
 * Runs a "teach it back" session: the student explains a concept in their
 * own words, and the SLM probes for gaps using the pre-authored explanation
 * and misconception catalog as the ground truth.
 *
 * STRICT LEASH:
 *   - The SLM picks gaps from a CLOSED list (misconceptions + extracted
 *     facets) — it cannot invent new gaps.
 *   - The SLM never reveals the answer; only asks a probing question.
 *
 * State machine per teach-back session:
 *   opening -> probing (N rounds) -> assessing -> done
 *
 * Sessions are kept in memory keyed by sessionId. Persistence across
 * server restarts is deferred (cf. ROADMAP D4).
 */

import { v4 as uuidv4 } from 'uuid'
import type { DialogueGenerator } from './dialogueGenerator.js'
import type {
  ContentRetrieval,
  Tier,
  Explanation,
  Misconception,
} from './contentRetrieval.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TeachBackStage = 'opening' | 'probing' | 'assessing' | 'done' | 'aborted'

export interface TeachBackTurn {
  role: 'agent' | 'student'
  text: string
  meta?: Record<string, unknown>
}

export interface TeachBackSession {
  id: string
  studentId: string
  conceptId: string
  conceptName: string
  tier: Tier
  /** The pre-authored on-pace (or fallback) explanation we treat as ground truth. */
  groundTruthExplanation: Explanation | null
  /** Full misconception catalog for the concept. */
  misconceptions: Misconception[]
  /** Facets extracted from the explanation — bullet-style key points. */
  facets: string[]
  /** Which facets / misconceptions the student covered well so far. */
  strongIds: Set<string>
  /** Which facets / misconceptions still look thin. */
  weakIds: Set<string>
  stage: TeachBackStage
  turns: TeachBackTurn[]
  probeCount: number
  /** Cap on probes before forcing assessment. */
  maxProbes: number
  startedAt: number
}

export interface TeachBackOpenerResponse {
  sessionId: string
  stage: TeachBackStage
  agentMessage: string
  /** Suggested concept "facets" rendered as gentle scaffolding hints. */
  scaffolding: string[]
}

export interface TeachBackProbeResponse {
  sessionId: string
  stage: TeachBackStage
  agentMessage: string
  /** Optional content block surfaced as an aside (e.g. the misconception card). */
  contentBlock?: {
    type: 'misconception' | 'facet'
    title: string
    body_md: string
  }
  /** Whether this turn forced a transition into assessment. */
  done: boolean
  probesRemaining: number
}

export interface TeachBackAssessment {
  sessionId: string
  stage: 'done'
  /** Bullet markdown summarising what the student showed strength on. */
  strongSummary: string
  /** Bullet markdown summarising what looked thin. */
  weakSummary: string
  /** Free-form encouragement + pointer to next steps. */
  closingMessage: string
  /** Suggested follow-ups for weak areas. */
  recommendations: Array<{
    kind: 'learn_alt_framing' | 'review_misconception' | 'practice'
    label: string
    target: string
  }>
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const SOCRATIC_SYSTEM = `You are a Socratic AP Calculus tutor inside the CalcuLearn app.

STRICT RULES:
1. You may ONLY reference the GROUND TRUTH below — never invent new mathematical facts.
2. Be brief: 2-3 short sentences max per turn.
3. Be Socratic: ask a question rather than lecturing.
4. Use plain English. LaTeX only when echoing math already in the ground truth.
5. No emojis. No filler ("Great question..."). No exclamation marks.
6. Write to one student. Use "you", not "we".`

function shorten(s: string, max = 2000): string {
  return s.length <= max ? s : s.slice(0, max) + '...'
}

/**
 * Build the opener — invites the student to teach the concept back.
 * Conversational, low-stakes; no SLM call needed for this one.
 */
function buildOpener(conceptName: string, oneLiner: string | null): string {
  const tag = oneLiner ? ` — ${oneLiner.replace(/[.!?]+$/, '')}` : ''
  return (
    `Let's try a "teach-it-back" on ${conceptName}${tag}. ` +
    `Imagine a friend who's never seen this. ` +
    `Explain it to them in your own words — as long or short as you like. ` +
    `When you're done, I'll ask a couple of questions to see where it landed.`
  )
}

/**
 * Probe prompt: SLM receives the student's explanation, the ground truth,
 * the misconception catalog, and is asked to pick ONE gap.
 *
 * Output is constrained JSON so we can parse it.
 */
function buildProbePrompt(args: {
  conceptName: string
  groundTruth: string
  facets: string[]
  misconceptions: Misconception[]
  studentExplanation: string
  turnsSoFar: TeachBackTurn[]
  alreadyCoveredIds: string[]
}): string {
  const miscList = args.misconceptions
    .map((m, i) => `  M${i}. id=${m.short_name} — ${m.description_md.slice(0, 220)}`)
    .join('\n')
  const facetList = args.facets
    .map((f, i) => `  F${i}. ${f}`)
    .join('\n')
  const history = args.turnsSoFar
    .slice(-6)
    .map((t) => `  [${t.role}] ${t.text.slice(0, 240)}`)
    .join('\n')

  return `${SOCRATIC_SYSTEM}

GROUND TRUTH (the authoritative explanation of "${args.conceptName}"):
${shorten(args.groundTruth)}

KEY FACETS (the explanation broken into specific points the student should ideally cover):
${facetList || '  (none extracted)'}

COMMON MISCONCEPTIONS (gaps to watch for):
${miscList || '  (none)'}

CONVERSATION SO FAR:
${history || '(none)'}

STUDENT'S MOST RECENT EXPLANATION:
"${shorten(args.studentExplanation, 1500)}"

ALREADY-PROBED GAPS (do NOT pick these again):
${args.alreadyCoveredIds.join(', ') || '(none)'}

TASK:
Pick ONE gap from the closed list below. The gap is either a FACET the
student didn't cover (or covered superficially) OR a MISCONCEPTION their
explanation suggests. If the explanation looks solid, pick the deepest
facet they didn't fully nail.

Output a SINGLE JSON object on ONE line with this exact shape:
{"gap_id":"F2","gap_kind":"facet","question":"..."}

Where:
- gap_id is one of the F# or M# labels above (do not invent new ids).
- gap_kind is either "facet" or "misconception".
- question is a 1-2 sentence Socratic prompt ending in a question mark.

Output ONLY the JSON, no prose, no markdown fences.`
}

/**
 * Final assessment prompt: summarise what the student got right and where they were thin.
 * No SLM call needed for the bullet lists — those come from the strong/weak sets.
 * The SLM only generates the short closing message.
 */
function buildClosingPrompt(args: {
  conceptName: string
  strongFacets: string[]
  weakFacets: string[]
}): string {
  const strongText = args.strongFacets.length === 0
    ? '(no clear strengths yet)'
    : args.strongFacets.map((s) => `- ${s}`).join('\n')
  const weakText = args.weakFacets.length === 0
    ? '(no clear gaps)'
    : args.weakFacets.map((s) => `- ${s}`).join('\n')

  return `${SOCRATIC_SYSTEM}

CONCEPT: ${args.conceptName}

WHAT THE STUDENT EXPLAINED WELL:
${strongText}

WHAT LOOKED THIN OR MISSING:
${weakText}

TASK:
Write 2-3 sentences of warm, brief, honest closing feedback to the student.
Acknowledge one specific strength, name one specific gap, and suggest the
single next step (re-read the explanation, try a practice problem, or
look at a misconception). Do not list multiple bullets. End on a forward-looking note.`
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface TeachBackServiceOptions {
  contentRetrieval: ContentRetrieval
  dialogueGenerator: DialogueGenerator
  /** Default tier for the ground-truth explanation. */
  defaultTier?: Tier
  /** Hard cap on probes before forcing assessment. */
  maxProbes?: number
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

export class TeachBackService {
  private readonly content: ContentRetrieval
  private readonly dialogue: DialogueGenerator
  private readonly defaultTier: Tier
  private readonly maxProbes: number
  private readonly logger: Pick<Console, 'log' | 'warn' | 'error'>
  private readonly sessions = new Map<string, TeachBackSession>()

  constructor(opts: TeachBackServiceOptions) {
    this.content = opts.contentRetrieval
    this.dialogue = opts.dialogueGenerator
    this.defaultTier = opts.defaultTier ?? 'on_pace'
    this.maxProbes = opts.maxProbes ?? 4
    this.logger = opts.logger ?? console
  }

  // ------------------------------------------------------------- start

  async start(args: {
    studentId: string
    conceptId: string
    tier?: Tier
  }): Promise<TeachBackOpenerResponse> {
    const concept = this.content.getConcept(args.conceptId)
    if (!concept) throw new Error(`Concept not found: ${args.conceptId}`)
    if (!this.content.isAuthored(args.conceptId)) {
      throw new Error(`Concept ${args.conceptId} has no authored content.`)
    }

    const tier = args.tier ?? this.defaultTier
    const groundTruth =
      this.content.getExplanation(args.conceptId, tier, 0) ??
      this.content.getExplanation(args.conceptId, 'novice', 0) ??
      this.content.getExplanation(args.conceptId, 'advanced', 0)
    const misconceptions = this.content.listMisconceptions(args.conceptId)
    const facets = extractFacets(groundTruth?.body_md ?? '', concept.name)

    const session: TeachBackSession = {
      id: uuidv4(),
      studentId: args.studentId,
      conceptId: args.conceptId,
      conceptName: concept.name,
      tier,
      groundTruthExplanation: groundTruth,
      misconceptions,
      facets,
      strongIds: new Set(),
      weakIds: new Set(),
      stage: 'opening',
      turns: [],
      probeCount: 0,
      maxProbes: this.maxProbes,
      startedAt: Date.now(),
    }
    this.sessions.set(session.id, session)

    const opener = buildOpener(concept.name, concept.one_liner)
    session.turns.push({ role: 'agent', text: opener, meta: { stage: 'opening' } })
    session.stage = 'probing'

    // Build gentle scaffolding chips — give the student a few facet hints
    // so they don't stare at a blank page.
    const scaffolding = facets.slice(0, 3).map((f) => `Hint: cover "${f}"`)

    return {
      sessionId: session.id,
      stage: session.stage,
      agentMessage: opener,
      scaffolding,
    }
  }

  // ----------------------------------------------------- get session

  getSession(sessionId: string): TeachBackSession | undefined {
    return this.sessions.get(sessionId)
  }

  // ------------------------------------------------------------- respond

  /**
   * Receive the student's explanation, classify it against facets + misconceptions,
   * and return ONE probing question. After maxProbes turns, force assessment.
   */
  async respond(args: {
    sessionId: string
    studentExplanation: string
  }): Promise<TeachBackProbeResponse> {
    const sess = this.sessions.get(args.sessionId)
    if (!sess) throw new Error(`TeachBack session not found: ${args.sessionId}`)
    if (sess.stage === 'done' || sess.stage === 'aborted') {
      return {
        sessionId: sess.id,
        stage: sess.stage,
        agentMessage: 'This teach-back is complete. Start a new one to try again.',
        done: true,
        probesRemaining: 0,
      }
    }

    sess.turns.push({ role: 'student', text: args.studentExplanation })

    // If we've hit the probe cap, force assessment.
    if (sess.probeCount >= sess.maxProbes) {
      sess.stage = 'assessing'
      return {
        sessionId: sess.id,
        stage: sess.stage,
        agentMessage:
          "Nice work walking through that. Let me give you a quick summary of where things stand.",
        done: true,
        probesRemaining: 0,
      }
    }

    // Ask the SLM to pick a gap.
    const alreadyCoveredIds = Array.from(
      new Set([...sess.strongIds, ...sess.weakIds])
    )
    const probePrompt = buildProbePrompt({
      conceptName: sess.conceptName,
      groundTruth: sess.groundTruthExplanation?.body_md ?? '',
      facets: sess.facets,
      misconceptions: sess.misconceptions,
      studentExplanation: args.studentExplanation,
      turnsSoFar: sess.turns,
      alreadyCoveredIds,
    })

    let raw = await this.safeInfer(probePrompt, '', 320)
    let parsed = parseProbeJson(raw)

    // Canonicalise the gap_id to F# / M# and check against already-covered
    if (parsed) {
      const canonical = canonicaliseGapId(parsed.gap_id, sess.facets, sess.misconceptions)
      if (canonical) parsed.gap_id = canonical
      // If we've already probed this gap, request a different one (single retry)
      if (parsed && alreadyCoveredIds.includes(parsed.gap_id)) {
        const retryPrompt = probePrompt + `\n\nIMPORTANT: You picked ${parsed.gap_id} which is already in the already-probed list. Pick a DIFFERENT gap.`
        raw = await this.safeInfer(retryPrompt, '', 320)
        const retryParsed = parseProbeJson(raw)
        if (retryParsed) {
          const c2 = canonicaliseGapId(retryParsed.gap_id, sess.facets, sess.misconceptions)
          if (c2) retryParsed.gap_id = c2
          if (retryParsed && !alreadyCoveredIds.includes(retryParsed.gap_id)) {
            parsed = retryParsed
          }
        }
      }
    }

    // If we couldn't parse, fall back to a generic probe.
    if (!parsed) {
      const probe =
        "Walk me through the part of your explanation where it goes from the general idea to actually computing the answer. What's the very first step you'd take?"
      sess.probeCount += 1
      sess.turns.push({
        role: 'agent',
        text: probe,
        meta: { stage: 'probing', fallback: true },
      })
      return {
        sessionId: sess.id,
        stage: sess.stage,
        agentMessage: probe,
        done: false,
        probesRemaining: sess.maxProbes - sess.probeCount,
      }
    }

    // Record the gap as weak; the student's NEXT response will tell us if
    // they then strengthen it (we move it strong -> weak in the resolveCoverage step).
    sess.weakIds.add(parsed.gap_id)

    // If gap is a misconception, surface its description as a content block.
    let contentBlock: TeachBackProbeResponse['contentBlock']
    if (parsed.gap_kind === 'misconception') {
      let misc: Misconception | undefined
      // gap_id is canonicalised to M# at this point
      const m = parsed.gap_id.match(/^M(\d+)$/)
      if (m) {
        const idx = Number(m[1])
        if (idx >= 0 && idx < sess.misconceptions.length) {
          misc = sess.misconceptions[idx]
        }
      } else {
        misc = sess.misconceptions.find((mc) => mc.short_name === parsed.gap_id)
      }
      if (misc) {
        contentBlock = {
          type: 'misconception',
          title: `Watch out: ${misc.short_name.replace(/_/g, ' ')}`,
          body_md: misc.description_md,
        }
      }
    }

    sess.probeCount += 1
    sess.turns.push({
      role: 'agent',
      text: parsed.question,
      meta: { stage: 'probing', gap_id: parsed.gap_id, gap_kind: parsed.gap_kind },
    })

    // Heuristic: if any prior agent turn mentioned a facet by phrase and the
    // student then engaged with it in their response, move it to strong.
    this.refreshStrongWeak(sess, args.studentExplanation)

    return {
      sessionId: sess.id,
      stage: sess.stage,
      agentMessage: parsed.question,
      contentBlock,
      done: false,
      probesRemaining: sess.maxProbes - sess.probeCount,
    }
  }

  // ----------------------------------------------------- assess

  async assess(sessionId: string): Promise<TeachBackAssessment> {
    const sess = this.sessions.get(sessionId)
    if (!sess) throw new Error(`TeachBack session not found: ${sessionId}`)
    sess.stage = 'done'

    // Compute strong / weak labels. Anything not in either set, treat as
    // 'not covered' → goes weak. A facet in BOTH (i.e. probed and then engaged
    // with afterward) → goes strong.
    const strongFacetLabels: string[] = []
    const weakFacetLabels: string[] = []
    sess.facets.forEach((f, idx) => {
      const id = `F${idx}`
      if (sess.strongIds.has(id) && !sess.weakIds.has(id)) strongFacetLabels.push(f)
      else if (sess.weakIds.has(id)) weakFacetLabels.push(f)
      else weakFacetLabels.push(f) // never covered = weak
    })

    const weakMisconceptions: string[] = []
    sess.misconceptions.forEach((m, idx) => {
      const id = `M${idx}`
      if (sess.weakIds.has(id) || sess.weakIds.has(m.short_name)) {
        weakMisconceptions.push(m.description_md.slice(0, 140))
      }
    })

    const closingPrompt = buildClosingPrompt({
      conceptName: sess.conceptName,
      strongFacets: strongFacetLabels,
      weakFacets: [...weakFacetLabels, ...weakMisconceptions],
    })
    const closingMessage = await this.safeInfer(
      closingPrompt,
      `You worked through ${sess.conceptName}. Take another look at the parts that were thin, then try a practice problem to lock it in.`,
      256
    )

    const strongSummary = strongFacetLabels.length
      ? strongFacetLabels.map((s) => `- ${s}`).join('\n')
      : '_The session was short — no facets fully demonstrated yet._'

    const weakSummary = weakFacetLabels.length || weakMisconceptions.length
      ? [
          ...weakFacetLabels.map((s) => `- ${s}`),
          ...weakMisconceptions.map((s) => `- (misconception) ${s}`),
        ].join('\n')
      : '_No clear gaps surfaced._'

    const recommendations: TeachBackAssessment['recommendations'] = []
    if (weakFacetLabels.length > 0) {
      recommendations.push({
        kind: 'learn_alt_framing',
        label: `Re-read the explanation in Learn Mode`,
        target: sess.conceptId,
      })
    }
    if (weakMisconceptions.length > 0) {
      recommendations.push({
        kind: 'review_misconception',
        label: `Review the common misconceptions`,
        target: sess.conceptId,
      })
    }
    recommendations.push({
      kind: 'practice',
      label: `Try a Practice problem to lock it in`,
      target: sess.conceptId,
    })

    sess.turns.push({
      role: 'agent',
      text: closingMessage,
      meta: { stage: 'done' },
    })

    return {
      sessionId: sess.id,
      stage: 'done',
      strongSummary,
      weakSummary,
      closingMessage,
      recommendations,
    }
  }

  // -------------------------------------------------------- internals

  /**
   * Heuristic engagement check: if a facet was probed in a prior agent turn
   * and the student's latest explanation contains a meaningful overlap with
   * that facet (or contains substantive math/keywords from the ground truth),
   * mark it as strong.
   */
  private refreshStrongWeak(sess: TeachBackSession, latestText: string): void {
    const normalized = latestText.toLowerCase()
    const wordCount = normalized.split(/\s+/).filter((w) => w.length > 2).length
    if (wordCount < 6) return // too short to count as engagement

    sess.facets.forEach((facet, idx) => {
      const id = `F${idx}`
      if (sess.strongIds.has(id)) return
      // Count keyword overlap with facet text (3+ overlapping meaningful words)
      const facetKeywords = facet
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3)
      const overlap = facetKeywords.filter((kw) => normalized.includes(kw)).length
      if (overlap >= 3) {
        sess.strongIds.add(id)
        sess.weakIds.delete(id) // upgrade
      }
    })
  }

  private async safeInfer(
    prompt: string,
    fallback: string,
    maxTokens = 256
  ): Promise<string> {
    try {
      const out = await this.dialogue.inferRaw(prompt, maxTokens)
      const trimmed = (out ?? '').trim()
      return trimmed.length > 0 ? trimmed : fallback
    } catch (err) {
      this.logger.warn(`[TeachBack] inference fell back: ${(err as Error).message}`)
      return fallback
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract concept "facets" — the key points a complete explanation should
 * touch. Heuristic: numbered list items in body_md (1. ..., 2. ...) are
 * the most reliable signal because that's how Opus structured the
 * explanations. Falls back to first-sentence-of-each-paragraph.
 */
function extractFacets(bodyMd: string, conceptName: string): string[] {
  const facets: string[] = []
  // 1. Numbered list items
  const numberedRe = /^\s*\d+\.\s+(.+?)(?=\n\s*\d+\.|\n\s*\n|$)/gms
  let m: RegExpExecArray | null
  while ((m = numberedRe.exec(bodyMd)) !== null) {
    const first = (m[1] ?? '').replace(/\s+/g, ' ').trim()
    // Trim to ~120 chars
    facets.push(first.length > 140 ? first.slice(0, 140) + '...' : first)
    if (facets.length >= 5) break
  }
  if (facets.length > 0) return facets

  // 2. Fallback — first sentence of each paragraph
  const paragraphs = bodyMd.split(/\n\s*\n/)
  for (const para of paragraphs) {
    const sentence = para.split(/(?<=[.!?])\s+/)[0]?.trim() ?? ''
    if (sentence.length > 20 && sentence.length < 200) {
      facets.push(sentence)
    }
    if (facets.length >= 5) break
  }
  if (facets.length > 0) return facets

  // 3. Last-resort fallback
  return [
    `What ${conceptName} means`,
    `When to use it`,
    `How to apply it on a simple case`,
  ]
}

interface ParsedProbe {
  gap_id: string
  gap_kind: 'facet' | 'misconception'
  question: string
}

function parseProbeJson(raw: string): ParsedProbe | null {
  if (!raw) return null
  // Strip code fences if present
  let s = raw.trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  // Find outer braces
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let end = -1
  let inString = false
  let escape = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) return null
  try {
    const obj = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>
    const gap_id = String(obj['gap_id'] ?? '').trim()
    const gap_kind = String(obj['gap_kind'] ?? '').trim() as 'facet' | 'misconception'
    const question = String(obj['question'] ?? '').trim()
    if (!gap_id || !question) return null
    if (gap_kind !== 'facet' && gap_kind !== 'misconception') return null
    return { gap_id, gap_kind, question }
  } catch {
    return null
  }
}

// Normalize a gap_id returned by the SLM to canonical F#/M# form so the
// dedup logic works regardless of whether the model returned an index
// label or a misconception short_name.
function canonicaliseGapId(
  rawId: string,
  facets: string[],
  misconceptions: Misconception[]
): string | null {
  const id = rawId.trim()
  if (!id) return null
  // Already F# or M#
  if (/^F\d+$/i.test(id)) {
    const idx = Number(id.slice(1))
    return idx >= 0 && idx < facets.length ? `F${idx}` : null
  }
  if (/^M\d+$/i.test(id)) {
    const idx = Number(id.slice(1))
    return idx >= 0 && idx < misconceptions.length ? `M${idx}` : null
  }
  // misconception short_name → M#
  const idx = misconceptions.findIndex((m) => m.short_name === id)
  if (idx >= 0) return `M${idx}`
  return null
}

