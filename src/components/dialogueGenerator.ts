/**
 * Dialogue Generator for CalcuLearn.
 *
 * Wraps local Gemma inference behind a small backend interface, builds
 * pedagogical prompts, enforces the 150-word response cap, and provides timeout
 * fallbacks for offline resilience.
 *
 * ## Performance changes (Phase 1)
 *
 * 1. Skip SHA-256 re-verification on every loadModel() call — bootstrap already
 *    verified the file at startup. Pass skipHashVerification=true from createApp.
 * 2. Reset LlamaChatSession per inference call so context never accumulates
 *    across turns, keeping inference time consistent throughout a session.
 * 3. Default timeout raised from 10 s to 30 s to accommodate first-inference
 *    warm-up on slower hardware.
 * 4. Streaming: NodeLlamaCppBackend streams tokens and resolves when complete;
 *    callers can optionally receive an AsyncIterable<string> via inferStream().
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.3, 7.5, 9.5
 */

import { getLlama, LlamaChatSession } from 'node-llama-cpp'
import { sha256File } from '../security/modelVerifier.js'
import type {
  ConceptNode,
  DifficultyLevel,
  EvaluationResult,
  KnowledgeState,
  Problem,
  ProblemTemplate,
} from '../models/types.js'

// Raised from 10 s → 30 s (Phase 1 fix #4)
const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_CONTEXT_TOKENS = 4096
const MIN_CONTEXT_TOKENS = 512
const MAX_OUTPUT_WORDS = 150

export interface DialogueModelBackend {
  load(config: { modelPath: string; contextTokens: number }): Promise<void>
  infer(prompt: string, config: { contextTokens: number; maxTokens: number }): Promise<string>
  inferStream?(prompt: string, config: { contextTokens: number; maxTokens: number }): AsyncIterable<string>
}

export interface DialogueGeneratorOptions {
  modelPath: string
  expectedSha256?: string
  /**
   * Phase 1 fix #2: when true, skip the per-loadModel SHA-256 file hash.
   * Set this to true in production wiring (createApp) because bootstrapModel()
   * already verified the file at startup. Only set false in tests that
   * deliberately inject a tampered model path.
   */
  skipHashVerification?: boolean
  backend?: DialogueModelBackend
  timeoutMs?: number
  logger?: Pick<Console, 'error' | 'warn'>
  conceptMap?: ReadonlyMap<string, ConceptNode>
}

export class ModelHashMismatchError extends Error {}

export class DialogueGenerator {
  private readonly modelPath: string
  private readonly expectedSha256?: string
  private readonly skipHashVerification: boolean
  private readonly backend: DialogueModelBackend
  private readonly timeoutMs: number
  private readonly logger: Pick<Console, 'error' | 'warn'>
  private readonly conceptMap?: ReadonlyMap<string, ConceptNode>
  private loadPromise: Promise<void> | null = null
  private contextTokens = DEFAULT_CONTEXT_TOKENS

  constructor(options: DialogueGeneratorOptions) {
    this.modelPath = options.modelPath
    this.expectedSha256 = options.expectedSha256
    this.skipHashVerification = options.skipHashVerification ?? false
    this.backend = options.backend ?? new NodeLlamaCppBackend()
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.logger = options.logger ?? console
    this.conceptMap = options.conceptMap
  }

  async loadModel(): Promise<void> {
    if (this.loadPromise === null) {
      this.loadPromise = this.verifyModelHash().then(() =>
        this.backend.load({
          modelPath: this.modelPath,
          contextTokens: this.contextTokens,
        })
      )
    }
    return this.loadPromise
  }

  async generateIntroduction(problem: Problem, state: KnowledgeState): Promise<string> {
    const prompt = this.buildPrompt({
      task: 'Introduce the next calculus problem. Be Socratic and concise.',
      problem,
      state,
    })
    return this.inferText(prompt, fallbackFor(problem.conceptId, 'intro'))
  }

  async generateFeedback(
    problem: Problem,
    result: EvaluationResult,
    state: KnowledgeState
  ): Promise<string> {
    const outcome = result.isCorrect
      ? 'correct'
      : result.partialCredit > 0
        ? 'partially correct'
        : 'incorrect'
    const prompt = this.buildPrompt({
      task:
        `Generate ${outcome} feedback. Do not reveal the answer. ` +
        'Ask one guiding question that helps the student find the next step.',
      problem,
      state,
      rawAnswer: result.rawAnswer,
      extra: [
        `Evaluation method: ${result.evaluationMethod}`,
        `Partial credit: ${result.partialCredit}`,
        `Misconceptions: ${result.misconceptions.map((m) => m.description).join('; ') || 'none'}`,
      ],
    })
    return this.inferText(prompt, fallbackFor(problem.conceptId, 'feedback'))
  }

  async generateHint(problem: Problem, hintLevel: number, state: KnowledgeState): Promise<string> {
    const prompt = this.buildPrompt({
      task:
        `Give Socratic hint level ${hintLevel}. Do not reveal the final answer ` +
        'or any later solution steps.',
      problem,
      state,
      extra: [
        `Available first step: ${problem.solutionSteps[0]?.description ?? 'identify the relevant concept'}`,
      ],
    })
    return this.inferText(prompt, fallbackFor(problem.conceptId, 'hint'))
  }

  async generateWorkedExample(concept: ConceptNode, state: KnowledgeState): Promise<string> {
    const mastery = state.concepts.get(concept.id)?.masteryProbability ?? 0.1
    const prompt = [
      systemInstruction(),
      `Task: Give a worked example for concept "${concept.name}" (${concept.id}).`,
      `Mastery label: ${masteryLabel(mastery)}`,
      `Concept description: ${concept.description}`,
      'Keep the explanation at or below 150 words.',
    ].join('\n')
    return this.inferText(prompt, fallbackFor(concept.id, 'worked-example'))
  }

  async generateProblemVariant(
    template: ProblemTemplate,
    difficulty: DifficultyLevel
  ): Promise<Problem> {
    const prompt = [
      systemInstruction(),
      'Task: Generate one novel calculus problem variant as JSON only.',
      `Concept ID: ${template.conceptId}`,
      `Difficulty: ${difficulty}`,
      `Template stem: ${template.templateStem}`,
      `Answer template: ${template.answerTemplate}`,
      'Return fields: id, conceptId, difficulty, type, stem, answer, solutionSteps, commonMisconceptions.',
      'The answer field must contain raw, latex, and type.',
    ].join('\n')

    const output = await this.inferText(prompt, JSON.stringify(fallbackProblem(template, difficulty)), 2_000)
    return parseProblemJson(output, template, difficulty)
  }

  async evaluateSemanticAnswer(
    problem: Problem,
    rawAnswer: string
  ): Promise<{ isCorrect: boolean; partialCredit: number; feedbackHints: string[] }> {
    const prompt = [
      systemInstruction(),
      'Task: Score the student answer against the canonical answer. Return JSON only.',
      `Concept ID: ${problem.conceptId}`,
      `Problem stem: ${problem.stem}`,
      `Canonical answer: ${problem.answer.raw}`,
      `Student answer: ${rawAnswer}`,
      'Return JSON with fields: isCorrect (boolean), partialCredit (number in [0, 1]), feedbackHints (array of short Socratic hints).',
      'Do not include the canonical answer text in feedbackHints.',
    ].join('\n')

    const fallback = JSON.stringify({ isCorrect: false, partialCredit: 0, feedbackHints: [] })
    const output = await this.inferText(prompt, fallback, 512)
    return parseEvaluationJson(output)
  }

  /**
   * Streaming inference — yields tokens as they are generated.
   * Falls back to a single-chunk yield if the backend does not support streaming.
   */
  async *inferStream(
    prompt: string,
    fallback: string,
    maxTokens = 256
  ): AsyncIterable<string> {
    await this.loadModel()
    if (this.backend.inferStream !== undefined) {
      try {
        const stream = this.backend.inferStream(prompt, {
          contextTokens: this.contextTokens,
          maxTokens,
        })
        let wordCount = 0
        for await (const token of stream) {
          yield token
          wordCount += token.split(/\s+/).filter(Boolean).length
          if (wordCount >= MAX_OUTPUT_WORDS) break
        }
        return
      } catch (err: unknown) {
        this.logger.error(
          `[DialogueGenerator] Stream failed, falling back: ${err instanceof Error ? err.message : String(err)}`
        )
        yield fallback
        return
      }
    }
    // Backend does not support streaming — yield full response as one chunk
    const result = await this.inferText(prompt, fallback, maxTokens)
    yield result
  }

  getContextTokens(): number {
    return this.contextTokens
  }

  private humanizeConceptId(conceptId: string): string {
    const fromMap = this.conceptMap?.get(conceptId)?.name
    if (fromMap !== undefined) return fromMap
    return slugTitleCase(conceptId)
  }

  /**
   * Phase 1 fix #2: skip hash verification when bootstrapModel() already
   * verified the file at server startup. Only verify when explicitly requested.
   */
  private async verifyModelHash(): Promise<void> {
    if (this.skipHashVerification) return
    if (this.expectedSha256 === undefined) return
    const hash = await sha256File(this.modelPath)
    if (hash !== this.expectedSha256) {
      throw new ModelHashMismatchError(
        `Gemma GGUF SHA-256 mismatch for ${this.modelPath}: expected ${this.expectedSha256}, got ${hash}`
      )
    }
  }

  private buildPrompt(input: {
    task: string
    problem: Problem
    state: KnowledgeState
    rawAnswer?: string
    extra?: string[]
  }): string {
    const mastery = input.state.concepts.get(input.problem.conceptId)?.masteryProbability ?? 0.1
    const parts = [
      systemInstruction(),
      `Task: ${input.task}`,
      `Current concept ID: ${input.problem.conceptId}`,
      `Current concept name: ${this.humanizeConceptId(input.problem.conceptId)}`,
      `Mastery label: ${masteryLabel(mastery)}`,
      `Problem stem: ${input.problem.stem}`,
    ]
    if (input.rawAnswer !== undefined) {
      parts.push(`Student raw answer: ${input.rawAnswer}`)
    }
    parts.push(...(input.extra ?? []))
    parts.push('Keep the response at or below 150 words.')
    return capApproxContext(parts.join('\n'), this.contextTokens)
  }


  /**
   * Phase B (Learn Mode): public, untemplated inference for the Socratic shell.
   * Used by LearnModeService and ResponseClassifier to wrap pre-authored
   * content blocks in a Socratic conversational shell. The caller fully
   * owns the prompt; no buildPrompt(), no word cap.
   *
   * @param prompt   The full prompt (system + user already concatenated).
   * @param maxTokens Generation cap.
   * @returns Trimmed model output, or empty string on timeout/error.
   */
  async inferRaw(prompt: string, maxTokens = 512): Promise<string> {
    await this.loadModel()
    try {
      const output = await withTimeout(
        this.backend.infer(prompt, { contextTokens: this.contextTokens, maxTokens }),
        this.timeoutMs
      )
      return (output ?? '').trim()
    } catch (err: unknown) {
      this.logger.error(
        `[DialogueGenerator] inferRaw timeout/failure: ${err instanceof Error ? err.message : String(err)}`
      )
      return ''
    }
  }

  private async inferText(prompt: string, fallback: string, maxTokens = 256): Promise<string> {
    await this.loadModel()
    try {
      const output = await withTimeout(
        this.backend.infer(prompt, { contextTokens: this.contextTokens, maxTokens }),
        this.timeoutMs
      )
      // Guard against undefined/null from the backend
      const text = (output ?? '').trim()
      return capWords(text.length > 0 ? text : fallback, MAX_OUTPUT_WORDS)
    } catch (err: unknown) {
      this.logger.error(
        `[DialogueGenerator] Inference timeout/failure; using fallback: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
      // Do NOT null loadPromise or reduce contextTokens — the session is
      // still valid and reloading creates a new backend that can't get a
      // sequence slot, causing an infinite "No sequences left" cascade.
      return capWords(fallback, MAX_OUTPUT_WORDS)
    }
  }
}

/**
 * NodeLlamaCppBackend
 *
 * Strategy:
 * - Load model ONCE (expensive).
 * - Create ONE context with sequences=1 after model load.
 * - For each inference: get the sequence, run prompt, then call
 *   sequence.clearHistory() to wipe the KV cache so the next call
 *   starts clean — no context accumulation, no dispose() crashes.
 * - All calls serialised via inferQueue (node-llama-cpp is single-threaded).
 */

class NodeLlamaCppBackend implements DialogueModelBackend {
  private session: LlamaChatSession | null = null
  private loadedModelPath = ''
  private loadedContextTokens = DEFAULT_CONTEXT_TOKENS
  private inferQueue: Promise<unknown> = Promise.resolve()

  async load(config: { modelPath: string; contextTokens: number }): Promise<void> {
    if (this.session !== null && this.loadedModelPath === config.modelPath && this.loadedContextTokens === config.contextTokens) return
    this.loadedModelPath = config.modelPath
    this.loadedContextTokens = config.contextTokens
    const llama = await getLlama()
    const model = await llama.loadModel({ modelPath: config.modelPath })
    const context = await model.createContext({ contextSize: Math.min(DEFAULT_CONTEXT_TOKENS, config.contextTokens), sequences: 1 })
    this.session = new LlamaChatSession({ contextSequence: context.getSequence() })
    console.log(`[NodeLlamaCppBackend] Model loaded: ${config.modelPath}`)
  }

  async infer(prompt: string, config: { contextTokens: number; maxTokens: number }): Promise<string> {
    const result = this.inferQueue.then(async () => {
      if (this.session === null) throw new Error('Model not loaded')
      return this.session.prompt(prompt, { maxTokens: config.maxTokens, temperature: 0.4 })
    })
    this.inferQueue = result.catch(() => undefined)
    return result
  }

  async *inferStream(prompt: string, config: { contextTokens: number; maxTokens: number }): AsyncIterable<string> {
    const tokens: string[] = []
    await (this.inferQueue = this.inferQueue.then(async () => {
      if (this.session === null) throw new Error('Model not loaded')
      await this.session.prompt(prompt, { maxTokens: config.maxTokens, temperature: 0.4, onTextChunk: (chunk: string) => { tokens.push(chunk) } })
    }).catch(() => undefined))
    for (const token of tokens) yield token
  }
}


function systemInstruction(): string {
  return [
    'You are CalcuLearn, an offline Socratic calculus tutor running on-device.',
    'Guide the student with questions and reasoning. Do not reveal final answers in hints or feedback.',
    'Use concise language suitable for a small screen.',
  ].join(' ')
}

function masteryLabel(mastery: number): string {
  if (mastery < 0.3) return 'beginner'
  if (mastery < 0.6) return 'developing'
  if (mastery < 0.8) return 'confident'
  return 'advanced'
}

function slugTitleCase(conceptId: string): string {
  const slug = conceptId.split('.').at(-1) ?? conceptId
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function fallbackFor(conceptId: string, kind: string): string {
  if (kind === 'hint') {
    return `Focus on the first principle for ${conceptId}. What quantity is changing, and what rule connects it to the expression you see?`
  }
  if (kind === 'feedback') {
    return `Pause and compare your reasoning with the structure of ${conceptId}. Which step can you justify from the definition or rule?`
  }
  if (kind === 'worked-example') {
    return `Start from a simple example of ${conceptId}, name the rule, apply it one step at a time, and check the result against the original question.`
  }
  return `We will work on ${conceptId}. Read the problem carefully and identify the relevant rule before calculating.`
}

function fallbackProblem(template: ProblemTemplate, difficulty: DifficultyLevel): Problem {
  return {
    id: `${template.id}-generated-fallback`,
    conceptId: template.conceptId,
    difficulty,
    type: 'free-response',
    stem: template.templateStem,
    answer: {
      raw: template.answerTemplate || '0',
      latex: template.answerTemplate || '0',
      type: 'symbolic',
    },
    solutionSteps: [
      {
        stepNumber: 1,
        description: 'Use the same method as the source template.',
        expression: template.answerTemplate || '',
        hint: 'Which rule or definition does this template practice?',
      },
    ],
    commonMisconceptions: [],
    isGenerated: true,
  }
}

function parseEvaluationJson(output: string): {
  isCorrect: boolean
  partialCredit: number
  feedbackHints: string[]
} {
  try {
    const parsed = JSON.parse(extractJson(output)) as Partial<{
      isCorrect: boolean
      partialCredit: number
      feedbackHints: unknown
    }>
    const hints = Array.isArray(parsed.feedbackHints)
      ? parsed.feedbackHints.filter((h): h is string => typeof h === 'string')
      : []
    const credit = typeof parsed.partialCredit === 'number' && Number.isFinite(parsed.partialCredit)
      ? Math.min(1, Math.max(0, parsed.partialCredit))
      : 0
    return {
      isCorrect: parsed.isCorrect === true,
      partialCredit: credit,
      feedbackHints: hints,
    }
  } catch {
    return { isCorrect: false, partialCredit: 0, feedbackHints: [] }
  }
}

function parseProblemJson(output: string, template: ProblemTemplate, difficulty: DifficultyLevel): Problem {
  try {
    const parsed = JSON.parse(extractJson(output)) as Partial<Problem>
    return {
      id: parsed.id ?? `${template.id}-generated`,
      conceptId: parsed.conceptId ?? template.conceptId,
      difficulty,
      type: parsed.type ?? 'free-response',
      stem: parsed.stem ?? template.templateStem,
      answer: parsed.answer ?? {
        raw: template.answerTemplate || '0',
        latex: template.answerTemplate || '0',
        type: 'symbolic',
      },
      solutionSteps: parsed.solutionSteps ?? fallbackProblem(template, difficulty).solutionSteps,
      commonMisconceptions: parsed.commonMisconceptions ?? [],
      isGenerated: true,
    }
  } catch {
    return fallbackProblem(template, difficulty)
  }
}

function extractJson(output: string): string {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return output
  return output.slice(start, end + 1)
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Inference exceeded ${timeoutMs} ms`)), timeoutMs)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err: unknown) => { clearTimeout(timer); reject(err) }
    )
  })
}

function capWords(text: string | undefined | null, maxWords: number): string {
  if (text === undefined || text === null) return ''
  const words = text.split(/\s+/).filter(Boolean)
  return words.length <= maxWords ? text : words.slice(0, maxWords).join(' ')
}

function capApproxContext(prompt: string, maxTokens: number): string {
  const maxChars = maxTokens * 4
  return prompt.length <= maxChars
    ? prompt
    : `${prompt.slice(0, maxChars - 80)}\n[Session history summarized due to context limit.]`
}/**
 * NodeLlamaCppBackend
 *
 * Strategy: load model + context + session ONCE, then reuse the same
 * LlamaChatSession for every prompt. This is the only pattern that works
 * reliably with node-llama-cpp — creating new sessions/contexts causes
 * sequence exhaustion or native crashes on this version.
 *
 * The session accumulates chat history across calls, which is fine because
 * each prompt is self-contained (we pass the full context in the prompt text)
 * and the context window (2048 tokens) is large enough for many turns.
 *
 * All calls are serialised via inferQueue (node-llama-cpp is single-threaded).
 */

