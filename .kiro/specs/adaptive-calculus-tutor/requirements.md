# Requirements Document

## Introduction

CalcuLearn is an offline-first adaptive calculus tutoring agent for K-12 students worldwide. The system runs entirely on-device using Gemma 4 (E2B/E4B for edge hardware, 26B/31B where resources permit) and delivers personalised Socratic instruction across the full K-12 calculus curriculum — limits, continuity, derivatives, integrals, and introductory differential equations. A Knowledge Space Theory model combined with Bayesian Knowledge Tracing drives real-time difficulty adaptation. Multi-language support is provided by an on-device NLLB-200 translation layer covering 200+ languages. All student data is stored locally in SQLite; cloud sync is strictly opt-in and anonymised.

---

## Glossary

- **System**: The CalcuLearn adaptive calculus tutoring application as a whole.
- **Session_Engine**: The orchestration component that manages the tutoring session lifecycle.
- **Knowledge_State_Manager (KSM)**: The component that maintains and updates per-student knowledge graphs using BKT.
- **Problem_Engine**: The component that selects or generates calculus problems appropriate to the student's current state.
- **Dialogue_Generator**: The on-device Gemma 4 inference wrapper that produces all natural-language output.
- **Answer_Evaluator**: The component that parses and scores student answers using symbolic, numeric, and LLM methods.
- **Translation_Layer**: The on-device NLLB-200 wrapper that localises natural-language output.
- **KnowledgeState**: The per-student data structure recording mastery probabilities for all calculus concepts.
- **ConceptNode**: A node in the calculus concept graph representing a single learnable concept with prerequisites.
- **Problem**: A calculus exercise with a stem, expected answer, solution steps, and misconception metadata.
- **EvaluationResult**: The structured output of the Answer_Evaluator for a single student answer.
- **Session**: The runtime context for a single tutoring interaction, including turn history and hint count.
- **BKT**: Bayesian Knowledge Tracing — the probabilistic algorithm used to update mastery estimates.
- **KST**: Knowledge Space Theory — the framework used to model prerequisite relationships between concepts.
- **NLLB-200**: No Language Left Behind 200-language distilled translation model, running on-device.
- **GGUF**: The quantised model file format used for on-device Gemma 4 and NLLB-200 inference.
- **CalculusTopic**: One of: `limits`, `continuity`, `derivatives`, `integrals`, `ode`.
- **DifficultyLevel**: One of: `conceptual`, `procedural`, `application`, `proof-sketch`.
- **MasteryProbability**: A float in [0.0, 1.0] representing the BKT posterior probability that a student has mastered a concept.
- **FrontierConcept**: The next concept targeted for instruction — all prerequisites mastered, concept itself not yet mastered.
- **PII**: Personally Identifiable Information — any data that could identify a real individual.
- **LRU_Cache**: Least-Recently-Used cache used by the Translation_Layer to avoid repeated inference.
- **FTS5**: SQLite Full-Text Search version 5, used for fast problem bank lookups.

---

## Requirements

### Requirement 1: Session Lifecycle Management

**User Story:** As a K-12 student, I want to start, continue, and end tutoring sessions, so that I can learn calculus at my own pace across multiple sittings.

#### Acceptance Criteria

1. WHEN a student initiates a session, THE Session_Engine SHALL load the student's KnowledgeState from local SQLite before presenting any problem.
2. WHEN a student submits an answer, THE Session_Engine SHALL route the raw answer to the Answer_Evaluator and update the Knowledge_State_Manager with the resulting EvaluationResult.
3. WHEN a student requests a hint, THE Session_Engine SHALL increment the session hint count by 1 and invoke the Knowledge_State_Manager to apply a mastery penalty to the current concept.
4. WHEN a session ends, THE Session_Engine SHALL persist the final KnowledgeState to local SQLite before returning the SessionSummary.
5. THE Session_Engine SHALL maintain session context — including current problem, turn count, and hint count — such that the turn count equals the number of completed answer submissions and the hint count equals the number of hint requests in that session.
6. WHEN the student's mastery of the current target concept reaches 0.85 sustained over 3 or more consecutive correct answers, THE Session_Engine SHALL advance to the next FrontierConcept.

---

### Requirement 2: Knowledge State and Bayesian Knowledge Tracing

**User Story:** As a student, I want the system to track my understanding of each calculus concept accurately, so that I am always challenged at the right level.

#### Acceptance Criteria

1. THE Knowledge_State_Manager SHALL store and retrieve KnowledgeState using local SQLite such that persisting then loading a state returns an equivalent state.
2. WHEN an EvaluationResult is received, THE Knowledge_State_Manager SHALL apply the BKT algorithm with constants P_LEARN = 0.20, P_FORGET = 0.05, P_GUESS = 0.20, P_SLIP = 0.10 to update the MasteryProbability for the evaluated concept.
3. THE Knowledge_State_Manager SHALL ensure MasteryProbability values remain in [0.0, 1.0] after every BKT update regardless of input values.
4. WHEN a student answers correctly n consecutive times on a concept with no hints used, THE Knowledge_State_Manager SHALL produce a MasteryProbability after those n turns that is strictly greater than the MasteryProbability before those turns.
5. WHEN a hint is applied to a concept, THE Knowledge_State_Manager SHALL produce a MasteryProbability for that concept that is less than or equal to the value before the hint was applied.
6. THE Knowledge_State_Manager SHALL identify the FrontierConcept as the concept where all prerequisite concepts have MasteryProbability >= 0.7 and the concept's own MasteryProbability is < 0.85, selecting the concept with the highest readiness score defined as min(prerequisite masteries) × (1 − own mastery).
7. WHEN a concept's MasteryProbability drops below 0.7 after previously reaching mastered status, THE Knowledge_State_Manager SHALL flag the concept for review and include it in subsequent problem selection.
8. THE Knowledge_State_Manager SHALL initialise all concept MasteryProbability values to 0.1 for a new student with no prior history.

---

### Requirement 3: Problem Selection and Generation

**User Story:** As a student, I want to receive problems that match my current understanding and target concept, so that I am neither bored nor overwhelmed.

#### Acceptance Criteria

1. THE Problem_Engine SHALL select problems whose `concept_id` matches the session's current target concept and whose `difficulty` matches the tier derived from the student's MasteryProbability: `conceptual` for mastery < 0.3, `procedural` for mastery in [0.3, 0.6), `application` for mastery in [0.6, 0.8), and `proof-sketch` for mastery >= 0.8.
2. THE Problem_Engine SHALL not return a problem whose `id` appears in the most recent 5 turns of the current session, unless no other problems exist for the target concept and difficulty tier.
3. WHEN no unseen problems remain for the target concept and difficulty tier, THE Problem_Engine SHALL invoke the Dialogue_Generator to produce a novel problem variant from a stored template, set `isGenerated = true` on the result, and cache the generated problem for future sessions.
4. THE Problem_Engine SHALL never return a problem for a concept whose prerequisites have not all reached MasteryProbability >= 0.7 in the current KnowledgeState.
5. THE Problem_Engine SHALL maintain a curated offline problem bank indexed by `concept_id` and `difficulty` using SQLite FTS5 for sub-millisecond lookup.
6. WHEN selecting among multiple candidate problems, THE Problem_Engine SHALL apply weighted sampling that prioritises problems targeting the student's active misconceptions.

---

### Requirement 4: Socratic Dialogue Generation

**User Story:** As a student, I want the tutor to guide me with questions and hints rather than giving away answers, so that I develop genuine understanding.

#### Acceptance Criteria

1. THE Dialogue_Generator SHALL produce all natural-language output — introductions, feedback, hints, and worked examples — using on-device Gemma 4 inference without any network call.
2. WHEN generating a hint, THE Dialogue_Generator SHALL produce a Socratic response that guides the student toward the next step without revealing the answer or any subsequent steps.
3. THE Dialogue_Generator SHALL produce responses of 150 words or fewer for all output types to accommodate small-screen devices.
4. WHEN generating feedback for a correct answer, THE Dialogue_Generator SHALL briefly acknowledge correctness and reinforce the reasoning behind the correct approach.
5. WHEN generating feedback for a partially correct answer, THE Dialogue_Generator SHALL acknowledge the correct portion and pose a guiding question about the missed step, referencing the identified misconceptions.
6. WHEN generating feedback for an incorrect answer, THE Dialogue_Generator SHALL gently indicate the error without revealing the answer and pose a Socratic question directed at the correct first step.
7. THE Dialogue_Generator SHALL construct prompts that include the current concept name, the student's mastery label, the problem stem, and the student's raw answer.

---

### Requirement 5: Answer Evaluation

**User Story:** As a student, I want my answers to be evaluated accurately whether I write them in symbolic math notation or plain text, so that I receive fair and useful feedback.

#### Acceptance Criteria

1. WHEN a student submits an answer, THE Answer_Evaluator SHALL first attempt to parse the raw answer as a symbolic math expression using SymPy or mathjs.
2. WHEN symbolic parsing succeeds, THE Answer_Evaluator SHALL use symbolic equivalence checking to determine correctness and set `evaluationMethod = 'symbolic'`.
3. IF symbolic parsing fails, THEN THE Answer_Evaluator SHALL fall back to numeric equivalence checking by sampling 10 points and set `evaluationMethod = 'numeric'`.
4. IF numeric checking is inconclusive, THEN THE Answer_Evaluator SHALL route the answer to the Dialogue_Generator for semantic evaluation and set `evaluationMethod = 'llm'`.
5. THE Answer_Evaluator SHALL return `is_correct = true` if and only if `checkEquivalence(parse(rawAnswer), problem.answer)` returns true when symbolic parsing succeeds.
6. THE Answer_Evaluator SHALL return `partialCredit` in [0.0, 1.0] for every evaluation regardless of the evaluation method used.
7. THE Answer_Evaluator SHALL sanitise the raw answer string by stripping executable patterns — including `__import__`, `eval`, `exec`, and shell metacharacters — before passing any content to SymPy.
8. THE Answer_Evaluator SHALL identify and return the list of Misconception objects whose `incorrectPattern` matches the student's parsed or raw answer.

---

### Requirement 6: Multi-Language Support

**User Story:** As a non-English-speaking student, I want the tutor to communicate in my preferred language, so that language is not a barrier to learning calculus.

#### Acceptance Criteria

1. THE Translation_Layer SHALL translate all natural-language output from the Dialogue_Generator into the student's configured target language using on-device NLLB-200 inference without any network call.
2. THE Translation_Layer SHALL preserve all LaTeX math expressions in translated output exactly as they appear in the source text, passing them through without modification.
3. THE Translation_Layer SHALL support a minimum of 200 languages as provided by the NLLB-200-distilled-600M model.
4. THE Translation_Layer SHALL cache translated strings in an LRU cache of up to 500 entries to avoid repeated NLLB inference for identical inputs.
5. IF the NLLB-200 model fails to load, THEN THE Translation_Layer SHALL fall back to returning the original English text and display a one-time notice to the student that translation is unavailable.
6. WHERE a student's target language is set to English, THE Translation_Layer SHALL pass text through without invoking the NLLB-200 model.

---

### Requirement 7: Offline-First Operation

**User Story:** As a student in a low-connectivity environment, I want the full tutoring experience to be available without internet access, so that I can learn regardless of my network situation.

#### Acceptance Criteria

1. THE System SHALL provide complete tutoring functionality — session management, problem selection, answer evaluation, dialogue generation, and translation — without any network connectivity.
2. THE System SHALL store all student data, problem banks, and session history exclusively in local SQLite on the student's device.
3. THE System SHALL load the Gemma 4 model from a locally bundled GGUF file and verify its SHA-256 hash on first load to detect tampering.
4. IF the local SQLite database is missing or corrupt at session start, THEN THE System SHALL create a fresh student profile with all concept MasteryProbability values initialised to 0.1 and log the recovery event.
5. IF Gemma 4 inference exceeds 10 seconds, THEN THE System SHALL return a pre-cached fallback response for the current concept, log the timeout, and reduce the context window for subsequent calls.
6. WHERE cloud sync is enabled by the student, THE System SHALL transmit only anonymised session data using a local UUID that is not linked to any real-world identity, and SHALL NOT transmit any PII.

---

### Requirement 8: K-12 Calculus Curriculum Coverage

**User Story:** As a student, I want the system to cover the complete K-12 calculus curriculum, so that I can use it as my primary study tool from introduction through advanced topics.

#### Acceptance Criteria

1. THE System SHALL include ConceptNode entries for all five CalculusTopic values: `limits`, `continuity`, `derivatives`, `integrals`, and `ode`.
2. THE Problem_Engine SHALL maintain problems at all four DifficultyLevel values — `conceptual`, `procedural`, `application`, and `proof-sketch` — for every concept in the curriculum.
3. THE System SHALL encode prerequisite relationships between concepts as a directed acyclic graph (DAG) with no cycles.
4. THE System SHALL cover derivatives including at minimum: power rule, product rule, quotient rule, chain rule, implicit differentiation, and applications (related rates, optimisation).
5. THE System SHALL cover integrals including at minimum: Riemann sums, the Fundamental Theorem of Calculus, substitution, integration by parts, and definite integral applications.
6. THE System SHALL cover limits including at minimum: limit definition, one-sided limits, limits at infinity, and L'Hôpital's rule.
7. THE System SHALL cover introductory ODEs including at minimum: separable equations and first-order linear equations.

---

### Requirement 9: Performance

**User Story:** As a student using a low-end device, I want the tutor to respond quickly, so that the learning experience is not interrupted by long waits.

#### Acceptance Criteria

1. THE Dialogue_Generator SHALL produce a complete inference response within 3 seconds on a Raspberry Pi 5 (4 GB RAM) using the Gemma 4 E4B model with Q4_K_M quantisation.
2. THE System SHALL load the Gemma 4 model into memory within 30 seconds on reference hardware (Raspberry Pi 5, 4 GB RAM).
3. THE System SHALL use Q4_K_M quantisation for Gemma 4 E4B on devices with less than 8 GB RAM and Q8 quantisation on devices with 8 GB RAM or more.
4. THE Problem_Engine SHALL return a problem selection result within 10 milliseconds using the SQLite FTS5 index on `concept_id` and `difficulty`.
5. THE Dialogue_Generator SHALL cap the Gemma 4 context window at 2048 tokens and summarise session history that exceeds this threshold rather than truncating it.
6. THE Translation_Layer SHALL load the NLLB-200 model lazily after the first session start rather than at application launch.

---

### Requirement 10: Security and Privacy

**User Story:** As a student and parent, I want my learning data to remain private and secure on my device, so that I can use the system without privacy concerns.

#### Acceptance Criteria

1. THE System SHALL store all student profile data, session history, and KnowledgeState exclusively on the local device and SHALL NOT transmit this data to any remote server unless cloud sync is explicitly enabled by the student.
2. THE Answer_Evaluator SHALL sanitise all student answer input before passing it to SymPy by using `sympify` with `evaluate=False` and a restricted symbol set that excludes executable constructs.
3. THE System SHALL verify the SHA-256 hash of each GGUF model file on first load and SHALL refuse to use a model file whose hash does not match the expected value.
4. WHERE cloud sync is enabled, THE System SHALL use device-level authentication (OS keychain) to secure the sync service connection.
5. THE System SHALL assign each student a locally generated UUID as their identifier and SHALL NOT collect, store, or transmit any real-world identity information.
6. IF cloud sync is enabled, THEN THE System SHALL anonymise all transmitted data such that no sync payload contains name, email address, date of birth, or any other PII field.

---

### Requirement 11: Error Handling and Resilience

**User Story:** As a student, I want the system to recover gracefully from errors, so that my learning session is not interrupted by technical failures.

#### Acceptance Criteria

1. IF Gemma 4 inference exceeds 10 seconds, THEN THE System SHALL return a pre-cached fallback response for the current concept and log the timeout event with the context window size.
2. WHEN a model inference timeout occurs, THE System SHALL reduce the context window size for subsequent calls and switch from Gemma 4 E4B to E2B if E4B was active.
3. IF symbolic answer parsing fails, THEN THE Answer_Evaluator SHALL fall back to numeric equivalence checking before routing to LLM evaluation.
4. IF the problem bank contains no unseen problems for the target concept and difficulty tier, THEN THE Problem_Engine SHALL generate a novel variant and cache it for future sessions.
5. IF the local SQLite database is missing or corrupt, THEN THE System SHALL initialise a fresh student profile with default MasteryProbability values of 0.1 for all concepts and log the recovery event.
6. IF the NLLB-200 translation model fails to load, THEN THE Translation_Layer SHALL continue operation in English and display a one-time notice to the student.
7. WHEN any component encounters an unhandled exception, THE System SHALL log the error with component name, error type, and stack trace without exposing error details to the student UI.
