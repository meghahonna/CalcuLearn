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
import type { Database } from 'better-sqlite3';
import { KnowledgeStateManager } from './components/knowledgeStateManager.js';
import { ProblemEngine } from './components/problemEngine.js';
import { AnswerEvaluator } from './components/answerEvaluator.js';
import { DialogueGenerator } from './components/dialogueGenerator.js';
import { TranslationLayer } from './components/translationLayer.js';
import { SessionEngine } from './components/sessionEngine.js';
import { type Quantisation } from './bootstrap.js';
export interface CalcuLearnConfig {
    /** Filesystem path to the SQLite database. */
    dbPath: string;
    /** Directory containing GGUF model files. */
    modelDir: string;
    /** SHA-256 hashes for the two Gemma quantisation variants. */
    gemmaHashes: Record<Quantisation, string>;
    /** Optional Gemma quantisation override. */
    quantisation?: Quantisation;
    /** Optional NLLB-200 GGUF configuration. */
    nllb?: {
        fileName: string;
        hash: string;
    };
    /** Default UI language (BCP-47 / NLLB code). Defaults to 'en'. */
    targetLanguage?: string;
    /** Inference timeout for Gemma (ms). Defaults to 10s per Reqs 7.5/11.1. */
    inferenceTimeoutMs?: number;
    logger?: Pick<Console, 'log' | 'warn' | 'error'>;
}
/**
 * The fully-wired component graph. Hold onto this for the lifetime of the
 * process; close `db` at shutdown.
 */
export interface CalcuLearnApp {
    db: Database;
    ksm: KnowledgeStateManager;
    problemEngine: ProblemEngine;
    answerEvaluator: AnswerEvaluator;
    dialogueGenerator: DialogueGenerator;
    translationLayer: TranslationLayer;
    sessionEngine: SessionEngine;
    /** Cleanly close the SQLite connection. */
    close(): void;
}
export declare function createApp(config: CalcuLearnConfig): Promise<CalcuLearnApp>;
