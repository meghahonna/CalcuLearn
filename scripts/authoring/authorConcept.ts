/**
 * scripts/authoring/authorConcept.ts
 *
 * Authoring pipeline. Calls Claude Opus once per content type for one
 * concept, validates the assembled JSON against content/schema/concept.schema.json,
 * and writes content/concepts/<concept_id>.json.
 *
 * Run:
 *   npx tsx scripts/authoring/authorConcept.ts <concept_id>
 *   RUN_CRITIQUE=1 npx tsx scripts/authoring/authorConcept.ts <concept_id>
 *
 * Required env vars (set by the Athena runtime):
 *   ANTHROPIC_API_KEY    - API key for the gateway
 *   ANTHROPIC_BASE_URL   - https://llmgateway.prd.athenaintel.com/anthropic
 *   ANTHROPIC_MODEL      - optional override; defaults to claude-opus-4-6
 */

import Anthropic from '@anthropic-ai/sdk'
import Ajv from 'ajv'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  applicationPrompt,
  checksPrompt,
  deepDivePrompt,
  examplePrompt,
  explanationPrompt,
  misconceptionsPrompt,
  type PromptPair,
  type Tier,
} from './authoringPrompts.js'
import { CONCEPT_SPECS, type ConceptSpec } from './conceptSpecs.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------------------------------------------------------------
// Anthropic client (Athena gateway)
// ---------------------------------------------------------------------------

const MODEL = process.env['ANTHROPIC_MODEL'] || 'claude-opus-4-6'
const BASE_URL = process.env['ANTHROPIC_BASE_URL']
const API_KEY = process.env['ANTHROPIC_API_KEY']

if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY not set. Aborting.')
  process.exit(1)
}

const client = new Anthropic({
  apiKey: API_KEY,
  ...(BASE_URL ? { baseURL: BASE_URL } : {}),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callOpus(p: PromptPair, maxTokens = 4096): Promise<string> {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: p.system,
    messages: [{ role: 'user', content: p.user }],
  })
  const block = resp.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected response type from Anthropic API')
  }
  return block.text.trim()
}

/**
 * Strips accidental markdown code fences and leading commentary.
 * Sometimes the model wraps the JSON in ```json ... ``` despite instructions.
 */
function extractJson(raw: string): string {
  let s = raw.trim()

  // Strip leading ```json or ```
  s = s.replace(/^```(?:json)?\s*/i, '')
  // Strip trailing ```
  s = s.replace(/```\s*$/i, '')
  s = s.trim()

  // If the model added prose before/after JSON, find the outer braces/brackets.
  // Pick whichever delimiter starts first.
  const firstBrace = s.indexOf('{')
  const firstBracket = s.indexOf('[')
  let start: number
  if (firstBrace === -1 && firstBracket === -1) return s
  if (firstBrace === -1) start = firstBracket
  else if (firstBracket === -1) start = firstBrace
  else start = Math.min(firstBrace, firstBracket)

  const opener = s[start]
  const closer = opener === '{' ? '}' : ']'

  // Find matching closer by depth-counting (ignoring inside strings).
  let depth = 0
  let inString = false
  let escape = false
  let end = -1
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
    if (ch === opener) depth++
    else if (ch === closer) {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) return s.slice(start)
  return s.slice(start, end + 1)
}

function parseJson<T = unknown>(raw: string, where: string): T {
  const cleaned = extractJson(raw)
  try {
    return JSON.parse(cleaned) as T
  } catch (err) {
    const dumpDir = path.resolve(__dirname, '../../content/concepts')
    fs.mkdirSync(dumpDir, { recursive: true })
    const dumpPath = path.join(dumpDir, `_failed_parse_${Date.now()}.txt`)
    fs.writeFileSync(dumpPath, `--- where: ${where} ---\n--- raw ---\n${raw}\n--- cleaned ---\n${cleaned}`)
    throw new Error(`JSON parse failed at ${where}. Raw saved to ${dumpPath}. Original error: ${(err as Error).message}`)
  }
}

// ---------------------------------------------------------------------------
// Authoring pipeline
// ---------------------------------------------------------------------------

interface AuthoredConcept {
  concept_id: string
  name: string
  track: 'AB' | 'BC' | 'BOTH'
  one_liner: string
  prerequisites: string[]
  explanations: unknown[]
  examples: unknown[]
  misconceptions: unknown[]
  checks: unknown[]
  deep_dives: unknown[]
  applications: unknown[]
}

async function authorConcept(spec: ConceptSpec): Promise<AuthoredConcept> {
  console.log(`\n=== Authoring: ${spec.concept_id} (${spec.name}) ===`)

  const tiers: Tier[] = ['novice', 'on_pace', 'advanced']

  // --- 1. Explanations: novice gets 2 framings, others get 1 each ---
  const explanations: unknown[] = []
  for (const tier of tiers) {
    const framingCount = tier === 'novice' ? 2 : 1
    for (let i = 0; i < framingCount; i++) {
      const framingHint = spec.framingHints?.[tier]?.[i]
      const p = explanationPrompt({
        conceptId: spec.concept_id,
        conceptName: spec.name,
        tier,
        framingIndex: i,
        framingHint: framingHint,
        prerequisites: spec.prerequisites,
      })
      console.log(`  [opus] explanation ${tier} #${i}`)
      explanations.push(parseJson(await callOpus(p), `explanation:${tier}:${i}`))
    }
  }

  // --- 2. Worked examples: 1 per tier ---
  const examples: unknown[] = []
  for (const tier of tiers) {
    const p = examplePrompt({ conceptName: spec.name, tier, exampleIndex: 0 })
    console.log(`  [opus] example ${tier}`)
    examples.push(parseJson(await callOpus(p), `example:${tier}`))
  }

  // --- 3. Misconceptions ---
  console.log(`  [opus] misconceptions x${spec.misconceptionCount ?? 5}`)
  const misconceptions = parseJson<unknown[]>(
    await callOpus(misconceptionsPrompt({
      conceptName: spec.name,
      count: spec.misconceptionCount ?? 5,
    })),
    'misconceptions'
  )

  // --- 4. Checks: 2 per tier ---
  const checks: unknown[] = []
  for (const tier of tiers) {
    const p = checksPrompt({ conceptName: spec.name, tier, count: 2 })
    console.log(`  [opus] checks ${tier}`)
    const arr = parseJson<unknown[]>(await callOpus(p), `checks:${tier}`)
    checks.push(...arr)
  }

  // --- 5. Deep dives ---
  const deep_dives: unknown[] = []
  for (const angle of spec.deepDiveAngles ?? []) {
    console.log(`  [opus] deep dive: ${angle.slice(0, 50)}...`)
    deep_dives.push(parseJson(
      await callOpus(deepDivePrompt({ conceptName: spec.name, angle })),
      `deep_dive:${angle.slice(0, 30)}`
    ))
  }

  // --- 6. Applications ---
  const applications: unknown[] = []
  for (const ctx of spec.applicationContexts ?? []) {
    console.log(`  [opus] application: ${ctx}`)
    applications.push(parseJson(
      await callOpus(applicationPrompt({ conceptName: spec.name, context: ctx })),
      `application:${ctx}`
    ))
  }

  return {
    concept_id: spec.concept_id,
    name: spec.name,
    track: spec.track,
    one_liner: spec.one_liner,
    prerequisites: spec.prerequisites,
    explanations,
    examples,
    misconceptions,
    checks,
    deep_dives,
    applications,
  }
}

// ---------------------------------------------------------------------------
// Validation against JSON Schema
// ---------------------------------------------------------------------------

function loadSchema(): object {
  const schemaPath = path.resolve(__dirname, '../../content/schema/concept.schema.json')
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
}

function validateOrThrow(concept: AuthoredConcept): void {
  const ajvCtor = (Ajv as unknown as { default?: typeof Ajv }).default ?? Ajv
  const ajv = new ajvCtor({ allErrors: true })
  const validate = ajv.compile(loadSchema())
  const valid = validate(concept)
  if (!valid) {
    const dumpDir = path.resolve(__dirname, '../../content/concepts')
    fs.mkdirSync(dumpDir, { recursive: true })
    const dumpPath = path.join(dumpDir, `_invalid_${concept.concept_id.replace(/[^a-z0-9_-]/gi, '_')}.json`)
    fs.writeFileSync(dumpPath, JSON.stringify({ concept, errors: validate.errors }, null, 2))
    throw new Error(`Schema validation failed. Dump saved to ${dumpPath}`)
  }
}

// ---------------------------------------------------------------------------
// Optional: critique pass
// ---------------------------------------------------------------------------

async function critique(concept: AuthoredConcept): Promise<string> {
  const json = JSON.stringify(concept, null, 2)
  const p: PromptPair = {
    system: `You are a senior AP Calculus teacher reviewing AI-authored
content for accuracy, age-appropriateness, and AP-curriculum alignment.
Be specific. Use bullet points. Cite the exact section name when noting issues.`,
    user: `Review this concept JSON. List any issues found. If no
issues, respond with exactly: "OK".

\`\`\`json
${json}
\`\`\``,
  }
  return await callOpus(p, 4096)
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const conceptId = process.argv[2]
  if (!conceptId) {
    console.error('Usage: npx tsx scripts/authoring/authorConcept.ts <concept_id>')
    console.error('Available specs: ' + Object.keys(CONCEPT_SPECS).join(', '))
    process.exit(1)
  }
  const spec = CONCEPT_SPECS[conceptId]
  if (!spec) {
    console.error(`No spec found for concept_id="${conceptId}"`)
    console.error('Available: ' + Object.keys(CONCEPT_SPECS).join(', '))
    process.exit(1)
  }

  const startedAt = Date.now()
  const concept = await authorConcept(spec)
  validateOrThrow(concept)

  const outDir = path.resolve(__dirname, '../../content/concepts')
  fs.mkdirSync(outDir, { recursive: true })
  const safeId = spec.concept_id.replace(/[^a-z0-9_-]/gi, '_')
  const outPath = path.join(outDir, `${safeId}.json`)
  fs.writeFileSync(outPath, JSON.stringify(concept, null, 2))
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n✓ Wrote ${outPath} (validated, ${elapsed}s)`)

  if (process.env['RUN_CRITIQUE'] === '1') {
    console.log(`\n--- Critique pass ---`)
    const review = await critique(concept)
    console.log(review)
    const critiquePath = path.join(outDir, `_critique_${safeId}.txt`)
    fs.writeFileSync(critiquePath, review)
    console.log(`\nCritique saved to ${critiquePath}`)
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
