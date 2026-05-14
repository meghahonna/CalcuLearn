# CalcuLearn Roadmap

> Personalized on-device AP Calculus AB/BC copilot — frontier-authored content
> + on-device SLM for Socratic dialogue.
>
> **Live URL:** https://f3c58c7d-7345-441a-9b01-33ee7f904dcb--3000.app.athenaintel.com
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

### A1. Visuals & interactive graphs (v1) — **DONE** (`8134127`)

Inline interactive SVG diagrams that render below the SLM's explanation
inside Learn Mode walkthroughs. Offline-first: declarative JSON specs in
SQLite → safe expression parser (no `eval`) → pure-SVG renderer with
sliders / segmented toggles. Zero external deps.

**Five visual primitives shipped:**
1. `function_plot` — static y = f(x) with point/line annotations
2. `secant_to_tangent` — drag h → 0; secant becomes tangent
3. `riemann_sum` — slide n + toggle left/right/midpoint
4. `accumulation` — drag x; watch F(x) = ∫ₐˣ f(t) dt build in real time (FTC)
5. `limit_approach` — slide ε → 0; see f(c±ε) close in on the limit

**Four hand-authored hero visuals** wired to `limits.definition`,
`deriv.power-rule`, `integ.riemann`, `integ.ftc`.

**Files added:** `src/visuals/{types,expr,render}.ts`,
`src/components/visualRetrieval.ts`, `migrations/004_visuals.sql`,
`scripts/authoring/seedVisuals.ts`, `content/visuals/*.json`. Wired
into `LearnModeUi` via stage-transition injection on `stage='explain'`.

### A1.2. Visuals — expansion pack — **NOT STARTED**

What's still deferred from the original A1 scope:
- **Auto-author visuals for all 20 concepts** via an `authorVisuals.ts`
  Opus prompt that emits the same JSON spec format. Each concept gets at
  least one hero visual.
- **Slope-field primitive** for ODEs (`ode.separable`, `ode.first-order-linear`).
- **Related-rates scenarios** — animated, per-problem diagrams (cone draining,
  ladder sliding, etc.).
- **Tangent + secant overlays on `function_plot`** — the spec types already
  allow `bind` references to controls; renderer just needs to honor them.
- **Visuals on `example` / `deep_dive` / `application` slots** (only the
  `explanation` slot is wired into the UI right now).
- **Practice-mode visuals** — render the visual when the practice solution
  reveal is shown.

- **Effort:** Medium (1 week)
- **Impact:** High — turns visuals from "4 concepts" to "all 20" and adds
  the most expressive primitives.

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

### A5. Faster classifier — **DONE** (`244ab88`)

5-tier deterministic classifier replacing the SLM-only path. Tiers
1–5 resolve in <5ms each; tier 6 (SLM) only fires as a last-resort
fallback when all deterministic tiers abstain with low confidence.

**Pipeline:**
1. **Meta-phrase regex** (`<1ms`) — "I dont know", "explain differently",
   "skip ahead", "slow down", "I'm lost", etc.
2. **expected_pattern regex** (`<1ms`) — author-supplied regex match
3. **Math-aware structural compare** (`<5ms`) — `2*x` ≡ `$2x$` ≡ `two x` ≡
   `2(x+1)` ≡ `(x+1)^2 vs x^2+2x+1`. Uses the A1 expression parser to
   probe both sides numerically at 7 test points.
4. **Misconception keyword overlap** (`<5ms`) — free-form student input
   matched against the misconception catalog, with conservative
   thresholds (≥60% overlap + ≥3 absolute matches) to avoid false
   positives on correct prose.
5. **Heuristic confidence** (`<5ms`) — hedging words + math density +
   expected-number containment → partial_correct / off_topic.
6. **SLM fallback** (`8–25s`) — only for long, ambiguous, free-form
   inputs that no deterministic tier handles. Opt-out via
   `enableSlmFallback: false` for fully offline / airgapped runs.

**Smoke-test result on 16 real-world cases:**
| Tier | Count | Avg latency |
|---|---:|---:|
| 1 (meta) | 6 | 0.2ms |
| 2 (pattern) | 1 | 0.0ms |
| 3 (math) | 6 | 0.3ms |
| 4 (misconception) | 1 | 0.0ms |
| 6 (SLM fallback) | 2 | 16.3s |

**Fast-path hit rate: 87.5%** on this deliberately edge-case-heavy
set; production traffic will be higher because most replies are
short numeric answers or meta intents.

**Telemetry:** every classification result now carries a `tier`,
`latencyMs`, and `confidence` field. `src/main.ts` aggregates hit
counts and logs every 30 turns:
```
[classifier] 30 turns: tiers T1=12 T2=2 T3=8 T4=3 T5=4 T6=1
  (96.7% fast-path, avg 1842ms/turn)
```

**Tests:** 52 new unit tests covering every tier, edge cases, the
telemetry hook, the SLM-fallback toggle, and per-tier latency
budgets. Full suite: 263/268 passing.

**Net production impact:** a typical Learn Mode "check" turn drops
from ~20–35s (classify SLM + generate SLM) to ~10–15s
(classify fast-path + generate SLM) — a 2–3× perceived speedup.

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

Three reasonable orderings, depending on priority. **Track 1 has been
the path so far** (A2 done, A1 v1 done).

| Strategy | Remaining order | Optimizes for |
|---|---|---|
| **Maximize student value** _(current track)_ | A1.2 → A3 → A4 | Make the existing experience materially better for the struggling student |
| **Maximize distribution** | C1 → B1 → C3 | Turn into a school-purchasable product |
| **Harden v1, then expand** | E2 → E5 → A5 | Lock in quality on the foundation before adding more surface area |

---

## Currently in flight

_(nothing in flight — A1 v1, A2, and A5 all shipped. Pick the next
item from the lists above. Top recommendations:_
- **A1.2 — Visual expansion pack:** auto-author visuals for all 20 concepts +
  add slope-field primitive
- **A3 — Explore Mode:** free-form "ask me anything" with concept-graph routing
- **C1 — Teacher dashboard:** biggest distribution unlock_)

---

## Done since v1 merge

| Item | Commit | Lines |
|---|---|---:|
| docs: ROADMAP.md (initial) | `c6abcb6` | 261 |
| **A2 — Teach it back (Feynman) mode** | `f60b5fb` | 1,591 |
| **A1 — Visuals & interactive graphs (v1)** | `8134127` | 2,141 |
| fix(ui): challenge card overflow | `558ba0a` | 15 |
| docs: ROADMAP — mark A2 done | `3406b81` | 7 |
| docs: ROADMAP — mark A1 v1 done | `e1b0168` | 3 |
| **fix(db): recoverOrCreate full schema + WAL safety** | `c5c631c` | 209 |
| **A5 — 5-tier deterministic classifier** | `244ab88` | 901 |

**Net since v1 merge:** ~3,750 lines added (≈2 new feature areas), 0
broken tests (same 5 pre-existing infra failures).

**Net product capability since v1 merge:**
- Students can teach a concept back and get probing feedback
  anchored on the misconception catalog (A2).
- Students see interactive math visuals inline during Learn Mode for
  limits, the power rule, Riemann sums, and FTC (A1).
- Learn Mode and Teach-It-Back classification dropped from
  ~20s/turn to <100ms on the fast path (A5).
- Auto-recovery now restores the FULL schema instead of just the
  legacy 5 tables, and backs up the suspected-corrupt DB before
  deletion (fix on `c5c631c`).

