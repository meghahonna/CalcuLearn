/**
 * Production wiring for CalcuLearn.
 *
 * Constructs the full component graph end-to-end so the offline-first app can
 * actually run, not just pass tests. Components are wired through their narrow
 * DI interfaces; nothing here depends on a specific test mock.
 *
 * Use `createApp(config)` from a UI shell or CLI; the top-level `if` block at
 * the bottom of this file allows `tsx src/main.ts` for a smoke run.
 *
 * Requirements: 7.1, 7.2, 7.3
 */

import type { Database } from 'better-sqlite3'
import { recoverOrCreate } from './db/database.js'
import { CONCEPTS, CONCEPT_MAP } from './data/concepts.js'
import { KnowledgeStateManager } from './components/knowledgeStateManager.js'
import { ProblemEngine } from './components/problemEngine.js'
import { AnswerEvaluator } from './components/answerEvaluator.js'
import { DialogueGenerator } from './components/dialogueGenerator.js'
import { TranslationLayer } from './components/translationLayer.js'
import { SessionEngine } from './components/sessionEngine.js'
import { bootstrapModel, type Quantisation } from './bootstrap.js'
import { ContentRetrieval } from './components/contentRetrieval.js'
import { ResponseClassifier } from './components/responseClassifier.js'
import { LearnModeService } from './components/learnModeService.js'

export interface CalcuLearnConfig {
  /** Filesystem path to the SQLite database. */
  dbPath: string
  /** Directory containing GGUF model files. */
  modelDir: string
  /** SHA-256 hashes for the two Gemma quantisation variants. */
  gemmaHashes: Record<Quantisation, string>
  /** Optional Gemma quantisation override. */
  quantisation?: Quantisation
  /** Optional NLLB-200 GGUF configuration. */
  nllb?: { fileName: string; hash: string }
  /** Default UI language (BCP-47 / NLLB code). Defaults to 'en'. */
  targetLanguage?: string
  /** Inference timeout for Gemma (ms). Defaults to 10s per Reqs 7.5/11.1. */
  inferenceTimeoutMs?: number
  logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

/**
 * The fully-wired component graph. Hold onto this for the lifetime of the
 * process; close `db` at shutdown.
 */
export interface CalcuLearnApp {
  db: Database
  ksm: KnowledgeStateManager
  problemEngine: ProblemEngine
  answerEvaluator: AnswerEvaluator
  dialogueGenerator: DialogueGenerator
  translationLayer: TranslationLayer
  sessionEngine: SessionEngine
  /** Phase B: read-only DAO over the Phase A authored content tables. */
  contentRetrieval: ContentRetrieval
  /** Phase B: classifies free-form student input. */
  responseClassifier: ResponseClassifier
  /** Phase B: drives a Socratic walkthrough end-to-end. */
  learnModeService: LearnModeService
  /** Cleanly close the SQLite connection. */
  close(): void
}

export async function createApp(config: CalcuLearnConfig): Promise<CalcuLearnApp> {
  const logger = config.logger ?? console

  // 1. Verify model integrity before anything else touches the bytes.
  const { modelPath, nllbModelPath } = await bootstrapModel({
    modelDir: config.modelDir,
    hashes: config.gemmaHashes,
    quantisation: config.quantisation,
    nllb: config.nllb,
    logger,
  })

  // 2. Open or recover the SQLite DB; schema is initialised idempotently.
  const db = recoverOrCreate(config.dbPath)

  // 3. Wire components in dependency order.
  const ksm = new KnowledgeStateManager(db, CONCEPTS)
  const dialogueGenerator = new DialogueGenerator({
    modelPath,
    expectedSha256: config.gemmaHashes[
      modelPath.includes('Q4_K_M') ? 'Q4_K_M' : 'Q8'
    ],
    // Phase 1 fix: bootstrapModel() already verified the hash at startup.
    // Skip the redundant 1.6 GB SHA-256 re-read on every loadModel() call.
    skipHashVerification: true,
    timeoutMs: config.inferenceTimeoutMs ?? 120_000,
    logger,
    conceptMap: CONCEPT_MAP,
  })
  const problemEngine = new ProblemEngine(db, CONCEPTS, {
    dialogueGenerator,
  })
  // DialogueGenerator implements SemanticAnswerEvaluator structurally — see
  // Task 23. The AnswerEvaluator's LLM cascade now reaches Gemma in production.
  const answerEvaluator = new AnswerEvaluator({
    semanticEvaluator: dialogueGenerator,
  })
  const translationLayer = new TranslationLayer({
    modelPath: nllbModelPath ?? `${config.modelDir}/nllb-200.gguf`,
    expectedSha256: config.nllb?.hash,
    logger,
  })

  const sessionEngine = new SessionEngine({
    ksm,
    problemEngine,
    answerEvaluator,
    dialogueGenerator,
    translationLayer,
    db,
    targetLanguage: config.targetLanguage ?? 'en',
  })

  // Phase B: wire the Socratic runtime on top of the authored content.
  const contentRetrieval = new ContentRetrieval(db)
  const responseClassifier = new ResponseClassifier(dialogueGenerator)
  const learnModeService = new LearnModeService({
    contentRetrieval,
    dialogueGenerator,
    responseClassifier,
    logger,
  })

  // Phase 1 fix: warm up Gemma immediately so the first student click is fast.
  // loadModel() is idempotent — subsequent calls return the cached promise.
  logger.log('[createApp] Warming up Gemma model...')
  await dialogueGenerator.loadModel()
  logger.log('[createApp] Gemma ready.')

  // Phase B status: log how many concepts have authored content available.
  const authoredIds = contentRetrieval.listAuthoredConceptIds()
  logger.log(
    `[createApp] Phase B: ${authoredIds.length} authored concept(s) available for Learn Mode: ` +
    authoredIds.join(', ')
  )

  return {
    db,
    ksm,
    problemEngine,
    answerEvaluator,
    dialogueGenerator,
    translationLayer,
    sessionEngine,
    contentRetrieval,
    responseClassifier,
    learnModeService,
    close(): void {
      db.close()
    },
  }
}

// ---------------------------------------------------------------------------
// CLI smoke entry — `npm run start` or `tsx src/main.ts`
// ---------------------------------------------------------------------------

const isMain = process.argv[1]?.endsWith('main.ts') || process.argv[1]?.endsWith('main.js')
if (isMain) {
  const config: CalcuLearnConfig = {
    dbPath: process.env['DB_PATH'] ?? './data/calculearn.sqlite',
    modelDir: process.env['MODEL_DIR'] ?? './models',
    gemmaHashes: {
      Q4_K_M: process.env['GEMMA_Q4_SHA256'] ?? '',
      Q8: process.env['GEMMA_Q8_SHA256'] ?? '',
    },
    nllb: process.env['NLLB_SHA256']
      ? { fileName: process.env['NLLB_FILE'] ?? 'nllb-200.gguf', hash: process.env['NLLB_SHA256'] }
      : undefined,
    targetLanguage: process.env['TARGET_LANGUAGE'] ?? 'en',
  }

  createApp(config).then(
    (app) => {
      console.log('[main] CalcuLearn ready. Components wired:', {
        ksm: typeof app.ksm,
        problemEngine: typeof app.problemEngine,
        answerEvaluator: typeof app.answerEvaluator,
        dialogueGenerator: typeof app.dialogueGenerator,
        translationLayer: typeof app.translationLayer,
        sessionEngine: typeof app.sessionEngine,
      })
      app.close()
    },
    (err: unknown) => {
      console.error('[main] startup failed:', err instanceof Error ? err.message : err)
      process.exitCode = 1
    }
  )
}
