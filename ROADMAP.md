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

### A1.2. Visuals — expansion pack — **DONE** (`81c4623`)

Auto-authored one inline interactive visual for every concept in the
curriculum. Coverage: 4/20 → 20/20. Also added the slope_field primitive
and tangent/secant/segment line kinds on `function_plot`.

**Distribution across the 20 visuals:**
- 9 × function_plot (derivatives, asymptotes, optimization)
- 4 × accumulation (FTC + integral applications)
- 3 × limit_approach (limits, continuity, L'Hopital)
- 2 × slope_field (the two ODE concepts)
- 1 × secant_to_tangent (power rule)
- 1 × riemann_sum (Riemann sums)

**New primitive — slope_field:**
- Draws short tangent-slope segments at a grid of (x, y) points where
  the slope is `y' = f(x, y)`.
- Traces particular solutions via Euler integration from each initial
  condition.
- The first IC is a **draggable** dot — students grab it and watch the
  solution curve morph in real time. Pointer-capture works on touch and mouse.

**Authoring pipeline:**
- `scripts/authoring/visualPrompts.ts` — Opus system prompt with all 6
  primitive schemas, expression-dialect rules, axis-range guidance.
- `scripts/authoring/authorVisuals.ts` — pipeline that reads the
  ground-truth explanation from `concept_explanations`, calls Opus with
  primitive hints per concept, validates (shape + expression-compile +
  axis-bracket + render-under-JSDOM), retries up to 3 times with the
  validation error fed back to Opus, and writes JSON when all checks pass.

**Note:** Items deferred from A1.2 — related-rates scenarios,
multi-slot visual injection, and practice-mode visual reveals — are
shipped as part of **A1.3** (see below). Control-binding (`bind`
field) is still deferred.

### A1.3. Visuals — expansion 2 — **DONE** (`27d13e3`)

Three deliverables on top of A1.2's foundation:

**1. New primitive: `related_rates`**

Time-driven scenario player for related-rates problems. Declarative spec:
- `state` array: time-driven variables (e.g. `x = t`, `y = sqrt(100 - t*t)`,
  `dydt = -t / sqrt(100 - t*t)`)
- `drawables` array: SVG primitives (circle, segment, rect, polygon,
  polyline, point, text) with attributes computed from state vars
- `readouts` array: live numeric displays below the diagram
- Time slider with the student scrubbing through the scenario

**Hand-authored hero:** Ladder sliding down a wall — student drags
the base-distance slider, watches `dy/dt` blow up as `y → 0`. Wired
to `deriv.related-rates`.

**2. Multi-slot visual injection in Learn Mode**

`learnMode.ts` now tracks injected slots in a Set and injects the
`example`-slot visual when the example stage delivers, in addition to
the `explanation`-slot visual on the explain stage. The DB and API
already supported any slot; only the UI was previously wired to a
single slot. Authoring more visuals for example/deep-dive/application
slots is now a content-only change.

**3. Practice-mode visual reveal**

When the Practice feedback card renders, the concept's hero visual is
surfaced underneath in a `<details>` block:
- Wrong answer → expanded by default (this is when the picture matters most)
- Right answer → collapsed by default

Best-effort: silent skip if no visual exists for the concept.

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

### A3. Explore Mode (free-form "ask me anything") — **DONE** (`5666f4e`)

Fourth mode. Student types any question; the app routes it to a concept
and answers using ONLY that concept's pre-authored content under the
strict leash.

**Two-tier router** (mirrors the A5 classifier pattern):
- **Tier 1 (<1ms):** keyword scoring with IDF down-weighting against
  concept name + one-liner + hand-curated alias map.
- **Tier 2 (~1-2s):** SLM picks from top-3 candidates if tier-1 is
  ambiguous; can also return "off_topic".

**Strict-leash answer:** SLM receives the explanation + 3 misconceptions
+ 1 worked example for the routed concept and produces a 2-4 sentence
response. No emojis, no filler, LaTeX for math, ends with at most one
clarifying question.

**Follow-up chips:** deterministic action chips after every agent
message — Show me an example / Why does this work? / Common mistakes /
A real-world use / Open Learn walkthrough. Chips pin the current
concept so wording-generic follow-ups (e.g. "walk me through an
example") don't drift off-topic.

**Topic pivot:** if the router routes to a different concept than the
previous turn, conversation memory resets.

**Off-topic:** "I can only help with AP Calculus AB/BC" + 3 suggestion
chips.

**Tests:** 22 new ConceptRouter unit tests covering routing accuracy,
off-topic detection, SLM disambiguation, and latency budgets.
16/16 hand-crafted routing cases pass; full suite 285/290.

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
| **Maximize student value** _(current track)_ | A4 → E2 → B1 | Make the existing experience materially better for the struggling student |
| **Maximize distribution** | C1 → B1 → C3 | Turn into a school-purchasable product |
| **Harden v1, then expand** | E2 → E5 → A5 | Lock in quality on the foundation before adding more surface area |

---

## Currently in flight

_(nothing in flight — A1 v1, A1.2, A1.3, A2, A3, and A5 all shipped.
Pick the next item from the lists above. Top recommendations:_
- **A4 — Custom-authored stretch problems:** harder, multi-concept,
  olympiad-flavored problems beyond reusing the existing practice bank
- **E2 — Critique pass on the 20 authored concepts:** content quality
  foundation; uses the RUN_CRITIQUE=1 flag we already built
- **C1 — Teacher dashboard:** biggest distribution unlock (B2B)_)

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
| **A1.2 — Visuals expansion pack (all 20 concepts)** | `81c4623` | 1,250 |
| **A3 — Explore Mode** | `5666f4e` | 1,361 |
| **A1.3 — Visuals expansion 2** | `27d13e3` | 426 |

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
- Every Learn Mode walkthrough now has an interactive visual — 20/20
  concept coverage via Opus-authored visuals; new slope_field
  primitive for ODE concepts; tangent/secant/segment line kinds on
  function_plot (A1.2).
- Students can now ask any free-form question; the two-tier router
  picks the right concept in <1ms and the agent answers under the
  strict leash against pre-authored content. Follow-up chips deep-
  link into Learn Mode (A3).
- Related-rates problems are now visual: ladder-sliding-down-a-wall
  with a scrubbable time slider and live (x, y, dx/dt, dy/dt)
  readouts. Visuals also appear under Practice solutions (especially
  when the student got it wrong) and below example stages in Learn
  Mode walkthroughs (A1.3).

