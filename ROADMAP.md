# CalcuLearn Roadmap

> Personalized on-device AP Calculus AB/BC copilot — frontier-authored content
> + on-device SLM for Socratic dialogue.
>
> **Live URL:** 
> **v1 spec:** see `docs/spec.md` (or the Athena document linked in commit history)

---

## v1 — Shipped

The current `main` branch (post-merge of `phase-a-copilot-architecture`) delivers
a fully-functional v1 of the copilot:

| Phase | Delivered |
|---|---|
| **A** | Concept content layer + Opus authoring pipeline (Phase A, 3,038 lines) |
| **B** | Socratic runtime — `LearnModeService`, state machine, response classifier (Phase B, 1,551 lines) |
| **C** | Three-mode UI — Practice / Learn / Challenge tabs, "I don't know" off-ramp (Phase C, 789 lines) |
| **D** | Adaptive routing — per-concept archetype detection, confidence chips, nudges (Phase D, 1,122 lines) |
| **E** | Challenge Mode UI — applications + deep dives + stretch problems (Phase E, ~1,000 lines) |
| **+** | Authored all 20 concepts; flagged 82 stretch problems |

**Content footprint:** 20 concepts · 80 explanations · 60 worked examples ·
105 misconceptions · 120 checks · 40 deep dives · 40 applications · 82 stretch
problems · 206 practice problems. ~750 content rows in SQLite.

---

## A. Pedagogical Depth — make existing modes smarter

Items that improve what students experience in Learn / Practice / Challenge.

### A1. Visuals & interactive graphs — **DONE** v1 (`4 primitives + 4 hero concepts`)
Tangent lines, Riemann sum animations, slope fields, function plotters,
implicit-curve visualizations. The single biggest intuition unlock for
struggling students — calculus is the subject where a picture is worth a
thousand words.
- **Effort:** Large (2–3 weeks)
- **Impact:** Very high
- **Tech notes:** Mafs, Function Plot, Plotly, or roll our own with SVG/Canvas.
  Render in Practice solution reveals, in Learn Mode walkthroughs, and in
  Challenge deep dives. Author the visual specs as JSON in the existing
  content pipeline.

### A2. "Teach it back" mode (Feynman technique) — **DONE** (`453ce87`)
Student explains a concept in their own words; SLM probes their explanation
with Socratic questions to detect gaps. The deepest learning technique we
haven't built yet.
- **Effort:** Medium (3–5 days)
- **Impact:** High
- **Tech notes:** Reuses Phase A content blocks as the "ground truth" the SLM
  compares against. New strict-mode prompts:
  - `teachBackOpener` — invites the student to explain
  - `teachBackProbe` — given student explanation + pre-authored explanation +
    misconception catalog, picks ONE gap to probe with a question
  - `teachBackVerify` — when student claims they understand a tricky bit, check
    it with a concrete prompt
  New UI panel in Learn Mode (post-walkthrough), and as a standalone tab in
  Challenge Mode.

### A3. Explore Mode (free-form "ask me anything")
A chat surface where the student can ask anything; the app first classifies
the question to a concept ID, then routes to a Socratic response anchored on
that concept's authored content. Strict leash still applies — SLM may not
introduce new math.
- **Effort:** Medium (1 week)
- **Impact:** Medium-high
- **Tech notes:** Question → concept classifier (new prompt), then dispatch to
  Learn Mode or Challenge Mode content. Hard-block off-topic drift.

### A4. Custom-authored stretch problems
The current `is_challenge=1` flag was set on existing application/proof-sketch
problems from the practice bank. Author 1–2 *new* harder problems per concept
(multi-concept, applied, olympiad-flavored).
- **Effort:** Medium (2–3 days authoring + prompt iteration)
- **Impact:** Medium
- **Tech notes:** Add a `stretchProblemPrompt` to `authoringPrompts.ts`; extend
  pipeline to write into `problems` with `is_challenge=1`.

### A5. Faster classifier
Drop per-turn latency from 10–40s to <5s by replacing the SLM-based response
classifier with a smaller dedicated model (or strong heuristics).
- **Effort:** Medium (1 week)
- **Impact:** High (felt-performance unlock everywhere)
- **Tech notes:** Distilled BERT classifier trained on labeled student answers,
  or a stronger heuristic table. The current `quickAnswerMatch` already
  handles short numeric answers without an SLM call.

---

## B. Classroom + Companion Features

Items that make CalcuLearn a real along-with-class tool, not a standalone app.

### B1. Daily "what did you cover today?" check-in
Single-screen daily prompt that captures the day's topic in natural language,
maps it to concept IDs, and surfaces 3–5 reinforcement problems / a 5-min
Learn walkthrough.
- **Effort:** Small (2–3 days)
- **Impact:** High — this is the literal classroom-companion promise
- **Tech notes:** New `/api/companion/today` endpoint; natural-language →
  concept-ID classifier using the same LLM-gateway path as the existing
  classifier.

### B2. Syllabus alignment
Student picks textbook or course (Stewart 9e, AP CED 2024, etc.); app sequences
Learn-Mode topics and Challenge content along that order.
- **Effort:** Medium (1 week)
- **Impact:** Medium-high
- **Tech notes:** Hand-curate a syllabus-mapping JSON per textbook; surface
  in the topic picker and the daily check-in.

### B3. Pre-class previews and post-class reinforcement
"Tomorrow your class covers integration by parts — want a 5-min head start?"
and "You learned the chain rule today — try these 3 problems."
- **Effort:** Medium (1 week)
- **Impact:** Medium
- **Tech notes:** Depends on B1 and B2. Adds a notification surface (in-app
  banner first; push later under D1).

### B4. Weekly progress summary
A weekly recap card showing concepts moved, time spent, archetype shifts,
shareable to parents/teachers as an image or link.
- **Effort:** Small-medium (3–5 days)
- **Impact:** Medium — parent visibility tends to drive retention
- **Tech notes:** Uses Phase D `student_concept_signals` and `session_history`.

---

## C. Teacher / School Distribution

Items that turn this from a student app into a school-purchasable product.

### C1. Teacher dashboard
Class roster + per-student per-concept archetype map + "who's struggling on
what" view. Powered by the existing `/api/adaptive/profile` plus a new
multi-student data model.
- **Effort:** Medium-large (1.5–2 weeks)
- **Impact:** Very high for B2B
- **Tech notes:** Multi-user auth, class/cohort table, teacher-role role
  separate from student. Use Phase D signals for the analytics.

### C2. Multi-student profiles
Profile picker on first load — family with multiple kids on one device, or a
classroom-shared tablet.
- **Effort:** Small (2–3 days)
- **Impact:** Low-medium standalone; necessary precursor for C1
- **Tech notes:** Already have `student_id` plumbing throughout; just needs a
  profile-management screen and localStorage keying.

### C3. Cross-student aggregates
Once C1 exists: "which misconceptions are most common in *my* class on the
chain rule" — pure SQL aggregations over `student_concept_signals` joined
with `concept_misconceptions`.
- **Effort:** Small (2–3 days once C1 exists)
- **Impact:** High for teachers

---

## D. Polish + Platform

### D1. PWA / offline install
Installable on phone/tablet; runs fully offline. Matches the original
offline-first README promise.
- **Effort:** Medium (1 week)
- **Impact:** High — mobile is where students actually live
- **Tech notes:** Service worker + app manifest. The bundle is already
  self-contained; Gemma is on-device. Just needs the install affordances and
  cache strategy for the static assets.

### D2. Math input toolbar
Symbol palette for fractions, exponents, integrals, Greek letters. Optional
handwriting input.
- **Effort:** Medium-large (1–2 weeks depending on handwriting)
- **Impact:** High for younger / mobile students
- **Tech notes:** MathQuill or MathLive for the editor surface; plain LaTeX
  output that the existing classifier can normalize.

### D3. Dark mode
Pure CSS.
- **Effort:** Small (1–2 days)
- **Impact:** Low-medium

### D4. Persistent learn sessions
Learn-mode sessions are currently in-memory only; survive server restart by
mirroring the SessionEngine's persistence pattern.
- **Effort:** Small (1 day)
- **Impact:** Low (it's a server restart, not a common event)

---

## E. Quality + Ops

### E1. Fix the 5 pre-existing test failures
Model file mismatches and a prompt-cap test that all predate Phase A. Not
from any of our work but they're noise in CI.
- **Effort:** Small
- **Impact:** Low

### E2. Critique pass on the 20 authored concepts
Run `RUN_CRITIQUE=1` over each concept JSON; flag mathematical issues, age
mismatches, or curriculum drift; regenerate the worst ones. The flag already
exists in `scripts/authoring/authorConcept.ts`.
- **Effort:** Small (half-day to run + flag; medium if many concepts need
  regeneration)
- **Impact:** Medium-high — content quality is the foundation of everything
  downstream

### E3. Rotate the GitHub token
The token `ghp_LXrv...` that was used to push earlier was visible in chat.
Rotate at https://github.com/settings/tokens and set the replacement as
`GITHUB_TOKEN` env var on the CalcuLearn computer asset.
- **Effort:** 5 minutes
- **Impact:** Security hygiene

### E4. Delete stale remote branch
`phase-a-copilot-architecture` is merged but the branch pointer still exists
on origin. One click on GitHub.
- **Effort:** 1 minute
- **Impact:** Tidiness

### E5. Tag v1.0 release
Tag the merge commit (`0ffe310`) as `v1.0` so we have a clean release marker
before piling on more features.
- **Effort:** 2 minutes
- **Impact:** Marker for "this is the shippable copilot"

---

## F. Out of scope (for now)

- Authoring beyond AP Calc AB/BC (pre-calc, algebra II)
- Real audio I/O (speech-to-text math, narrated walkthroughs)
- Spaced repetition scheduling
- Curriculum integration with specific textbooks beyond the syllabus mapping in B2

---

## Strategic paths

Three reasonable orderings, depending on priority:

| Strategy | Priority order | Optimizes for |
|---|---|---|
| **Maximize student value** | A1 → A5 → A2 | Make the existing experience materially better for the struggling student |
| **Maximize distribution** | C1 → B1 → C3 | Turn into a school-purchasable product |
| **Harden v1, then expand** | E2 → E5 → A1 | Lock in quality on the foundation before adding more surface area |

---

## Currently in flight

_(nothing in flight — pick the next item from the lists above)_

---

## Done since v1 merge

| Date | Item | Commit |
|---|---|---|
| 2026 | **A1 — Visuals & interactive graphs (v1)** | _this commit_ |
| 2026 | fix(ui): challenge card overflow | `558ba0a` |
| 2026 | **A2 — Teach it back (Feynman) mode** | `453ce87` |
| 2026 | docs: ROADMAP.md | `c6abcb6` |

