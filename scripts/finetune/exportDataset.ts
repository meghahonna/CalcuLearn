/**
 * Finetuning dataset exporter for CalcuLearn (Phase 1 of FINETUNING_PLAN.md).
 *
 * Converts existing authored content into instruction/response pairs whose
 * prompts EXACTLY match the runtime prompt formats in:
 *   - src/components/dialogueGenerator.ts  (intro, feedback, hint,
 *     worked-example, problem-variant JSON, semantic-eval JSON)
 *   - src/components/responseClassifier.ts (tier-6 SLM label classifier)
 *
 * Sources:
 *   - content/concepts/*.json  (explanations, examples, misconceptions with
 *     gold socratic_response_md, checks)
 *   - src/data/problems.ts     (99 problems with step solutions + hints)
 *   - src/data/concepts.ts     (concept names/descriptions)
 *
 * Output (mlx-lm chat format, one {"messages": [...]} per line):
 *   data/finetune/train.jsonl
 *   data/finetune/valid.jsonl   (random ~8% of non-held-out records)
 *   data/finetune/test.jsonl    (ALL records from held-out concepts —
 *                                tests generalization to unseen concepts)
 *   data/finetune/stats.json
 *
 * Run: npx tsx scripts/finetune/exportDataset.ts
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROBLEMS } from '../../src/data/problems.js'
import { CONCEPT_MAP } from '../../src/data/concepts.js'
import type { Problem } from '../../src/models/types.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT_DIR = join(ROOT, 'data', 'finetune')
const CONTENT_DIR = join(ROOT, 'content', 'concepts')

/** Concepts fully held out for the test set (never seen in training). */
const HELDOUT_CONCEPTS = new Set(['deriv.quotient-rule', 'integ.by-parts'])
const VALID_FRACTION = 0.08
const SEED = 20260707

// ---------------------------------------------------------------------------
// Runtime prompt reproduction (keep in sync with dialogueGenerator.ts)
// ---------------------------------------------------------------------------

function systemInstruction(): string {
  return [
    'You are CalcuLearn, an offline Socratic calculus tutor running on-device.',
    'Guide the student with questions and reasoning. Do not reveal final answers in hints or feedback.',
    'Use concise language suitable for a small screen.',
  ].join(' ')
}

const MASTERY_LABELS = ['beginner', 'developing', 'confident', 'advanced'] as const
type MasteryLabel = (typeof MASTERY_LABELS)[number]

function conceptName(conceptId: string): string {
  const fromMap = CONCEPT_MAP.get(conceptId)?.name
  if (fromMap !== undefined) return fromMap
  const slug = conceptId.split('.').at(-1) ?? conceptId
  return slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

/** Mirrors DialogueGenerator.buildPrompt(). */
function buildPrompt(input: {
  task: string
  conceptId: string
  stem: string
  mastery: MasteryLabel
  rawAnswer?: string
  extra?: string[]
}): string {
  const parts = [
    systemInstruction(),
    `Task: ${input.task}`,
    `Current concept ID: ${input.conceptId}`,
    `Current concept name: ${conceptName(input.conceptId)}`,
    `Mastery label: ${input.mastery}`,
    `Problem stem: ${input.stem}`,
  ]
  if (input.rawAnswer !== undefined) parts.push(`Student raw answer: ${input.rawAnswer}`)
  parts.push(...(input.extra ?? []))
  parts.push('Keep the response at or below 150 words.')
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function capWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  return words.length <= maxWords ? text.trim() : words.slice(0, maxWords).join(' ')
}

/** Strip markdown emphasis/headers, keep LaTeX, collapse whitespace. */
function mdToPlain(md: string): string {
  return md
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pull the last inline-math snippet out of a misconception description, e.g.
 *  "they write $\frac{d}{dx}[x^5] = 5x^5$" → "5x^5" (RHS if an equation). */
function extractWrongAnswer(descriptionMd: string): string | null {
  const snippets = [...descriptionMd.matchAll(/\$([^$]+)\$/g)].map((m) => m[1])
  if (snippets.length === 0) return null
  const last = snippets[snippets.length - 1]
  const eq = last.split(/=(?![^{]*\})/)
  return (eq.length > 1 ? eq[eq.length - 1] : last).trim()
}

interface Record_ {
  task: string
  conceptId: string
  prompt: string
  completion: string
}

const records: Record_[] = []
let masteryCounter = 0
function nextMastery(): MasteryLabel {
  return MASTERY_LABELS[masteryCounter++ % 3] // beginner/developing/confident
}

// ---------------------------------------------------------------------------
// Load concept content files
// ---------------------------------------------------------------------------

interface ConceptContent {
  concept_id: string
  name: string
  one_liner: string
  explanations: Array<{ tier: string; body_md: string; intuition_md: string }>
  examples: Array<{ tier: string; problem_md: string; steps: Array<{ step_md: string; why_md: string }> }>
  misconceptions: Array<{ short_name: string; description_md: string; why_wrong_md: string; socratic_response_md: string }>
  checks: Array<{ tier: string; question_md: string; expected_answer_md: string; expected_pattern: string }>
  applications?: Array<{ context: string; problem_md: string }>
}

const conceptContents: ConceptContent[] = readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(CONTENT_DIR, f), 'utf8')) as ConceptContent)

// ---------------------------------------------------------------------------
// 1. Hints — from problem solution steps (generateHint format)
// ---------------------------------------------------------------------------

for (const problem of PROBLEMS) {
  const firstStep = problem.solutionSteps[0]?.description ?? 'identify the relevant concept'
  const levels = Math.min(3, problem.solutionSteps.length)
  for (let level = 1; level <= levels; level++) {
    const hint = problem.solutionSteps[level - 1]?.hint
    if (!hint) continue
    records.push({
      task: 'hint',
      conceptId: problem.conceptId,
      prompt: buildPrompt({
        task: `Give Socratic hint level ${level}. Do not reveal the final answer or any later solution steps.`,
        conceptId: problem.conceptId,
        stem: problem.stem,
        mastery: nextMastery(),
        extra: [`Available first step: ${firstStep}`],
      }),
      completion: hint,
    })
  }
}

// ---------------------------------------------------------------------------
// 2. Feedback — misconception cases use GOLD socratic_response_md from
//    concept files; correct/incorrect cases composed from problem bank
//    (generateFeedback format)
// ---------------------------------------------------------------------------

for (const content of conceptContents) {
  for (const misc of content.misconceptions) {
    const wrongAnswer = extractWrongAnswer(misc.description_md)
    // Pair with a same-concept check question as the problem stem.
    const check = content.checks[0]
    if (!check || !wrongAnswer) continue
    records.push({
      task: 'feedback',
      conceptId: content.concept_id,
      prompt: buildPrompt({
        task: 'Generate incorrect feedback. Do not reveal the answer. Ask one guiding question that helps the student find the next step.',
        conceptId: content.concept_id,
        stem: mdToPlain(misc.description_md.split('.')[0] + '.'), // scenario as stem context
        mastery: nextMastery(),
        rawAnswer: wrongAnswer,
        extra: [
          'Evaluation method: llm-semantic',
          'Partial credit: 0',
          `Misconceptions: ${mdToPlain(misc.why_wrong_md)}`,
        ],
      }),
      completion: capWords(mdToPlain(misc.socratic_response_md), 150),
    })
  }
}

// Correct-answer feedback from the problem bank (composed, template-varied)
const praisePool = [
  'Well reasoned.',
  'That checks out.',
  'Good — your steps hold up.',
  'Correct.',
]
for (const [i, problem] of PROBLEMS.entries()) {
  const lastStep = problem.solutionSteps.at(-1)
  if (!lastStep) continue
  records.push({
    task: 'feedback',
    conceptId: problem.conceptId,
    prompt: buildPrompt({
      task: 'Generate correct feedback. Do not reveal the answer. Ask one guiding question that helps the student find the next step.',
      conceptId: problem.conceptId,
      stem: problem.stem,
      mastery: nextMastery(),
      rawAnswer: problem.answer.raw,
      extra: ['Evaluation method: symbolic', 'Partial credit: 1', 'Misconceptions: none'],
    }),
    completion: `${praisePool[i % praisePool.length]} ${lastStep.hint} How would you convince a classmate your answer is right?`,
  })
}

// Incorrect-answer feedback from problem-bank misconceptions (composed)
for (const problem of PROBLEMS) {
  for (const misc of problem.commonMisconceptions) {
    const guidingHint = problem.solutionSteps[0]?.hint ?? 'Which rule or definition applies here?'
    records.push({
      task: 'feedback',
      conceptId: problem.conceptId,
      prompt: buildPrompt({
        task: 'Generate incorrect feedback. Do not reveal the answer. Ask one guiding question that helps the student find the next step.',
        conceptId: problem.conceptId,
        stem: problem.stem,
        mastery: nextMastery(),
        rawAnswer: misc.incorrectPattern,
        extra: [
          'Evaluation method: symbolic',
          'Partial credit: 0',
          `Misconceptions: ${misc.description}`,
        ],
      }),
      completion: `Not quite — take another look. ${misc.description} is a common trap here. ${guidingHint}`,
    })
  }
}

// ---------------------------------------------------------------------------
// 3. Worked examples — from concept example steps (generateWorkedExample format)
// ---------------------------------------------------------------------------

const TIER_TO_MASTERY: Record<string, MasteryLabel> = {
  novice: 'beginner',
  on_pace: 'developing',
  advanced: 'advanced',
}

for (const content of conceptContents) {
  const node = CONCEPT_MAP.get(content.concept_id)
  if (!node) continue
  for (const example of content.examples) {
    let body = `Example: ${mdToPlain(example.problem_md)}`
    for (const step of example.steps) {
      const candidate = `${body} ${mdToPlain(step.step_md)}`
      if (candidate.split(/\s+/).length > 150) break
      body = candidate
    }
    records.push({
      task: 'worked-example',
      conceptId: content.concept_id,
      prompt: [
        systemInstruction(),
        `Task: Give a worked example for concept "${node.name}" (${node.id}).`,
        `Mastery label: ${TIER_TO_MASTERY[example.tier] ?? 'developing'}`,
        `Concept description: ${node.description}`,
        'Keep the explanation at or below 150 words.',
      ].join('\n'),
      completion: capWords(body, 150),
    })
  }
}

// ---------------------------------------------------------------------------
// 4. Semantic answer evaluation — JSON output (evaluateSemanticAnswer format)
// ---------------------------------------------------------------------------

function semanticEvalPrompt(conceptId: string, stem: string, canonical: string, student: string): string {
  return [
    systemInstruction(),
    'Task: Score the student answer against the canonical answer. Return JSON only.',
    `Concept ID: ${conceptId}`,
    `Problem stem: ${stem}`,
    `Canonical answer: ${canonical}`,
    `Student answer: ${student}`,
    'Return JSON with fields: isCorrect (boolean), partialCredit (number in [0, 1]), feedbackHints (array of short Socratic hints).',
    'Do not include the canonical answer text in feedbackHints.',
  ].join('\n')
}

const offTopicAnswers = ['idk', 'no idea', 'can you just tell me', '42?', 'this is too hard']
for (const [i, problem] of PROBLEMS.entries()) {
  // correct
  records.push({
    task: 'semantic-eval',
    conceptId: problem.conceptId,
    prompt: semanticEvalPrompt(problem.conceptId, problem.stem, problem.answer.raw, problem.answer.raw),
    completion: JSON.stringify({ isCorrect: true, partialCredit: 1, feedbackHints: [] }),
  })
  // misconception-driven wrong answer
  for (const misc of problem.commonMisconceptions) {
    const hint = problem.solutionSteps[0]?.hint ?? 'Which rule applies here?'
    records.push({
      task: 'semantic-eval',
      conceptId: problem.conceptId,
      prompt: semanticEvalPrompt(problem.conceptId, problem.stem, problem.answer.raw, misc.incorrectPattern),
      completion: JSON.stringify({ isCorrect: false, partialCredit: 0.25, feedbackHints: [hint] }),
    })
  }
  // non-answer
  const hint = problem.solutionSteps[0]?.hint ?? 'Which rule applies here?'
  records.push({
    task: 'semantic-eval',
    conceptId: problem.conceptId,
    prompt: semanticEvalPrompt(problem.conceptId, problem.stem, problem.answer.raw, offTopicAnswers[i % offTopicAnswers.length]),
    completion: JSON.stringify({ isCorrect: false, partialCredit: 0, feedbackHints: [hint] }),
  })
}

// ---------------------------------------------------------------------------
// 5. Problem variant generation — JSON output (generateProblemVariant format)
//    Pairs problems within the same concept × difficulty: one acts as the
//    template, the other as the target variant.
// ---------------------------------------------------------------------------

function problemToVariantJson(pr: Problem): string {
  return JSON.stringify({
    id: pr.id,
    conceptId: pr.conceptId,
    difficulty: pr.difficulty,
    type: pr.type,
    stem: pr.stem,
    answer: { raw: pr.answer.raw, latex: pr.answer.latex, type: pr.answer.type },
    solutionSteps: pr.solutionSteps,
    commonMisconceptions: pr.commonMisconceptions,
  })
}

const byGroup = new Map<string, Problem[]>()
for (const pr of PROBLEMS) {
  const key = `${pr.conceptId}|${pr.difficulty}`
  byGroup.set(key, [...(byGroup.get(key) ?? []), pr])
}
for (const group of byGroup.values()) {
  if (group.length < 2) continue
  for (let i = 0; i < group.length; i++) {
    const template = group[i]
    const target = group[(i + 1) % group.length]
    records.push({
      task: 'problem-variant',
      conceptId: template.conceptId,
      prompt: [
        systemInstruction(),
        'Task: Generate one novel calculus problem variant as JSON only.',
        `Concept ID: ${template.conceptId}`,
        `Difficulty: ${template.difficulty}`,
        `Template stem: ${template.stem}`,
        `Answer template: ${template.answer.raw}`,
        'Return fields: id, conceptId, difficulty, type, stem, answer, solutionSteps, commonMisconceptions.',
        'The answer field must contain raw, latex, and type.',
      ].join('\n'),
      completion: problemToVariantJson(target),
    })
  }
}

// ---------------------------------------------------------------------------
// 6. Response classifier — single-label output (responseClassifier.ts format)
// ---------------------------------------------------------------------------

function classifierPrompt(args: {
  question: string
  expected: string
  student: string
  misconceptions: Array<{ short_name: string; description_md: string }>
}): string {
  const miscList = args.misconceptions
    .map((m, i) => `  ${i + 1}. id=${i + 1} name="${m.short_name}" — ${m.description_md.slice(0, 180)}`)
    .join('\n')
  return `You are a strict classifier. Classify the student's response into ONE label.

QUESTION: ${args.question}
EXPECTED ANSWER: ${args.expected}

STUDENT RESPONSE: "${args.student}"

Possible misconceptions for this concept:
${miscList || '(none)'}

Choose ONE label from this list:
  correct           - the response matches the expected answer
  partial_correct   - on the right track but incomplete or has a small error
  misconception:N   - the response shows misconception with id=N from the list above
  off_topic         - response is unrelated to the question

Respond with ONLY the label word (e.g. "correct" or "misconception:7"). No prose, no punctuation.`
}

const classifierRng = mulberry32(0xc1a551f)
function shuffledIndices(n: number, rng: () => number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
}

const offTopicInputs = [
  "what's for lunch today",
  'can we play a game instead',
  'who won the football game last night',
  'my favorite color is blue',
  'how old are you',
]

for (const content of conceptContents) {
  for (const [ci, check] of content.checks.entries()) {
    const question = mdToPlain(check.question_md)
    const expected = mdToPlain(check.expected_answer_md)
    const miscs = content.misconceptions
    // correct
    records.push({
      task: 'classifier',
      conceptId: content.concept_id,
      prompt: classifierPrompt({ question, expected, student: expected, misconceptions: miscs }),
      completion: 'correct',
    })
    // partial: first half of the expected answer
    const words = expected.split(/\s+/)
    if (words.length >= 6) {
      records.push({
        task: 'classifier',
        conceptId: content.concept_id,
        prompt: classifierPrompt({ question, expected, student: words.slice(0, Math.ceil(words.length / 2)).join(' '), misconceptions: miscs }),
        completion: 'partial_correct',
      })
    }
    // misconception:N — one example per misconception, with the list order
    // shuffled per example so the model must READ the list rather than
    // memorize positions (v0 eval showed collapse to "misconception:1").
    for (let mi = 0; mi < miscs.length; mi++) {
      const wrong = extractWrongAnswer(miscs[mi].description_md)
      if (!wrong) continue
      const order = shuffledIndices(miscs.length, classifierRng)
      const shuffled = order.map((idx) => miscs[idx])
      const label = order.indexOf(mi) + 1
      records.push({
        task: 'classifier',
        conceptId: content.concept_id,
        prompt: classifierPrompt({ question, expected, student: wrong, misconceptions: shuffled }),
        completion: `misconception:${label}`,
      })
    }
    // off_topic
    records.push({
      task: 'classifier',
      conceptId: content.concept_id,
      prompt: classifierPrompt({ question, expected, student: offTopicInputs[ci % offTopicInputs.length], misconceptions: miscs }),
      completion: 'off_topic',
    })
  }
}

// ---------------------------------------------------------------------------
// 7. Introductions — composed from concept one-liners (generateIntroduction format)
// ---------------------------------------------------------------------------

const introTemplates = [
  (name: string, oneLiner: string, hint: string) =>
    `Let's look at ${name}: ${oneLiner} Read the problem above carefully. ${hint}`,
  (name: string, _o: string, hint: string) =>
    `Time to practice ${name}. Before you compute anything: ${hint}`,
  (name: string, oneLiner: string, hint: string) =>
    `Here's a ${name} problem. Remember: ${oneLiner} ${hint}`,
]

for (const [i, problem] of PROBLEMS.entries()) {
  const content = conceptContents.find((c) => c.concept_id === problem.conceptId)
  const hint = problem.solutionSteps[0]?.hint ?? 'What is the problem really asking?'
  const oneLiner = content?.one_liner ?? CONCEPT_MAP.get(problem.conceptId)?.description ?? ''
  records.push({
    task: 'intro',
    conceptId: problem.conceptId,
    prompt: buildPrompt({
      task: 'Introduce the next calculus problem. Be Socratic and concise.',
      conceptId: problem.conceptId,
      stem: problem.stem,
      mastery: nextMastery(),
    }),
    completion: capWords(introTemplates[i % introTemplates.length](conceptName(problem.conceptId), oneLiner, hint), 150),
  })
}

// ---------------------------------------------------------------------------
// Split & write
// ---------------------------------------------------------------------------

const rng = mulberry32(SEED)
const test: Record_[] = []
const valid: Record_[] = []
const train: Record_[] = []

for (const rec of records) {
  if (HELDOUT_CONCEPTS.has(rec.conceptId)) test.push(rec)
  else if (rng() < VALID_FRACTION) valid.push(rec)
  else train.push(rec)
}

// Shuffle train deterministically
for (let i = train.length - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1))
  ;[train[i], train[j]] = [train[j], train[i]]
}

mkdirSync(OUT_DIR, { recursive: true })
const toLine = (r: Record_) =>
  JSON.stringify({ messages: [{ role: 'user', content: r.prompt }, { role: 'assistant', content: r.completion }] })

writeFileSync(join(OUT_DIR, 'train.jsonl'), train.map(toLine).join('\n') + '\n')
writeFileSync(join(OUT_DIR, 'valid.jsonl'), valid.map(toLine).join('\n') + '\n')
// test.jsonl is consumed by our eval harness (not mlx-lm), so it carries
// task/concept metadata alongside the messages.
const toTestLine = (r: Record_) =>
  JSON.stringify({
    task: r.task,
    conceptId: r.conceptId,
    messages: [{ role: 'user', content: r.prompt }, { role: 'assistant', content: r.completion }],
  })
writeFileSync(join(OUT_DIR, 'test.jsonl'), test.map(toTestLine).join('\n') + '\n')

// Solver eval: held-out problems with canonical answers, for direct
// math-accuracy scoring in scripts/finetune/evalBaseModels.py
const solverEval = PROBLEMS.filter((pr) => HELDOUT_CONCEPTS.has(pr.conceptId)).map((pr) => ({
  id: pr.id,
  conceptId: pr.conceptId,
  difficulty: pr.difficulty,
  type: pr.type,
  stem: pr.stem,
  answerRaw: pr.answer.raw,
  answerLatex: pr.answer.latex,
  answerType: pr.answer.type,
}))
writeFileSync(join(OUT_DIR, 'test_problems.json'), JSON.stringify(solverEval, null, 2) + '\n')

// Full problem bank in the same shape — used by evalBaseModels.py
// --solver-file for a higher-signal base-model bake-off (fine before any
// training has happened; becomes contaminated once a model is trained on it).
const allProblems = PROBLEMS.map((pr) => ({
  id: pr.id,
  conceptId: pr.conceptId,
  difficulty: pr.difficulty,
  type: pr.type,
  stem: pr.stem,
  answerRaw: pr.answer.raw,
  answerLatex: pr.answer.latex,
  answerType: pr.answer.type,
}))
writeFileSync(join(OUT_DIR, 'all_problems.json'), JSON.stringify(allProblems, null, 2) + '\n')

const byTask: Record<string, number> = {}
for (const r of records) byTask[r.task] = (byTask[r.task] ?? 0) + 1
const stats = {
  generatedAt: new Date().toISOString(),
  total: records.length,
  splits: { train: train.length, valid: valid.length, test: test.length },
  heldOutConcepts: [...HELDOUT_CONCEPTS],
  byTask,
}
writeFileSync(join(OUT_DIR, 'stats.json'), JSON.stringify(stats, null, 2) + '\n')
console.log(JSON.stringify(stats, null, 2))
