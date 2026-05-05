# Implementation Plan: CalcuLearn — Adaptive Calculus Tutor

## Overview

Implement CalcuLearn as an offline-first TypeScript/Node.js application. The build proceeds in layers: project scaffolding → data models and SQLite schema → Knowledge State Manager with BKT → Problem Bank data → Problem Engine → Answer Evaluator → Dialogue Generator (Gemma 4 via llama.cpp/Ollama) → Translation Layer (NLLB-200) → Session Engine orchestration → Student UI → security hardening → optional cloud sync → packaging. Property-based tests (fast-check) are placed immediately after the component they validate.

---

## Tasks

- [x] 1. Project scaffolding and dependency setup
  - Initialise a Node.js/TypeScript project with `tsconfig.json` (strict mode, ESNext target)
  - Add runtime dependencies: `better-sqlite3`, `uuid`, `mathjs`, `lru-cache`
  - Add llama.cpp Node binding (`node-llama-cpp`) or Ollama client (`ollama`) for Gemma 4 inference
  - Add NLLB-200 inference binding (llama.cpp or `@xenova/transformers` ONNX runtime)
  - Add dev dependencies: `vitest`, `fast-check`, `@types/better-sqlite3`, `tsx`
  - Create directory structure: `src/`, `src/models/`, `src/components/`, `src/data/`, `tests/`, `models/` (GGUF placeholder), `data/`
  - Add `vitest.config.ts` and an npm script `"test": "vitest --run"`
  - _Requirements: 7.1, 7.2, 9.1_

- [x] 2. Core TypeScript interfaces and data models
  - [x] 2.1 Define all shared TypeScript interfaces in `src/models/types.ts`
    - `KnowledgeState`, `ConceptMastery`, `ConceptNode`, `CalculusTopic`, `DifficultyLevel`
    - `Problem`, `ProblemType`, `SolutionStep`, `Misconception`
    - `EvaluationResult`, `Session`, `TurnRecord`, `SessionSummary`
    - `HintResult`, `TurnResult`, `LanguageCode`, `MathExpression`, `ProblemTemplate`
    - _Requirements: 2.1, 3.1, 5.6_
  - [x] 2.2 Implement runtime validation helpers in `src/models/validation.ts`
    - `assertMasteryProbability(v: number)` — throws if outside [0.0, 1.0]
    - `assertConceptDAG(nodes: ConceptNode[])` — throws if prerequisite graph contains a cycle (DFS cycle detection)
    - `assertProblemMatchesConcept(problem: Problem, conceptId: string)` — throws if mismatch
    - _Requirements: 2.3, 8.3_

- [x] 3. SQLite schema and database layer
  - [x] 3.1 Create `src/db/schema.ts` — define and execute `CREATE TABLE IF NOT EXISTS` statements
    - `students(id TEXT PRIMARY KEY, created_at INTEGER)`
    - `concept_mastery(student_id TEXT, concept_id TEXT, mastery_probability REAL, attempt_count INTEGER, correct_count INTEGER, last_attempted INTEGER, status TEXT, PRIMARY KEY(student_id, concept_id))`
    - `session_history(session_id TEXT PRIMARY KEY, student_id TEXT, start_time INTEGER, end_time INTEGER, turns_json TEXT)`
    - `problems(id TEXT PRIMARY KEY, concept_id TEXT, difficulty TEXT, type TEXT, stem TEXT, answer_json TEXT, solution_steps_json TEXT, misconceptions_json TEXT, is_generated INTEGER)`
    - `translation_cache(cache_key TEXT PRIMARY KEY, translated_text TEXT, created_at INTEGER)`
    - Create FTS5 virtual table: `problems_fts(concept_id, difficulty)` content table pointing to `problems`
    - _Requirements: 3.5, 7.2_
  - [x] 3.2 Create `src/db/database.ts` — typed wrapper around `better-sqlite3`
    - `openDatabase(path: string): Database` — opens or creates the SQLite file
    - `initSchema(db: Database): void` — runs schema migrations idempotently
    - `recoverOrCreate(path: string): Database` — catches corrupt-DB errors, deletes and recreates, logs recovery event
    - _Requirements: 7.4, 11.5_

- [x] 4. Knowledge State Manager
  - [x] 4.1 Implement `bkt_update` in `src/components/knowledgeStateManager.ts`
    - Pure function: `bktUpdate(masteryPrior: number, isCorrect: boolean): number`
    - Constants: P_LEARN = 0.20, P_FORGET = 0.05, P_GUESS = 0.20, P_SLIP = 0.10
    - Clamp output to [0.0, 1.0] as a final safety guard
    - _Requirements: 2.2, 2.3_
  - [x]* 4.2 Write property test: BKT Bounds (Property 3)
    - **Property 3: BKT Bounds** — for all `masteryPrior` in [0.0, 1.0] and any boolean `isCorrect`, `bktUpdate` returns a value in [0.0, 1.0]
    - Use `fc.float({ min: 0, max: 1 })` and `fc.boolean()` as arbitraries
    - **Validates: Requirements 2.3**
  - [x]* 4.3 Write property test: Mastery Monotonicity on Correct Streaks (Property 1)
    - **Property 1: Mastery Monotonicity** — for any starting `masteryPrior` in [0.0, 1.0] and any n ≥ 1 consecutive correct answers with no hints, the mastery after n turns is strictly greater than the prior
    - Use `fc.float({ min: 0, max: 1 })` and `fc.integer({ min: 1, max: 20 })` as arbitraries; apply `bktUpdate` n times with `isCorrect = true`
    - **Validates: Requirements 2.4**
  - [x] 4.4 Implement `KnowledgeStateManager` class — `loadState`, `persistState`, `updateState`, `applyHintPenalty`
    - `loadState(studentId)` — reads from `concept_mastery` table; creates fresh state (all priors = 0.1) if student not found
    - `persistState(studentId, state)` — upserts all `ConceptMastery` rows in a single transaction
    - `updateState(studentId, result)` — calls `bktUpdate`, updates in-memory state, persists
    - `applyHintPenalty(state, conceptId)` — applies `bktUpdate(prior, false)` to simulate a slip
    - _Requirements: 2.1, 2.2, 2.5, 7.4_
  - [x]* 4.5 Write property test: Hint Penalty (Property 5)
    - **Property 5: Hint Penalty** — for any KnowledgeState and any concept c, after `applyHintPenalty` the mastery of c is ≤ its value before the call
    - Use `fc.float({ min: 0, max: 1 })` as the prior; assert `after <= before`
    - **Validates: Requirements 2.5, 1.3**
  - [x] 4.6 Implement `getNextTargetConcept` and `getMasteryScore`
    - `getMasteryScore(state, conceptId)` — returns mastery probability or 0.1 if not found
    - `getNextTargetConcept(state)` — filters to concepts where all prerequisites have mastery ≥ 0.7 and own mastery < 0.85; selects highest readiness score = min(prereq masteries) × (1 − own mastery)
    - Flag concepts for review when mastery drops below 0.7 after reaching mastered status (Requirement 2.7)
    - _Requirements: 2.6, 2.7, 2.8_

- [x] 5. Checkpoint — Knowledge State Manager
  - Ensure all KSM unit tests and property tests pass. Verify `bktUpdate` output is always in [0.0, 1.0] and that `getNextTargetConcept` respects the prerequisite gate. Ask the user if questions arise.

- [x] 6. Calculus concept graph and problem bank data
  - [x] 6.1 Create `src/data/concepts.ts` — define all `ConceptNode` entries
    - Limits: `limits.definition`, `limits.one-sided`, `limits.infinity`, `limits.lhopital`
    - Continuity: `continuity.definition`, `continuity.types`
    - Derivatives: `deriv.power-rule`, `deriv.product-rule`, `deriv.quotient-rule`, `deriv.chain-rule`, `deriv.implicit`, `deriv.related-rates`, `deriv.optimisation`
    - Integrals: `integ.riemann`, `integ.ftc`, `integ.substitution`, `integ.by-parts`, `integ.definite-apps`
    - ODEs: `ode.separable`, `ode.first-order-linear`
    - Encode prerequisite DAG edges; verify no cycles using `assertConceptDAG`
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7_
  - [x] 6.2 Create `src/data/problems.ts` — curated problem bank seed data
    - At minimum 4 problems per concept × 4 difficulty tiers (conceptual / procedural / application / proof-sketch)
    - Each problem includes `stem` (LaTeX), `answer` (MathExpression), `solutionSteps`, and `commonMisconceptions`
    - _Requirements: 3.1, 3.2, 8.2_
  - [x] 6.3 Create `src/db/seedDatabase.ts` — seed script that inserts concepts and problems into SQLite on first run
    - Idempotent: skip rows that already exist (`INSERT OR IGNORE`)
    - Populate FTS5 index after bulk insert
    - _Requirements: 3.5, 7.2_

- [x] 7. Problem Engine
  - [x] 7.1 Implement `ProblemEngine` class in `src/components/problemEngine.ts`
    - `selectNextProblem(state, session)` — maps mastery to difficulty tier, queries FTS5 index, applies recency filter (last 5 turns), falls back to variant generation
    - `generateVariant(template, difficulty)` — delegates to `DialogueGenerator.generateProblemVariant`; sets `isGenerated = true`; caches result via `INSERT OR IGNORE`
    - `getSolutionSteps(problem)` — returns `problem.solutionSteps`
    - Weighted sampling among candidates: boost problems whose `misconceptions` overlap with `KSM.getActiveMisconceptions`
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_
  - [x]* 7.2 Write property test: Prerequisite Gate (Property 2)
    - **Property 2: Prerequisite Gate** — for any randomly generated KnowledgeState, `selectNextProblem` never returns a problem whose concept has a prerequisite with mastery < 0.7
    - Generate random states with `fc.record` and `fc.float`; assert `result.conceptId` prerequisites all have mastery ≥ 0.7
    - **Validates: Requirements 3.4**
  - [x]* 7.3 Write unit tests for `ProblemEngine`
    - Test difficulty tier mapping at boundary values (0.3, 0.6, 0.8)
    - Test recency filter excludes last-5 problem IDs
    - Test fallback to variant generation when bank is empty
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 8. Answer Evaluator
  - [x] 8.1 Implement input sanitisation in `src/components/answerEvaluator.ts`
    - `sanitiseInput(raw: string): string` — strips `__import__`, `eval`, `exec`, shell metacharacters (`;`, `|`, `&`, backtick, `$()`) using regex allowlist
    - _Requirements: 5.7, 10.2_
  - [x] 8.2 Implement symbolic and numeric evaluation
    - `parseSymbolic(raw: string): MathExpression | null` — uses `mathjs.parse` after sanitisation; returns null on failure
    - `checkEquivalence(expr1, expr2): boolean` — uses `mathjs.simplify` to reduce `expr1 - expr2` to zero; falls back to numeric sampling (10 random points in [−10, 10])
    - `evaluate(problem, rawAnswer): Promise<EvaluationResult>` — symbolic → numeric → LLM fallback chain; sets `evaluationMethod` accordingly; returns `partialCredit` in [0.0, 1.0]
    - Identify matching `Misconception` objects from `problem.commonMisconceptions`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8_
  - [x] 8.3 Write property test: Evaluation Consistency (Property 4)
    - **Property 4: Evaluation Consistency** — for any Problem p and answer string a where symbolic parsing succeeds, `evaluate(p, a).isCorrect = true` iff `checkEquivalence(parse(a), p.answer) = true`
    - Generate pairs of equivalent and non-equivalent expressions; assert the biconditional holds
    - **Validates: Requirements 5.5**
  - [x]* 8.4 Write unit tests for `AnswerEvaluator`
    - Test sanitisation strips all forbidden patterns
    - Test symbolic path with known correct/incorrect calculus answers
    - Test numeric fallback when symbolic parse fails
    - Test LLM fallback is invoked when numeric check is inconclusive
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7_

- [x] 9. Checkpoint — Problem Engine and Answer Evaluator
  - Ensure all Problem Engine and Answer Evaluator tests pass. Verify the prerequisite gate property holds and that sanitisation strips all forbidden patterns. Ask the user if questions arise.

- [x] 10. Dialogue Generator (Gemma 4 on-device inference)
  - [x] 10.1 Implement model loader in `src/components/dialogueGenerator.ts`
    - Load Gemma 4 GGUF from configured path using `node-llama-cpp` or Ollama client
    - Verify SHA-256 hash of GGUF file on first load; throw if mismatch
    - Implement timeout wrapper: if inference exceeds 10 s, return pre-cached fallback string and log timeout; reduce context window for next call
    - _Requirements: 7.3, 7.5, 10.3, 11.1, 11.2_
  - [x] 10.2 Implement prompt construction and inference methods
    - `generateIntroduction(problem, state)` — builds system context + task prompt; calls inference; returns ≤ 150-word string
    - `generateFeedback(problem, result, state)` — implements `build_feedback_prompt` logic from design; Socratic style; ≤ 150 words
    - `generateHint(problem, hintLevel, state)` — Socratic hint that does not reveal the answer; ≤ 150 words
    - `generateWorkedExample(concept, state)` — step-by-step worked example; ≤ 150 words
    - `generateProblemVariant(template, difficulty)` — returns a new `Problem` object parsed from model output
    - Cap context window at 2048 tokens; summarise session history beyond threshold
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.5_
  - [x]* 10.3 Write unit tests for `DialogueGenerator`
    - Mock llama.cpp/Ollama binding; assert prompt contains concept name, mastery label, problem stem, raw answer
    - Assert all outputs are ≤ 150 words
    - Assert timeout path returns fallback and logs event
    - _Requirements: 4.3, 4.7, 7.5, 11.1_

- [x] 11. Translation Layer (NLLB-200 on-device inference)
  - [x] 11.1 Implement `TranslationLayer` class in `src/components/translationLayer.ts`
    - Lazy-load NLLB-200 GGUF on first `translate` call (not at app launch)
    - `translate(text, targetLanguage)` — extracts LaTeX spans (regex `\$...\$` and `\[...\]`), translates surrounding text, reinserts LaTeX byte-for-byte
    - `detectLanguage(text)` — returns detected `LanguageCode`
    - `getSupportedLanguages()` — returns list of 200+ NLLB language codes
    - LRU cache (max 500 entries) keyed on `${text}::${targetLanguage}`; check cache before inference
    - English passthrough: if `targetLanguage === 'en'`, return text unchanged without loading model
    - Fallback: if model fails to load, return original text and set a one-time notice flag
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.6_
  - [x]* 11.2 Write property test: Language Passthrough (Property 7)
    - **Property 7: Language Passthrough** — for any text containing LaTeX expressions, `translate(text, targetLanguage)` returns a string where every LaTeX expression is byte-for-byte identical to the input
    - Generate strings with embedded `$...$` LaTeX using `fc.string` + `fc.constant` arbitraries; assert LaTeX spans are unchanged after translation (mock NLLB inference)
    - **Validates: Requirements 6.2**
  - [x]* 11.3 Write unit tests for `TranslationLayer`
    - Test LRU cache hit avoids model call
    - Test English passthrough skips model
    - Test fallback to English when model fails to load
    - _Requirements: 6.4, 6.5, 6.6_

- [x] 12. Session Engine
  - [x] 12.1 Implement `SessionEngine` class in `src/components/sessionEngine.ts`
    - `beginSession(studentId)` — loads KnowledgeState, selects target concept, generates introduction, returns `Session`
    - `submitAnswer(sessionId, rawAnswer)` — routes to `AnswerEvaluator`, calls `KSM.updateState`, generates feedback via `DialogueGenerator`, translates via `TranslationLayer`, records `TurnRecord`, returns `TurnResult`
    - `requestHint(sessionId)` — increments hint count, calls `KSM.applyHintPenalty`, generates Socratic hint, translates, returns `HintResult`
    - `endSession(sessionId)` — persists final KnowledgeState, returns `SessionSummary`
    - Advance to next FrontierConcept when mastery ≥ 0.85 sustained over 3+ consecutive correct answers (Requirement 1.6)
    - Maintain session context: turn count = completed submissions, hint count = hint requests (Requirement 1.5)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x]* 12.2 Write property test: Session Persistence Round-Trip (Property 6)
    - **Property 6: Session Persistence Round-Trip** — for any sequence of session turns, after `endSession` completes, `loadState(studentId)` returns a KnowledgeState where all mastery values reflect the cumulative BKT updates from every EvaluationResult in that session
    - Generate random sequences of `EvaluationResult` objects; run through `SessionEngine`; reload state; assert mastery values match expected BKT chain
    - **Validates: Requirements 1.4, 2.1**
  - [x]* 12.3 Write unit tests for `SessionEngine`
    - Test turn count increments correctly after each `submitAnswer`
    - Test hint count increments correctly after each `requestHint`
    - Test concept advancement triggers at mastery ≥ 0.85 after 3 consecutive correct answers
    - Test `endSession` persists state before returning summary
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 13. Checkpoint — Session Engine and full component integration
  - Ensure all Session Engine tests pass. Verify the session persistence round-trip property holds. Run the full unit test suite and confirm all tests pass. Ask the user if questions arise.

- [x] 14. Student UI
  - [x] 14.1 Scaffold the UI shell in `src/ui/`
    - Choose target: Electron (desktop), plain HTML/JS served by a local Express server, or a React/Vite SPA
    - Create main layout: problem display area (LaTeX rendered via KaTeX or MathJax), answer input field, hint button, session summary panel
    - Wire UI events to `SessionEngine` methods: session start, answer submit, hint request, session end
    - _Requirements: 1.1, 1.2, 1.3, 4.3_
  - [x] 14.2 Implement LaTeX rendering in the problem display
    - Integrate KaTeX (bundled, offline) to render `problem.stem` and `SolutionStep.expression` fields
    - Ensure math renders correctly on small screens (responsive CSS)
    - _Requirements: 4.3, 7.1_
  - [x] 14.3 Implement session summary view
    - Display `SessionSummary.masteryDeltas`, `totalTurns`, `hintsUsed`, and `conceptsProgressed`
    - _Requirements: 1.4, 1.5_
  - [x]* 14.4 Write unit tests for UI event wiring
    - Mock `SessionEngine`; assert each UI action calls the correct method with correct arguments
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 15. Security hardening
  - [x] 15.1 Implement SHA-256 model verification in `src/security/modelVerifier.ts`
    - `verifyModelHash(filePath: string, expectedHash: string): Promise<void>` — streams file, computes SHA-256 using Node `crypto`, throws `ModelTamperingError` if mismatch
    - Call from `DialogueGenerator` and `TranslationLayer` model loaders on first load
    - _Requirements: 7.3, 10.3_
  - [x] 15.2 Harden UUID student identity
    - Ensure `students.id` is always generated with `uuid.v4()` at profile creation; never accept externally supplied IDs
    - _Requirements: 10.5_
  - [x] 15.3 Verify SymPy/mathjs sanitisation coverage
    - Add unit tests that attempt to inject `__import__`, `eval`, `exec`, `;`, `|`, `&`, backtick, `$()` into `sanitiseInput`; assert all are stripped
    - _Requirements: 5.7, 10.2_

- [x] 16. Integration tests
  - [x] 16.1 Offline smoke test
    - Spin up a full `SessionEngine` with mocked Gemma 4 and NLLB-200 (no real model files needed)
    - Run a 5-turn session; assert zero outbound network calls are made (intercept with `nock` or similar)
    - _Requirements: 7.1_
  - [x] 16.2 Multi-language integration test
    - Run a session with `targetLanguage = 'fr'`; assert all natural-language UI strings are non-English; assert all `$...$` LaTeX spans are byte-for-byte unchanged
    - _Requirements: 6.1, 6.2_
  - [x] 16.3 Full session simulation
    - Script a 20-turn session with alternating correct and incorrect answers
    - Assert mastery progresses monotonically on correct streaks
    - Assert session summary `totalTurns` equals 20 and `hintsUsed` equals the number of hint calls made
    - _Requirements: 1.5, 2.4, 9.1_

- [x] 17. Performance validation
  - [x] 17.1 Problem lookup benchmark
    - Write a test that inserts 1000 problems into the SQLite FTS5 index and measures `selectNextProblem` latency; assert p99 < 10 ms
    - _Requirements: 9.4_
  - [x] 17.2 Context window cap test
    - Construct a session history that exceeds 2048 tokens; assert `DialogueGenerator` summarises rather than truncates and that the resulting prompt is ≤ 2048 tokens
    - _Requirements: 9.5_
  - [x] 17.3 Quantisation selection test
    - Write a unit test for a `selectQuantisation(availableRamGb: number): 'Q4_K_M' | 'Q8'` helper; assert Q4_K_M for < 8 GB, Q8 for ≥ 8 GB
    - _Requirements: 9.3_

- [x] 18. Checkpoint — Integration and performance tests
  - Ensure all integration tests and performance benchmarks pass. Confirm the offline smoke test makes zero network calls. Ask the user if questions arise.

- [x] 19. Optional cloud sync service
  - [x] 19.1 Implement `SyncService` in `src/components/syncService.ts`
    - `syncSession(studentId, summary)` — anonymises payload (strips all PII fields; uses local UUID only), authenticates via OS keychain, POSTs to configured cloud endpoint
    - Only invoked when student has explicitly opted in (persisted flag in SQLite)
    - _Requirements: 7.6, 10.1, 10.4, 10.6_
  - [x]* 19.2 Write unit tests for `SyncService`
    - Assert sync payload contains no name, email, date of birth, or other PII fields
    - Assert sync is not called when opt-in flag is false
    - _Requirements: 7.6, 10.6_

- [x] 20. Packaging and deployment
  - [x] 20.1 Implement `selectQuantisation` helper and model bootstrap script in `src/bootstrap.ts`
    - Detect available RAM; select Q4_K_M or Q8 GGUF variant accordingly
    - Verify SHA-256 of selected model file before loading
    - Log model path, quantisation level, and available RAM at startup
    - _Requirements: 9.2, 9.3, 10.3_
  - [x] 20.2 Create `scripts/bundle.ts` — packaging script
    - Copies selected GGUF model files into `dist/models/`
    - Copies NLLB-200 GGUF into `dist/models/`
    - Copies seeded SQLite problem bank into `dist/data/`
    - Produces a self-contained `dist/` directory runnable without internet
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 20.3 Write a `README.md` with setup instructions
    - Document how to obtain and place GGUF model files
    - Document how to run `npm run seed` and `npm test`
    - Document hardware requirements and quantisation selection
    - _Requirements: 9.1, 9.2_

- [x] 21. Final checkpoint — Full test suite
  - Run the complete test suite (`npm test`). Ensure all unit tests, property tests, integration tests, and performance benchmarks pass. Verify all 7 correctness properties are covered by property-based tests. Ask the user if questions arise.

---

## Phase B — Post-review remediation (Tasks 22–31)

The full-codebase review surfaced four ship-blocking issues plus six smaller follow-ups. These tasks close those gaps. Tasks 22–25 are the critical path; 26–31 are quality follow-ups.

- [x] 22. Fix `SAFE_SYMBOLS` to allow math functions (`sin`, `cos`, `exp`, `sqrt`, `log`, `ln`)
  - Rewrite `hasOnlySafeSymbols` in `src/components/answerEvaluator.ts` to skip the `fn` SymbolNode of `FunctionNode` parents — those are function names, not free variables.
  - Add tests in `tests/answerEvaluator.test.ts` for trig (`sin(x)`), exp (`e^(sin(x))`), composite (`sin(x)^2 + cos(x)^2`), and a chain-rule answer (`cos(x) * e^(sin(x))`).
  - Widen Property 4 (Evaluation Consistency) generator beyond linear polynomials.
  - _Requirements: 5.1, 5.2, 5.5, 10.2_

- [x] 23. Wire `AnswerEvaluator` semantic fallback to `DialogueGenerator`
  - Add `evaluateSemanticAnswer(problem, rawAnswer)` to `DialogueGenerator` (or expose a thin `DialogueSemanticEvaluator` adapter that satisfies `SemanticAnswerEvaluator`).
  - Prompt should ask Gemma to return `{ isCorrect: bool, partialCredit: number, feedbackHints: string[] }` as JSON; reuse the same JSON-extract / fallback pattern as `generateProblemVariant`.
  - Test: a mock backend returns valid JSON; assert `AnswerEvaluator.evaluate` returns `evaluationMethod: 'llm'` with the parsed values.
  - _Requirements: 5.4_

- [x] 24. Persist `session_history` rows in `SessionEngine.endSession`
  - Insert a row with `session_id`, `student_id`, `start_time`, `end_time`, `turns_json` before `this.sessions.delete(sessionId)`.
  - Test against an in-memory DB: after `endSession`, `SELECT * FROM session_history` returns one row with the expected counts.
  - _Requirements: 1.4, 7.2_

- [x] 25. Replace `humanizeConceptId` with `CONCEPT_MAP.get(id)?.name` lookup in `DialogueGenerator`
  - Inject the concept map into `DialogueGenerator` (constructor option) so it can resolve human names instead of slug-transforming.
  - Test: a feedback prompt for `limits.lhopital` contains "L'Hôpital's Rule"; for `integ.ftc` it contains "Fundamental Theorem of Calculus".
  - _Requirements: 4.7_

- [x] 26. Reload Gemma model after context-window reduction
  - In `DialogueGenerator.inferText` timeout path: invalidate `this.loadPromise` and (lazily) reload the model with the smaller context size on the next call.
  - Test: capture `backend.load` calls; assert it is called twice when `contextTokens` halves.
  - _Requirements: 11.2_

- [x] 27. Default `Misconception.incorrectPattern` to substring matching, not regex
  - Add `matchType?: 'substring' | 'regex'` (default `'substring'`) to `Misconception`. Update the seed-data patterns and `identifyMisconceptions`.
  - Test: a pattern containing `(`, `)`, `+`, `=` matches the literal text, not a regex group.
  - _Requirements: 5.8_

- [x] 28. Verify NLLB model hash in `bootstrap.ts`
  - Extend `bootstrap.ts` to verify both Gemma and NLLB SHA-256 hashes before any other component touches them.
  - Test: a hash mismatch on NLLB throws `ModelTamperingError`.
  - _Requirements: 7.3, 10.3_

- [x] 29. Production wiring entry point: `src/main.ts`
  - Construct the full component graph: `recoverOrCreate` → `bootstrapModel` → KSM + ProblemEngine + AnswerEvaluator (with semantic adapter from Task 23) + DialogueGenerator + TranslationLayer → SessionEngine.
  - Export a `createApp(config)` factory plus an `if (require.main === module)` CLI hook.
  - Smoke test: `createApp` returns a working `SessionEngine` whose components are non-null.
  - _Requirements: 7.1, 7.2_

- [x] 30. UI shell with KaTeX rendering: `src/ui/index.html`
  - Single static HTML file: problem display area (KaTeX-rendered), answer input, hint button, session summary panel.
  - Wire DOM events to `StudentUiController` methods.
  - Add KaTeX as a bundled dev dependency; copy `node_modules/katex/dist/` into `dist/ui/` via the bundle script.
  - Update `bundle.ts` to no longer reference a nonexistent file.
  - _Requirements: 4.3, 14.1, 14.2, 14.3_

- [x] 31. Final checkpoint — re-run full suite
  - Confirm all tests pass after Tasks 22–30, including the new tests added in each.
  - Re-run the integrity diagnostic (parse `sin(x)`, `cos(x)`, etc.) to verify the SAFE_SYMBOLS fix.
  - _Requirements: 9.1_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- All 7 correctness properties from the design document are covered by property-based tests in tasks 4.2, 4.3, 4.5, 7.2, 8.3, 11.2, and 12.2
- Each task references specific requirements for traceability
- Checkpoints at tasks 5, 9, 13, 18, and 21 ensure incremental validation
- The design uses TypeScript throughout; no language selection prompt was needed
- GGUF model files (Gemma 4, NLLB-200) must be obtained separately and placed in `models/` before running the app
