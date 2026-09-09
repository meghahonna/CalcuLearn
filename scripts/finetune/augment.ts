/**
 * Synthetic training-data generator for CalcuLearn (Phase 1b of FINETUNING_PLAN.md).
 *
 * Uses the same Claude gateway as scripts/authoring/ to synthesize additional
 * instruction/response pairs in the EXACT runtime prompt formats of
 * dialogueGenerator.ts / responseClassifier.ts. Seeds every batch with real
 * concept content (misconceptions, gold Socratic responses, sample problems)
 * as style/correctness anchors.
 *
 * Weak-area overweighting (from the Phase 2 bake-off failure analysis):
 * proof-sketch difficulty and ode.first-order-linear get 2x batches.
 *
 * Resumable: each (concept × task × batch) writes its own file under
 * data/finetune/synthetic/; existing files are skipped on re-run.
 *
 * Run:
 *   npx tsx scripts/finetune/augment.ts                    # all concepts, all tasks
 *   npx tsx scripts/finetune/augment.ts --concepts deriv.power-rule
 *   npx tsx scripts/finetune/augment.ts --batches 2 --per-batch 5   # small trial
 *
 * Required env vars (same as scripts/authoring/authorConcept.ts):
 *   ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL (optional), ANTHROPIC_MODEL (optional)
 *
 * NOTE for the open-source release: synthetic data is Claude-generated —
 * review provider terms for training-data usage before redistributing.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROBLEMS } from '../../src/data/problems.js'
import { CONCEPT_MAP } from '../../src/data/concepts.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONTENT_DIR = path.join(ROOT, 'content', 'concepts')
const OUT_DIR = path.join(ROOT, 'data', 'finetune', 'synthetic')

const MODEL = process.env['ANTHROPIC_MODEL'] || 'claude-opus-4-6'
const API_KEY = process.env['ANTHROPIC_API_KEY']
const BASE_URL = process.env['ANTHROPIC_BASE_URL']

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
function flag(name: string, dflt: number): number {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : dflt
}
const conceptFilter = (() => {
  const i = args.indexOf('--concepts')
  return i >= 0 ? new Set(args[i + 1].split(',')) : null
})()
const BATCHES_PER_TASK = flag('batches', 4)
const EXAMPLES_PER_BATCH = flag('per-batch', 10)

/** 2x batches for the weakest areas found in the Phase 2 bake-off. */
const OVERWEIGHT_CONCEPTS = new Set(['ode.first-order-linear', 'ode.separable'])
const OVERWEIGHT_HINT = 'Prefer proof-sketch and multi-step reasoning scenarios over routine computation.'

/** Held out of training by exportDataset.ts — keep synthetic data away from
 * them too so the test set stays honest. */
const HELDOUT_CONCEPTS = new Set(['deriv.quotient-rule', 'integ.by-parts'])

// ---------------------------------------------------------------------------
// Runtime prompt formats — KEEP IN SYNC with dialogueGenerator.ts and
// scripts/finetune/exportDataset.ts
// ---------------------------------------------------------------------------

function systemInstruction(): string {
  return [
    'You are CalcuLearn, an offline Socratic calculus tutor running on-device.',
    'Guide the student with questions and reasoning. Do not reveal final answers in hints or feedback.',
    'Use concise language suitable for a small screen.',
  ].join(' ')
}

interface GenExample {
  stem: string
  masteryLabel: 'beginner' | 'developing' | 'confident' | 'advanced'
  studentAnswer?: string
  misconceptionNote?: string
  hintLevel?: number
  firstStep?: string
  canonicalAnswer?: string
  completion: string
}

function assemblePrompt(task: string, conceptId: string, ex: GenExample): string | null {
  const name = CONCEPT_MAP.get(conceptId)?.name ?? conceptId
  const base = [
    systemInstruction(),
    '', // task line inserted below
    `Current concept ID: ${conceptId}`,
    `Current concept name: ${name}`,
    `Mastery label: ${ex.masteryLabel}`,
    `Problem stem: ${ex.stem}`,
  ]
  const cap = 'Keep the response at or below 150 words.'
  if (task === 'hint') {
    base[1] = `Task: Give Socratic hint level ${ex.hintLevel ?? 1}. Do not reveal the final answer or any later solution steps.`
    return [...base, `Available first step: ${ex.firstStep ?? 'identify the relevant concept'}`, cap].join('\n')
  }
  if (task === 'feedback-incorrect') {
    base[1] = 'Task: Generate incorrect feedback. Do not reveal the answer. Ask one guiding question that helps the student find the next step.'
    if (!ex.studentAnswer) return null
    base.push(`Student raw answer: ${ex.studentAnswer}`)
    return [...base, 'Evaluation method: llm-semantic', 'Partial credit: 0', `Misconceptions: ${ex.misconceptionNote ?? 'none'}`, cap].join('\n')
  }
  if (task === 'intro') {
    base[1] = 'Task: Introduce the next calculus problem. Be Socratic and concise.'
    return [...base, cap].join('\n')
  }
  if (task === 'semantic-eval') {
    if (!ex.studentAnswer || !ex.canonicalAnswer) return null
    return [
      systemInstruction(),
      'Task: Score the student answer against the canonical answer. Return JSON only.',
      `Concept ID: ${conceptId}`,
      `Problem stem: ${ex.stem}`,
      `Canonical answer: ${ex.canonicalAnswer}`,
      `Student answer: ${ex.studentAnswer}`,
      'Return JSON with fields: isCorrect (boolean), partialCredit (number in [0, 1]), feedbackHints (array of short Socratic hints).',
      'Do not include the canonical answer text in feedbackHints.',
    ].join('\n')
  }
  return null
}

const TASKS = ['hint', 'feedback-incorrect', 'intro', 'semantic-eval', 'classifier'] as const
type TaskName = (typeof TASKS)[number]

// ---------------------------------------------------------------------------
// Classifier task (v1.1): the v1 eval showed the model collapses to
// misconception:1/:3 instead of matching the student answer to the right
// list entry. Synthetic examples shuffle the list per example and vary the
// target label so the model must actually read the list.
// ---------------------------------------------------------------------------

const classifierShuffleRng = (() => {
  let a = 0xc1a55e >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
})()

interface ClassifierExample {
  question: string
  expectedAnswer: string
  studentAnswer: string
  /** misconception short_name, or one of: correct | partial_correct | off_topic */
  target: string
}

function assembleClassifierRecord(
  ex: ClassifierExample,
  miscs: Array<{ short_name: string; description_md: string }>
): { prompt: string; completion: string } | null {
  if (!ex.question || !ex.studentAnswer || !ex.target) return null
  // shuffle list order per example
  const order = miscs.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(classifierShuffleRng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const shuffled = order.map((i) => miscs[i])
  let completion: string
  if (['correct', 'partial_correct', 'off_topic'].includes(ex.target)) {
    completion = ex.target
  } else {
    const idx = shuffled.findIndex((m) => m.short_name === ex.target)
    if (idx === -1) return null
    completion = `misconception:${idx + 1}`
  }
  const miscList = shuffled
    .map((m, i) => `  ${i + 1}. id=${i + 1} name="${m.short_name}" — ${m.description_md.slice(0, 180)}`)
    .join('\n')
  const prompt = `You are a strict classifier. Classify the student's response into ONE label.

QUESTION: ${ex.question}
EXPECTED ANSWER: ${ex.expectedAnswer || '(unknown)'}

STUDENT RESPONSE: "${ex.studentAnswer}"

Possible misconceptions for this concept:
${miscList || '(none)'}

Choose ONE label from this list:
  correct           - the response matches the expected answer
  partial_correct   - on the right track but incomplete or has a small error
  misconception:N   - the response shows misconception with id=N from the list above
  off_topic         - response is unrelated to the question

Respond with ONLY the label word (e.g. "correct" or "misconception:7"). No prose, no punctuation.`
  return { prompt, completion }
}

// ---------------------------------------------------------------------------
// Generation prompt for Claude
// ---------------------------------------------------------------------------

interface ConceptContent {
  concept_id: string
  one_liner: string
  misconceptions: Array<{ short_name: string; description_md: string; socratic_response_md: string }>
}

function generationPrompt(task: TaskName, conceptId: string, content: ConceptContent | undefined, n: number, batchIdx: number): { system: string; user: string } {
  const node = CONCEPT_MAP.get(conceptId)
  const sampleProblems = PROBLEMS.filter((p) => p.conceptId === conceptId).slice(0, 3)
  const anchors = (content?.misconceptions ?? [])
    .slice(0, 4)
    .map((m) => `- Misconception "${m.short_name}": ${m.description_md}\n  Gold Socratic response: ${m.socratic_response_md}`)
    .join('\n')

  const taskSpec: Record<TaskName, string> = {
    hint: `Each example: a NEW calculus problem stem for this concept, a hintLevel (1-3), firstStep (plain-language first solution step), and a completion that is a Socratic hint for that level — a question or gentle pointer that does NOT state the final answer or later steps.`,
    'feedback-incorrect': `Each example: a NEW problem stem, a plausible WRONG studentAnswer (rooted in a real misconception for this concept), a short misconceptionNote, and a completion in the style of the gold Socratic responses above: acknowledge what's right, point at the flaw with a question, never state the correct answer.`,
    intro: `Each example: a NEW problem stem and a completion that introduces the problem Socratically in 1-3 sentences: orient the student to the concept and end with one guiding question. No solving. CRITICAL: never answer or partially answer the stem itself — if the stem asks a conceptual question, the intro must only frame why it matters and hand it to the student, not explain the answer.`,
    'semantic-eval': `Each example: a NEW problem stem, canonicalAnswer, a studentAnswer (mix: ~40% correct including alternate-but-equivalent forms, ~40% misconception-driven wrong, ~20% vague/partial), and a completion that is STRICT one-line JSON: {"isCorrect":bool,"partialCredit":0..1,"feedbackHints":["short Socratic hint",...]}. Equivalent forms (e.g. 0.5 vs 1/2, factored vs expanded) must be isCorrect true. feedbackHints empty when correct, and must never contain the canonical answer.`,
    classifier: `Each example: a NEW question for this concept, its expectedAnswer, a realistic studentAnswer, and target. Distribution: ~50% target = a misconception short_name from the list above (studentAnswer must clearly exhibit THAT specific misconception, distinguishable from the others), ~20% "correct" (including equivalent forms), ~15% "partial_correct" (right start, incomplete), ~15% "off_topic". The studentAnswer for misconception cases is the critical part: make each one unambiguously attributable to its target misconception.`,
  }

  return {
    system:
      'You generate training data for a small on-device Socratic calculus tutor. ' +
      'You are an expert AP Calculus teacher. Accuracy is paramount: every mathematical statement must be correct. ' +
      'Return ONLY a JSON array, no markdown fences, no commentary.',
    user: [
      `Concept: ${node?.name} (${conceptId}) — ${node?.description ?? ''}`,
      content?.one_liner ? `One-liner: ${content.one_liner}` : '',
      node?.learningObjectives?.length ? `Objectives: ${node.learningObjectives.join('; ')}` : '',
      anchors ? `Known misconceptions with GOLD tutor responses (match this style):\n${anchors}` : '',
      sampleProblems.length
        ? `Sample problems from the bank (write NEW ones, don't copy):\n${sampleProblems.map((p) => `- [${p.difficulty}] ${p.stem} → ${p.answer.raw}`).join('\n')}`
        : '',
      OVERWEIGHT_CONCEPTS.has(conceptId) || batchIdx >= BATCHES_PER_TASK ? OVERWEIGHT_HINT : '',
      '',
      `Generate ${n} diverse examples for task "${task}". ${taskSpec[task]}`,
      'Vary difficulty across conceptual/procedural/application/proof-sketch and masteryLabel across beginner/developing/confident/advanced.',
      `This is batch ${batchIdx + 1}; make the examples distinct from typical textbook phrasing (batch seed: ${conceptId}-${task}-${batchIdx}).`,
      'Use LaTeX ($...$) for math. Completions must be at or below 150 words.',
      task === 'classifier'
        ? 'Return a JSON array of objects with fields: question, expectedAnswer, studentAnswer, target.'
        : 'Return a JSON array of objects with fields: stem, masteryLabel, completion, and (as applicable) studentAnswer, misconceptionNote, hintLevel, firstStep, canonicalAnswer.',
    ].filter(Boolean).join('\n'),
  }
}

// ---------------------------------------------------------------------------
// Quality gates
// ---------------------------------------------------------------------------

function passesGates(task: TaskName, ex: GenExample): boolean {
  if (!ex.stem || !ex.completion || !ex.masteryLabel) return false
  const words = ex.completion.split(/\s+/).filter(Boolean).length
  if (task === 'semantic-eval') {
    try {
      const j = JSON.parse(ex.completion)
      if (typeof j.isCorrect !== 'boolean' || typeof j.partialCredit !== 'number' || !Array.isArray(j.feedbackHints)) return false
      if (ex.canonicalAnswer && j.feedbackHints.some((h: string) => typeof h === 'string' && h.includes(ex.canonicalAnswer!))) return false
      return true
    } catch { return false }
  }
  if (words === 0 || words > 150) return false
  // answer-leak guard: hint/feedback must not contain a stated canonical answer
  if ((task === 'hint' || task === 'feedback-incorrect') && ex.canonicalAnswer && ex.completion.includes(ex.canonicalAnswer)) return false
  return true
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function extractJsonArray(raw: string): unknown[] {
  let s = raw.trim().replace(/^```(?:json)?/g, '').replace(/```$/g, '').trim()
  const start = s.indexOf('[')
  const end = s.lastIndexOf(']')
  if (start === -1 || end <= start) throw new Error('No JSON array in response')
  return JSON.parse(s.slice(start, end + 1)) as unknown[]
}

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error('ANTHROPIC_API_KEY not set. Aborting.')
    process.exit(1)
  }
  const client = new Anthropic({ apiKey: API_KEY, ...(BASE_URL ? { baseURL: BASE_URL } : {}) })
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const contents = new Map<string, ConceptContent>(
    fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json')).map((f) => {
      const c = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8')) as ConceptContent
      return [c.concept_id, c]
    })
  )

  const conceptIds = [...CONCEPT_MAP.keys()].filter(
    (id) => !HELDOUT_CONCEPTS.has(id) && (conceptFilter === null || conceptFilter.has(id))
  )

  let totalKept = 0
  let totalRejected = 0
  for (const conceptId of conceptIds) {
    const nBatches = OVERWEIGHT_CONCEPTS.has(conceptId) ? BATCHES_PER_TASK * 2 : BATCHES_PER_TASK
    for (const task of TASKS) {
      for (let b = 0; b < nBatches; b++) {
        const outFile = path.join(OUT_DIR, `${conceptId.replace(/\./g, '_')}__${task}__b${b}.jsonl`)
        if (fs.existsSync(outFile)) continue // resumable
        const gp = generationPrompt(task, conceptId, contents.get(conceptId), EXAMPLES_PER_BATCH, b)
        try {
          const resp = await client.messages.create({
            model: MODEL,
            max_tokens: 8192,
            system: gp.system,
            messages: [{ role: 'user', content: gp.user }],
          })
          const block = resp.content[0]
          if (!block || block.type !== 'text') throw new Error('non-text response')
          const examples = extractJsonArray(block.text)
          const lines: string[] = []
          if (task === 'classifier') {
            const miscs = contents.get(conceptId)?.misconceptions ?? []
            if (miscs.length === 0) continue
            for (const raw of examples as ClassifierExample[]) {
              const rec = assembleClassifierRecord(raw, miscs)
              if (rec === null) { totalRejected++; continue }
              lines.push(JSON.stringify({ messages: [{ role: 'user', content: rec.prompt }, { role: 'assistant', content: rec.completion }] }))
              totalKept++
            }
          } else {
            for (const ex of examples as GenExample[]) {
              if (!passesGates(task, ex)) { totalRejected++; continue }
              const prompt = assemblePrompt(task, conceptId, ex)
              if (prompt === null) { totalRejected++; continue }
              lines.push(JSON.stringify({ messages: [{ role: 'user', content: prompt }, { role: 'assistant', content: ex.completion }] }))
              totalKept++
            }
          }
          fs.writeFileSync(outFile, lines.join('\n') + (lines.length ? '\n' : ''))
          console.log(`${conceptId} ${task} b${b}: kept ${lines.length}/${examples.length}`)
        } catch (err) {
          console.error(`${conceptId} ${task} b${b}: FAILED — ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
  }
  console.log(`\nDone. Kept ${totalKept}, rejected ${totalRejected} (quality gates). Output: ${OUT_DIR}`)
  console.log('Next: python scripts/finetune/buildPublicData.py && python scripts/finetune/mixDataset.py')
}

main().catch((e) => { console.error(e); process.exit(1) })
