/**
 * scripts/authoring/authorVisuals.ts
 *
 * Authors ONE inline visual per concept using Claude Opus. Reads the
 * concept's ground-truth explanation from concept_explanations and asks
 * Opus to emit a Visual JSON spec matching one of our 6 primitives.
 *
 * Then validates the spec end-to-end:
 *  - JSON shape matches one of the discriminated-union variants
 *  - All expressions compile cleanly via src/visuals/expr.ts
 *  - Renders successfully under JSDOM (catches axis-mismatch / NaN-only output)
 *
 * If validation passes, writes content/visuals/<concept_id>.json.
 *
 * Run: npx tsx scripts/authoring/authorVisuals.ts <concept_id> [<concept_id> ...]
 *      npx tsx scripts/authoring/authorVisuals.ts --all-missing
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { JSDOM } from 'jsdom'
import { compileExpression } from '../../src/visuals/expr.js'
import { visualPromptForConcept, PRIMITIVE_HINTS } from './visualPrompts.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MODEL = process.env['ANTHROPIC_MODEL'] || 'claude-opus-4-6'
const DB_PATH = process.env['DB_PATH'] ?? './data/calculearn.sqlite'
const OUT_DIR = path.resolve(__dirname, '../..', 'content/visuals')

if (!process.env['ANTHROPIC_API_KEY']) {
  console.error('ANTHROPIC_API_KEY is required')
  process.exit(1)
}
const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY']!,
  baseURL: process.env['ANTHROPIC_BASE_URL'] || undefined,
})

interface Concept {
  id: string
  name: string
  one_liner: string
}

interface Explanation {
  body_md: string
  tier: string
  framing_index: number
}

function getConcept(db: BetterSqlite3.Database, id: string): Concept | null {
  const row = db.prepare(
    `SELECT id, name, COALESCE(one_liner, '') AS one_liner FROM concepts WHERE id = ?`
  ).get(id) as Concept | undefined
  return row ?? null
}

function getExplanation(db: BetterSqlite3.Database, conceptId: string): Explanation | null {
  // Prefer on_pace tier; fall back to novice; fall back to any.
  const tries: Array<[string, string]> = [
    ['on_pace', '0'], ['novice', '0'], ['advanced', '0'],
  ]
  for (const [tier, fi] of tries) {
    const r = db.prepare(
      'SELECT body_md, tier, framing_index FROM concept_explanations WHERE concept_id = ? AND tier = ? AND framing_index = ?'
    ).get(conceptId, tier, Number(fi)) as Explanation | undefined
    if (r) return r
  }
  const any = db.prepare(
    'SELECT body_md, tier, framing_index FROM concept_explanations WHERE concept_id = ? LIMIT 1'
  ).get(conceptId) as Explanation | undefined
  return any ?? null
}

async function callOpus(system: string, user: string): Promise<string> {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: user }],
  })
  const block = resp.content[0]
  if (!block || block.type !== 'text') throw new Error('Unexpected response type')
  return block.text.trim()
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

interface VisualEntry {
  slot: string
  title?: string
  caption_md?: string
  display_order?: number
  spec: { kind: string; expression?: string; axes?: Record<string, number> } & Record<string, unknown>
}

const VALID_KINDS = [
  'function_plot', 'secant_to_tangent', 'riemann_sum',
  'accumulation', 'limit_approach', 'slope_field',
]

function validateShape(obj: unknown): { ok: boolean; reason?: string; entry?: VisualEntry } {
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'not an object' }
  const e = obj as Record<string, unknown>
  if (e['slot'] !== 'explanation') return { ok: false, reason: `slot must be "explanation", got ${JSON.stringify(e['slot'])}` }
  if (!e['spec'] || typeof e['spec'] !== 'object') return { ok: false, reason: 'spec missing' }
  const spec = e['spec'] as Record<string, unknown>
  if (typeof spec['kind'] !== 'string' || !VALID_KINDS.includes(spec['kind'])) {
    return { ok: false, reason: `bad kind: ${JSON.stringify(spec['kind'])}` }
  }
  if (spec['kind'] !== 'function_plot' && typeof spec['expression'] !== 'string') {
    // function_plot has expression too, but the renderer also accepts a "curves" array.
    // Be lenient.
  }
  if (typeof spec['expression'] !== 'string' || !spec['expression'].trim()) {
    return { ok: false, reason: 'expression missing or empty' }
  }
  if (!spec['axes'] || typeof spec['axes'] !== 'object') {
    return { ok: false, reason: 'axes missing' }
  }
  const ax = spec['axes'] as Record<string, unknown>
  for (const k of ['xMin', 'xMax', 'yMin', 'yMax']) {
    if (typeof ax[k] !== 'number') return { ok: false, reason: `axes.${k} not a number` }
  }
  return { ok: true, entry: obj as VisualEntry }
}

function validateExpressions(entry: VisualEntry): { ok: boolean; reason?: string } {
  const spec = entry.spec
  let f: (env: Record<string, number>) => number
  try {
    f = compileExpression(spec['expression'] as string)
  } catch (err) {
    return { ok: false, reason: `expression compile failed: ${(err as Error).message}` }
  }
  const ax = spec['axes'] as Record<string, number>
  // For slope_field we sample (x, y); otherwise just (x).
  const isSlopeField = spec['kind'] === 'slope_field'
  const xs: number[] = []
  for (const t of [0, 0.25, 0.5, 0.75, 1.0]) {
    xs.push(ax['xMin']! + t * (ax['xMax']! - ax['xMin']!))
  }
  const ys: number[] = isSlopeField
    ? [0, 0.5, 1.0].map((t) => ax['yMin']! + t * (ax['yMax']! - ax['yMin']!))
    : [0]

  let validHits = 0
  let outOfRange = 0
  const yRange = ax['yMax']! - ax['yMin']!
  for (const x of xs) {
    for (const y of ys) {
      const v = f(isSlopeField ? { x, y } : { x })
      if (!Number.isFinite(v)) continue
      validHits++
      // For non-slope-field primitives, check the value lies inside the y range.
      if (!isSlopeField) {
        const pad = 0.1 * yRange
        if (v < ax['yMin']! - pad || v > ax['yMax']! + pad) outOfRange++
      }
    }
  }
  if (validHits === 0) {
    return { ok: false, reason: 'expression evaluates to NaN at all probe points' }
  }
  // For non-slope-field primitives: if more than half the probe points fall
  // OUTSIDE the y-range, the axes don't bracket the function. Reject so Opus
  // re-picks an axis range.
  if (!isSlopeField && outOfRange > validHits / 2) {
    return {
      ok: false,
      reason: `${outOfRange}/${validHits} probe values fall outside y-range [${ax['yMin']}, ${ax['yMax']}]; pick a range that brackets the function`,
    }
  }
  // Sanity check the curves array (function_plot) if present
  const curves = (spec as Record<string, unknown>)['curves']
  if (Array.isArray(curves)) {
    for (const c of curves) {
      try {
        compileExpression((c as { expression: string }).expression)
      } catch (err) {
        return { ok: false, reason: `curves[].expression compile failed: ${(err as Error).message}` }
      }
    }
  }
  // Validate lines (function_plot only) — catches Opus inventing fields like
  // "slope"/"through" that our renderer doesn't understand.
  const lines = (spec as Record<string, unknown>)['lines']
  if (Array.isArray(lines)) {
    const validKinds = new Set(['segment', 'tangent', 'secant', 'vertical', 'horizontal'])
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i] as Record<string, unknown> | null
      if (!ln || typeof ln !== 'object') {
        return { ok: false, reason: `lines[${i}] is not an object` }
      }
      const kind = ln['kind']
      if (typeof kind !== 'string' || !validKinds.has(kind)) {
        return { ok: false, reason: `lines[${i}].kind must be one of ${[...validKinds].join('|')}, got ${JSON.stringify(kind)}` }
      }
      // Quick required-field check by kind
      if (kind === 'tangent' && typeof ln['at'] !== 'number') {
        return { ok: false, reason: `lines[${i}] (tangent): "at" must be a number` }
      }
      if (kind === 'secant' && (typeof ln['a'] !== 'number' || typeof ln['b'] !== 'number')) {
        return { ok: false, reason: `lines[${i}] (secant): "a" and "b" must be numbers` }
      }
      if ((kind === 'vertical' || kind === 'horizontal') && typeof ln['c'] !== 'number') {
        return { ok: false, reason: `lines[${i}] (${kind}): "c" must be a number` }
      }
      if (kind === 'segment' && (typeof ln['x0'] !== 'number' || typeof ln['x1'] !== 'number')) {
        return { ok: false, reason: `lines[${i}] (segment): "x0" and "x1" must be numbers` }
      }
    }
  }
  return { ok: true }
}

async function validateRender(entry: VisualEntry): Promise<{ ok: boolean; reason?: string }> {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  ;(globalThis as Record<string, unknown>)['document'] = dom.window.document
  ;(globalThis as Record<string, unknown>)['window'] = dom.window
  ;(globalThis as Record<string, unknown>)['HTMLElement'] = dom.window.HTMLElement
  ;(globalThis as Record<string, unknown>)['SVGElement'] = dom.window.SVGElement
  ;(globalThis as Record<string, unknown>)['PointerEvent'] = dom.window.PointerEvent ?? dom.window.Event
  try {
    const { renderVisual } = await import('../../src/visuals/render.js')
    const el = renderVisual(entry.spec as never)
    const html = (el as { outerHTML?: string }).outerHTML ?? ''
    if (!html.includes('<svg')) return { ok: false, reason: 'no <svg> in rendered output' }
    if (!html.includes('<path') && !html.includes('<line')) {
      return { ok: false, reason: 'no <path> or <line> elements — empty visual' }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: `render threw: ${(err as Error).message}` }
  }
}

async function authorOne(db: BetterSqlite3.Database, conceptId: string): Promise<void> {
  console.log(`\n=== ${conceptId} ===`)
  const concept = getConcept(db, conceptId)
  if (!concept) {
    console.error(`  NOT FOUND in concepts table`)
    return
  }
  const exp = getExplanation(db, conceptId)
  if (!exp) {
    console.error(`  no explanation found — skipping`)
    return
  }

  const hint = PRIMITIVE_HINTS[conceptId]
  const userPrompt = visualPromptForConcept({
    conceptId,
    conceptName: concept.name,
    oneLiner: concept.one_liner,
    groundTruthExplanation: hint
      ? `${exp.body_md}\n\nHINT: ${hint}`
      : exp.body_md,
  })

  let lastError = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`  attempt ${attempt}...`)
    let raw: string
    try {
      raw = await callOpus(userPrompt.system, userPrompt.user + (attempt > 1
        ? `\n\nPREVIOUS ATTEMPT FAILED VALIDATION: ${lastError}\nFix the issue and re-emit ONLY valid JSON.`
        : ''))
    } catch (err) {
      console.error(`    Opus error: ${(err as Error).message}`)
      lastError = (err as Error).message
      continue
    }
    const cleaned = stripCodeFences(raw)
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch (err) {
      lastError = `JSON.parse failed: ${(err as Error).message}`
      console.error(`    ${lastError}`)
      console.error(`    raw: ${raw.slice(0, 200)}...`)
      continue
    }
    const shape = validateShape(parsed)
    if (!shape.ok) {
      lastError = `shape: ${shape.reason}`
      console.error(`    ${lastError}`)
      continue
    }
    const exprs = validateExpressions(shape.entry!)
    if (!exprs.ok) {
      lastError = `expressions: ${exprs.reason}`
      console.error(`    ${lastError}`)
      continue
    }
    const render = await validateRender(shape.entry!)
    if (!render.ok) {
      lastError = `render: ${render.reason}`
      console.error(`    ${lastError}`)
      continue
    }
    // All good — write
    const outPath = path.join(OUT_DIR, `${conceptId}.json`)
    fs.writeFileSync(outPath, JSON.stringify([shape.entry], null, 2))
    console.log(`  -> wrote ${outPath}`)
    console.log(`     kind=${(shape.entry!.spec as { kind: string }).kind} title="${shape.entry!.title}"`)
    return
  }
  console.error(`  GAVE UP after 3 attempts. Last error: ${lastError}`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  let targetIds: string[]
  const db = new BetterSqlite3(DB_PATH)
  db.pragma('foreign_keys = ON')

  if (args.length === 1 && args[0] === '--all-missing') {
    const rows = db.prepare(
      `SELECT id FROM concepts WHERE id NOT IN (
         SELECT DISTINCT concept_id FROM concept_visuals
       ) ORDER BY id`
    ).all() as Array<{ id: string }>
    targetIds = rows.map((r) => r.id)
    console.log(`[author-visuals] ${targetIds.length} concepts missing visuals: ${targetIds.join(', ')}`)
  } else if (args.length > 0) {
    targetIds = args
  } else {
    console.error('Usage:')
    console.error('  npx tsx scripts/authoring/authorVisuals.ts <concept_id> [...]')
    console.error('  npx tsx scripts/authoring/authorVisuals.ts --all-missing')
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const id of targetIds) {
    await authorOne(db, id)
  }
  db.close()
  console.log('\n[author-visuals] Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
