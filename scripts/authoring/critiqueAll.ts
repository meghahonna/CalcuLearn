/**
 * scripts/authoring/critiqueAll.ts — E2 (run critique across all concepts)
 *
 * For each concept in the DB (or a specified subset), assembles the
 * full content JSON, asks Opus for a structured critique, validates
 * the response shape, and writes a per-concept verdict file to
 * content/critiques/<concept_id>.json.
 *
 * After all critiques run, prints a triage summary and writes
 * content/critiques/SUMMARY.md for human review.
 *
 * Run:
 *   npx tsx scripts/authoring/critiqueAll.ts                    (all 20)
 *   npx tsx scripts/authoring/critiqueAll.ts deriv.chain-rule   (one)
 *   npx tsx scripts/authoring/critiqueAll.ts --resume           (skip already-critiqued)
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { critiquePromptForConcept } from './critiquePrompts.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MODEL = process.env['ANTHROPIC_MODEL'] || 'claude-opus-4-6'
const DB_PATH = process.env['DB_PATH'] ?? './data/calculearn.sqlite'
const OUT_DIR = path.resolve(__dirname, '../..', 'content/critiques')

if (!process.env['ANTHROPIC_API_KEY']) {
  console.error('ANTHROPIC_API_KEY is required')
  process.exit(1)
}
const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY']!,
  baseURL: process.env['ANTHROPIC_BASE_URL'] || undefined,
})

interface CritiqueIssue {
  severity: 'critical' | 'important' | 'minor'
  category: 'math' | 'pedagogy' | 'ap_alignment' | 'consistency' | 'style'
  location: string
  description: string
  suggested_fix: string
}

interface CritiqueVerdict {
  conceptId: string
  conceptName: string
  verdict: 'ok' | 'issues_found'
  overall_severity: 'none' | 'minor' | 'important' | 'critical'
  issues: CritiqueIssue[]
  summary: string
  /** Critique meta */
  critiquedAt: string
  modelVersion: string
}

interface Row {
  [k: string]: unknown
}

// ---- DB readers -----------------------------------------------------------

function loadConcept(db: BetterSqlite3.Database, conceptId: string): Record<string, unknown> | null {
  const meta = db.prepare(
    `SELECT id, name, track, COALESCE(one_liner, '') AS one_liner, COALESCE(prerequisites_json, '[]') AS prerequisites FROM concepts WHERE id = ?`
  ).get(conceptId) as Row | undefined
  if (!meta) return null
  // Pull every related row, structured by section
  const explanations = db.prepare(
    'SELECT tier, framing_index, body_md, intuition_md FROM concept_explanations WHERE concept_id = ? ORDER BY tier, framing_index'
  ).all(conceptId)
  const examples = db.prepare(
    'SELECT tier, problem_md, steps_json FROM concept_examples WHERE concept_id = ? ORDER BY tier'
  ).all(conceptId).map((r) => {
    const row = r as Row
    return {
      tier: row['tier'],
      problem_md: row['problem_md'],
      steps: row['steps_json'] ? JSON.parse(row['steps_json'] as string) : [],
    }
  })
  const misconceptions = db.prepare(
    'SELECT short_name, description_md, why_wrong_md, socratic_response_md FROM concept_misconceptions WHERE concept_id = ? ORDER BY id'
  ).all(conceptId)
  const checks = db.prepare(
    'SELECT tier, question_md, expected_answer_md, expected_pattern FROM concept_checks WHERE concept_id = ? ORDER BY tier, id'
  ).all(conceptId)
  const deep_dives = db.prepare(
    'SELECT title, body_md FROM concept_deep_dives WHERE concept_id = ? ORDER BY id'
  ).all(conceptId)
  const applications = db.prepare(
    'SELECT context, problem_md, solution_outline_md FROM concept_applications WHERE concept_id = ? ORDER BY id'
  ).all(conceptId)

  return {
    concept_id: meta['id'],
    name: meta['name'],
    track: meta['track'],
    one_liner: meta['one_liner'],
    prerequisites: JSON.parse((meta['prerequisites'] as string) || '[]'),
    explanations,
    examples,
    misconceptions,
    checks,
    deep_dives,
    applications,
  }
}

// ---- Opus call ------------------------------------------------------------

async function callOpus(system: string, user: string): Promise<string> {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system,
    messages: [{ role: 'user', content: user }],
  })
  const block = resp.content[0]
  if (!block || block.type !== 'text') throw new Error('unexpected response type')
  return block.text.trim()
}

function stripCodeFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
}

function parseVerdict(raw: string): { ok: boolean; verdict?: Omit<CritiqueVerdict, 'conceptId' | 'conceptName' | 'critiquedAt' | 'modelVersion'>; reason?: string } {
  const cleaned = stripCodeFences(raw)
  // Find the outermost JSON object
  const start = cleaned.indexOf('{')
  if (start === -1) return { ok: false, reason: 'no JSON object found' }
  let depth = 0
  let inString = false
  let escape = false
  let end = -1
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i]!
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) return { ok: false, reason: 'JSON object not closed' }
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
    if (obj['verdict'] !== 'ok' && obj['verdict'] !== 'issues_found') {
      return { ok: false, reason: `bad verdict field: ${JSON.stringify(obj['verdict'])}` }
    }
    if (!Array.isArray(obj['issues'])) {
      return { ok: false, reason: 'issues field is not an array' }
    }
    const sev = obj['overall_severity']
    if (sev !== 'none' && sev !== 'minor' && sev !== 'important' && sev !== 'critical') {
      return { ok: false, reason: `bad overall_severity: ${JSON.stringify(sev)}` }
    }
    return {
      ok: true,
      verdict: {
        verdict: obj['verdict'] as 'ok' | 'issues_found',
        overall_severity: sev as CritiqueVerdict['overall_severity'],
        issues: obj['issues'] as CritiqueIssue[],
        summary: String(obj['summary'] ?? ''),
      },
    }
  } catch (err) {
    return { ok: false, reason: `JSON.parse failed: ${(err as Error).message}` }
  }
}

// ---- main -----------------------------------------------------------------

async function critiqueOne(db: BetterSqlite3.Database, conceptId: string): Promise<CritiqueVerdict | null> {
  console.log(`\n=== ${conceptId} ===`)
  const blob = loadConcept(db, conceptId)
  if (!blob) {
    console.error('  NOT FOUND in DB')
    return null
  }
  const prompt = critiquePromptForConcept({
    conceptId,
    conceptName: String(blob['name']),
    oneLiner: String(blob['one_liner'] ?? ''),
    conceptJson: blob,
  })

  let lastError = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`  attempt ${attempt}...`)
    let raw: string
    try {
      raw = await callOpus(
        prompt.system,
        prompt.user + (attempt > 1 ? `\n\nPREVIOUS ATTEMPT FAILED: ${lastError}\nFix the issue and re-emit valid JSON.` : '')
      )
    } catch (err) {
      lastError = (err as Error).message
      console.error(`    opus error: ${lastError}`)
      continue
    }
    const parsed = parseVerdict(raw)
    if (!parsed.ok || !parsed.verdict) {
      lastError = parsed.reason || 'unknown'
      console.error(`    parse: ${lastError}`)
      console.error(`    raw: ${raw.slice(0, 200)}...`)
      continue
    }
    return {
      conceptId,
      conceptName: String(blob['name']),
      ...parsed.verdict,
      critiquedAt: new Date().toISOString(),
      modelVersion: MODEL,
    }
  }
  console.error(`  GAVE UP after 3 attempts`)
  return null
}

function summarizeVerdict(v: CritiqueVerdict): string {
  const counts: Record<string, number> = { critical: 0, important: 0, minor: 0 }
  for (const i of v.issues) counts[i.severity] = (counts[i.severity] ?? 0) + 1
  const tag = v.verdict === 'ok' ? 'OK' : `${v.overall_severity.toUpperCase()}`
  return (
    `${v.conceptId.padEnd(24)}  ${tag.padEnd(10)}  ` +
    `crit=${counts['critical']} imp=${counts['important']} min=${counts['minor']}  ` +
    `${v.summary.slice(0, 60)}`
  )
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const resume = args.includes('--resume')
  const targets = args.filter((a) => !a.startsWith('--'))

  const db = new BetterSqlite3(DB_PATH, { readonly: true })
  db.pragma('foreign_keys = ON')

  // Pick which concepts to critique
  let ids: string[]
  if (targets.length > 0) {
    ids = targets
  } else {
    const rows = db.prepare(
      `SELECT id FROM concepts WHERE id IN (SELECT DISTINCT concept_id FROM concept_explanations) ORDER BY id`
    ).all() as Array<{ id: string }>
    ids = rows.map((r) => r.id)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const verdicts: CritiqueVerdict[] = []
  for (const id of ids) {
    const outPath = path.join(OUT_DIR, `${id}.json`)
    if (resume && fs.existsSync(outPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(outPath, 'utf8')) as CritiqueVerdict
        verdicts.push(existing)
        console.log(`\n=== ${id} (cached, skip) ===`)
        continue
      } catch { /* fall through and re-run */ }
    }
    const v = await critiqueOne(db, id)
    if (v) {
      fs.writeFileSync(outPath, JSON.stringify(v, null, 2))
      verdicts.push(v)
      console.log(`  -> ${summarizeVerdict(v)}`)
    }
  }
  db.close()

  // Print + write summary
  console.log('\n\n=== Summary ===')
  for (const v of verdicts) console.log('  ' + summarizeVerdict(v))

  // Counts by severity
  const bySev: Record<string, number> = { ok: 0, minor: 0, important: 0, critical: 0 }
  for (const v of verdicts) {
    if (v.verdict === 'ok') bySev['ok'] = (bySev['ok'] ?? 0) + 1
    else bySev[v.overall_severity] = (bySev[v.overall_severity] ?? 0) + 1
  }
  console.log(`\nVerdicts: ${bySev['ok']} ok | ${bySev['minor']} minor | ${bySev['important']} important | ${bySev['critical']} critical`)

  // Markdown summary
  writeSummary(verdicts)
  console.log(`\nWrote ${OUT_DIR}/SUMMARY.md`)
}

function writeSummary(verdicts: CritiqueVerdict[]): void {
  const lines: string[] = []
  lines.push('# Content Critique — Summary (E2)\n')
  lines.push(`> Auto-generated by \`scripts/authoring/critiqueAll.ts\`. Each concept was reviewed by Claude Opus playing the role of a senior AP Calculus teacher checking for mathematical accuracy, pedagogical clarity, AP curriculum alignment, internal consistency, and style compliance.\n`)
  lines.push(`> Generated: ${new Date().toISOString()}\n`)
  lines.push('')

  // Severity rollup
  const bySev: Record<string, number> = { ok: 0, minor: 0, important: 0, critical: 0 }
  for (const v of verdicts) {
    if (v.verdict === 'ok') bySev['ok'] = (bySev['ok'] ?? 0) + 1
    else bySev[v.overall_severity] = (bySev[v.overall_severity] ?? 0) + 1
  }
  lines.push('## Verdict rollup\n')
  lines.push('| Severity | Count |')
  lines.push('|---|---:|')
  lines.push(`| ok (no issues) | ${bySev['ok']} |`)
  lines.push(`| minor | ${bySev['minor']} |`)
  lines.push(`| important | ${bySev['important']} |`)
  lines.push(`| critical | ${bySev['critical']} |`)
  lines.push(`| **total** | **${verdicts.length}** |`)
  lines.push('')

  // Per-concept table
  lines.push('## By concept\n')
  lines.push('| Concept | Verdict | Critical | Important | Minor | Summary |')
  lines.push('|---|---|---:|---:|---:|---|')
  for (const v of verdicts) {
    const c = v.issues.filter((i) => i.severity === 'critical').length
    const i = v.issues.filter((i) => i.severity === 'important').length
    const m = v.issues.filter((i) => i.severity === 'minor').length
    const tag = v.verdict === 'ok' ? 'ok' : v.overall_severity
    lines.push(`| \`${v.conceptId}\` | ${tag} | ${c} | ${i} | ${m} | ${v.summary.replace(/\|/g, '\\|')} |`)
  }
  lines.push('')

  // Critical issues — every single one expanded
  const criticalConcepts = verdicts.filter((v) => v.issues.some((i) => i.severity === 'critical'))
  if (criticalConcepts.length > 0) {
    lines.push('## Critical issues (must regenerate)\n')
    for (const v of criticalConcepts) {
      lines.push(`### ${v.conceptId} — ${v.conceptName}\n`)
      for (const i of v.issues.filter((i) => i.severity === 'critical')) {
        lines.push(`- **${i.category}** in \`${i.location}\``)
        lines.push(`  - ${i.description}`)
        lines.push(`  - **fix:** ${i.suggested_fix}`)
      }
      lines.push('')
    }
  }

  // Important issues — every single one expanded
  const importantConcepts = verdicts.filter(
    (v) => v.issues.some((i) => i.severity === 'important') && !v.issues.some((i) => i.severity === 'critical')
  )
  if (importantConcepts.length > 0) {
    lines.push('## Important issues (should regenerate)\n')
    for (const v of importantConcepts) {
      lines.push(`### ${v.conceptId} — ${v.conceptName}\n`)
      for (const i of v.issues.filter((i) => i.severity === 'important')) {
        lines.push(`- **${i.category}** in \`${i.location}\``)
        lines.push(`  - ${i.description}`)
        lines.push(`  - **fix:** ${i.suggested_fix}`)
      }
      lines.push('')
    }
  }

  // Minor issues — collapsed by concept
  const minorConcepts = verdicts.filter((v) => v.issues.some((i) => i.severity === 'minor') && v.overall_severity === 'minor')
  if (minorConcepts.length > 0) {
    lines.push('## Minor issues (safe to ship)\n')
    for (const v of minorConcepts) {
      const issues = v.issues.filter((i) => i.severity === 'minor')
      lines.push(`<details>`)
      lines.push(`<summary><strong>${v.conceptId}</strong> — ${issues.length} minor issue(s)</summary>`)
      lines.push('')
      for (const i of issues) {
        lines.push(`- **${i.category}** in \`${i.location}\`: ${i.description}`)
      }
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'SUMMARY.md'), lines.join('\n'))
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
