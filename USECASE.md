# CalcuLearn — Use Cases

> A field guide to every way a student (or teacher, or developer) can
> use CalcuLearn today. Each entry includes: who it's for, when to use
> it, exactly which buttons to press, what happens under the hood, and
> what to do next.
>
> **Live URL:** https://f3c58c7d-7345-441a-9b01-33ee7f904dcb--3000.app.athenaintel.com
> **Repo:** https://github.com/meghahonna/CalcuLearn (branch: `main`)

---

## Quick reference — the four modes

CalcuLearn has **four primary modes**, accessible as tabs at the top:

| Tab | Surface | Best for | Behind the scenes |
|---|---|---|---|
| **Practice** | Adaptive problem loop with hints | Working through problems at your pace | 206 problem bank + Bayesian Knowledge Tracing + adaptive routing |
| **Learn** | Socratic walkthrough of a concept | Building understanding from scratch on one topic | Pre-authored explanation + check-for-understanding + worked example, paraphrased by on-device Gemma |
| **Challenge** | Real-world applications + deep dives + stretch problems | Going beyond AP — applying to physics/bio/econ | 40 applications + 40 deep dives + 82 stretch problems |
| **Explore** | Free-form "ask me anything" chat | When you have a question and don't know which mode to pick | Two-tier concept router + strict-leash Socratic answer |

All modes share the same **20 authored concepts** covering the full AP
Calculus AB/BC curriculum. Visuals appear inline in every mode.

---

## 1. Practice Mode — the problem loop

**Who:** Students who want to drill problems and track mastery.

**Open it:** Default tab when you load the app. Or click **Practice**.

### 1.1 Standard practice flow

| Step | What you do | What CalcuLearn does |
|---|---|---|
| 1 | Click **Start session** | Picks a starting problem from the bank using your mastery profile |
| 2 | Read the stem | Renders LaTeX inline; difficulty badge shown |
| 3 | Type your answer + click **Submit** | A5 5-tier classifier evaluates in <50ms (vs 10-25s pre-A5) |
| 4 | See the **feedback card** (green for correct, red for wrong) | LaTeX-aware feedback |
| 5 | See the **diagram** revealed below the feedback | A1.3: hero visual auto-expanded on wrong answers, collapsed on correct |
| 6 | (Phase D) Rate your confidence — *Got it / Guessed / Shaky* | Feeds the adaptive router |
| 7 | (Phase D) Maybe see a **nudge banner** — *"You've got 3 in a row, ready for a Challenge?"* | Per-concept archetype detection |
| 8 | Auto-advances to the next problem |

### 1.2 Hint flow (when you're stuck)

- Click **Hint** — gets a hint from the problem's authored `hint_progression_json`
- Each successive **Hint** click reveals a deeper hint
- **Doesn't end the problem** — you can still submit afterward
- All hint usage is tracked into your mastery profile

### 1.3 "I don't know — help me understand"

- Stuck and hints aren't enough?
- Click **I don't know — help me understand** below the answer box
- **App switches to Learn Mode** for the concept underlying the current problem
- Walks you through Socratically; when done, you can return to Practice

### 1.4 Adaptive signals (Phase D)

Every Practice submit feeds the **AdaptiveRouter**, which tracks per-concept:
- `recent_attempts_json`: rolling window of last attempts
- `consecutive_failures` / `consecutive_aces`
- `dont_know_count`, `learn_engagements`, `learn_completions`
- `archetype`: `struggling` / `on_pace` / `advanced` / `unknown`

Triggers:
- **2 consecutive failures** on a concept → nudge to Learn Mode
- **3 consecutive aces** on a concept → unlock Challenge tab for it (green badge)
- **"Shaky" confidence** after a correct answer → suggests alt-framing

Same student can be `advanced` on `deriv.power-rule` and `struggling`
on `deriv.chain-rule` simultaneously.

### 1.5 New since A1.3 — Practice-mode visual reveal

After every submit, the concept's hero visual appears under the
feedback card in a `<details>` block:
- **Wrong** → opened by default
- **Right** → collapsed (click "Diagram" to expand)

Each of the 20 concepts has at least one. The visual lets you SEE
the concept while the feedback is still on screen.

---

## 2. Learn Mode — Socratic walkthrough

**Who:** Students who want to understand a concept, not just solve problems.

**Open it:** Click **Learn** tab, OR hit **I don't know — help me understand** from Practice.

### 2.1 Picking a concept

- **Topic picker**: 20 concepts, grouped roughly by curriculum order
- For each concept, pick a tier:
  - **Slow & simple** (novice tier): plain English, concrete numbers, analogies
  - **Match the class** (on-pace tier): standard textbook clarity
  - **Push me** (advanced tier): formal definitions, deeper "why"
- The same student can pick different tiers on different concepts

### 2.2 The walkthrough state machine

Each session walks through these stages:

```
intro → explain → check_understanding → example → check_understanding_2 → done
```

| Stage | What you see | Branch when… |
|---|---|---|
| **intro** | Short hello + "ready?" question | You can also say "I don't know" / "explain differently" |
| **explain** | Pre-authored explanation block + **inline visual** | You can say "explain it a different way" → alt-framing tier-step |
| **check_understanding** | A check-for-understanding prompt | Your answer is classified by A5 (correct / partial / misconception / dont_know) — misconception triggers the Socratic response from the catalog |
| **example** | Pre-authored worked example walking through the steps + **example-slot visual** (A1.3) | Same probing rules |
| **check_understanding_2** | Second check | Same |
| **done** | Wrap-up + "**Teach it back to lock it in**" button (A2) | Click it → Teach-It-Back launches |

### 2.3 Off-ramps from any stage

- **"I don't know"** at any stage → SLM detects via tier-1 regex (<1ms) → drops you to alt-framing
- **"Explain differently"** → alt-framing
- **"Skip ahead"** → advances state
- **"Slow down"** → re-engages with the prior block

### 2.4 Inline visuals (A1 + A1.3)

Every concept has at least one inline interactive visual:
| Visual primitive | Concepts that use it | What it does |
|---|---|---|
| `function_plot` (9 concepts) | derivatives, asymptotes, optimization | static curve w/ tangent / asymptote lines |
| `accumulation` (4 concepts) | FTC, by-parts, definite-apps, substitution | drag x; F(x) area builds in real time |
| `limit_approach` (3 concepts) | limits, continuity, L'Hôpital | drag ε; f(c±ε) closes in on the limit |
| `slope_field` (2 concepts) | ODE separable, first-order linear | drag the initial-condition dot, watch solution morph |
| `secant_to_tangent` (1) | power rule | drag h→0, secant becomes tangent |
| `riemann_sum` (1) | Riemann sums | drag n, toggle left/right/midpoint |
| `related_rates` (1) | related rates | drag time slider, watch ladder slide w/ live x, y, dy/dt readouts |

Visuals appear automatically below the matching agent message:
- `explanation`-slot visual after the **explain** stage delivers
- `example`-slot visual after the **example** stage delivers (A1.3 — wiring in place; content only authored for explanation slot so far)

---

## 3. Challenge Mode — apps + deep dives + stretch

**Who:** Students who want to go beyond AP exam mechanics.

**Open it:** Click **Challenge** tab. Concepts you've mastered (3 aces)
get a green **UNLOCKED** badge.

### 3.1 Bundle structure

Pick any concept (locked or unlocked — nothing's actually blocked).
Each bundle gives you:
- **2 application problems** — model a real-world scenario with calculus
  (physics / biology / economics / engineering)
- **2 deep dives** — "why does this work?" derivations with intuition
- **4–6 stretch problems** — harder problems from the bank flagged `is_challenge=1`

### 3.2 Application cards

For each application:
1. Read the **scenario + question**
2. Type your modeling approach + final answer in the textarea
3. Click **Check** — SLM compares your reasoning to the pre-authored
   `solution_outline_md` and gives Socratic feedback (it will NEVER
   just give you the answer — strict leash)
4. Click **Show solution outline** to reveal the authored hint

### 3.3 Deep-dive cards

For each deep dive:
1. Read the body (typically a derivation or proof sketch)
2. Type a reflection or follow-up in the textarea
3. Click **Probe** — SLM probes your reflection against the deep-dive's
   authored "extension question"

### 3.4 Stretch-problem cards

For each stretch problem:
1. Read the stem
2. Try it on paper
3. Click **Show solution steps** to reveal the authored step-by-step

### 3.5 "Teach it back" trigger (A2)

Every bundle's header has a **Teach it back** button. Click it →
Teach-It-Back launches scoped to that concept (see section 5).

---

## 4. Explore Mode — ask anything (A3)

**Who:** Students with a question who don't know which mode to pick;
curious students browsing.

**Open it:** Click **Explore** tab.

### 4.1 The flow

1. Type any question in the chat box. Examples that work well:
   - *"What is the chain rule?"*
   - *"How do I find a horizontal asymptote?"*
   - *"Explain integration by parts"*
   - *"Walk me through u-substitution"*
   - *"What is dy/dx for x² + y² = 25?"*
   - *"What is L'Hôpital's rule?"*
2. Press **Enter** or click **Ask**
3. The **two-tier router** finds the right concept (<1ms most of the time)
4. The agent replies in 2–4 sentences, using LaTeX, anchored on the
   pre-authored explanation + misconceptions + worked example for that concept
5. A **chip rail** appears under the answer:
   - *Show me an example*
   - *Why does this work?*
   - *Common mistakes*
   - *A real-world use*
   - *Open Learn walkthrough* (deep-links into Learn Mode)
6. Click a chip → it follows up pinned to the current concept (no drift)

### 4.2 Topic pivot

If you switch topic mid-conversation, the router detects it and **resets
conversation memory** for the new concept. No cross-contamination.

### 4.3 Off-topic handling

Ask *"What is the meaning of life?"* or *"How do I write a Python loop?"* and
the agent declines politely with three concept-suggestion chips
("Power Rule", "Riemann Sums", "Limit Definition") you can click to start.

### 4.4 Status line

At the bottom of the chat: `tier-1 · conf 0.95 · 0ms · candidates: deriv.chain-rule, ...`
shows how the router decided. Useful for understanding why a particular
concept was chosen.

### 4.5 What the router knows

The router indexes **all 20 concepts** by:
- Concept name (highest weight)
- One-liner
- Hand-curated alias map (e.g. `deriv.optimisation` → `[max, min, maximize, critical point, biggest, smallest, optimize]`)
- IDF down-weighting so common words like "rule" / "function" don't dominate

Off-topic detection: score below threshold → returns null → polite decline.

---

## 5. Teach It Back (A2) — Feynman technique

**Who:** Students who *think* they understand a concept and want to test it.

**Open it:** Two surfaces:
1. **End of Learn Mode walkthrough** — "Teach it back to lock it in" button on the done screen
2. **Challenge bundle header** — "Teach it back" button on any concept

### 5.1 The flow

1. Opener: *"Imagine a friend who's never seen this. Explain it to them in your own words."*
2. **Scaffolding chips** below — gentle facet hints pulled from the authored explanation's numbered steps. Click **expand** to peek; ignore if you're confident.
3. Type your explanation in the textarea — as long or short as you like
4. Click **Submit explanation** (or Ctrl/Cmd+Enter)
5. SLM analyzes your explanation against the pre-authored **misconception catalog** and the **explanation facets**
6. Picks **ONE gap** and asks a Socratic probe (max 4 rounds)
7. Optionally surfaces a **misconception card** if your explanation matched one
8. Click **Finish & see assessment** any time
9. Final card: side-by-side *"What landed"* vs *"What's still thin"* + closing message + recommendation chips

### 5.2 The strict leash

The SLM can ONLY pick gaps from the closed list (facets F0..Fn,
misconceptions M0..Mm). It cannot invent new gaps. This keeps the
probing pedagogically sound — every probe is grounded in real
misconception data.

### 5.3 Recommendations after assessment

- *Re-read the explanation in Learn Mode* — opens Learn Mode for the concept
- *Review the common misconceptions* — opens Learn Mode and walks you through them
- *Try a Practice problem to lock it in* — back to Practice

---

## 6. The visual layer (A1 / A1.2 / A1.3) — by primitive

Each primitive is exposed where it best fits. Below is the **inventory**
of every interactive element and how to use it.

### 6.1 `function_plot` — static curve with annotations

- Used on: 9 concepts (most derivatives, asymptotes, optimization, continuity, one-sided limits, limits at infinity)
- No interactivity — read the curve + the labelled tangent/secant/asymptote lines
- Used for: showing where on a curve a feature happens

### 6.2 `secant_to_tangent` — drag h → 0

- Used on: `deriv.power-rule`
- **Drag the h slider** toward 0
- Watch the secant line through `(a, f(a))` and `(a+h, f(a+h))` rotate into the tangent
- The slope readout updates live: *"slope ≈ 1.99 (≈ tangent)"* when h is small
- Tells you visually why the derivative is the **limit of average rates**

### 6.3 `riemann_sum` — drag n, toggle method

- Used on: `integ.riemann`
- **Drag the n slider** from 1 to 40 rectangles
- **Toggle method**: left / right / midpoint
- Sum readout updates live: *"S ≈ 2.5 (n=12, midpoint)"*
- Watch the estimate converge to the true ∫₀² x²dx = 8/3 ≈ 2.667

### 6.4 `accumulation` — drag x, watch F(x) build

- Used on: 4 concepts (FTC, by-parts, definite-apps, substitution)
- **Drag the x slider** to sweep right
- Watch the **shaded area** under f(t) from a to x grow
- F(x) readout updates live: for f(t) = 2t with a=0, you'll see F(x) = x²
- The FTC visual: F'(x) = f(x). Watch the slope of F(x) match f(x).

### 6.5 `limit_approach` — drag ε → 0

- Used on: 3 concepts (limit definition, continuity definition, L'Hôpital)
- **Drag the ε slider** toward 0
- Two dots — one on each side of x = c — close in on the limit value
- A hole at x = c (open red ring) shows where the function is undefined
- Live readouts: f(c − ε) and f(c + ε), color-coded by side

### 6.6 `slope_field` — drag the initial-condition dot

- Used on: 2 concepts (ODE separable, first-order linear)
- Background: ~210 tangent-slope segments at a grid showing y' = f(x, y)
- **Grab the colored dot** with your mouse/finger and drag
- Watch the **solution curve** redraw in real time as you move the IC
- For the logistic ODE: drag the dot around y = 10 to see solutions converge to the carrying capacity

### 6.7 `related_rates` — drag time, watch scenario evolve (A1.3)

- Used on: `deriv.related-rates` (Ladder sliding down a wall)
- **Drag the x slider** (`x = ft from wall`) from 0.1 to 9.5
- Watch the ladder rotate as the base slides out
- Live readouts: `x`, `y`, `dx/dt`, `dy/dt` — all updating per frame
- Insight: `dy/dt` blows up as `y → 0` — the top is racing toward the ground

### 6.8 Where each visual appears

| Surface | Behavior |
|---|---|
| **Learn Mode — `explain` stage** | Visual auto-injects below the explanation bubble |
| **Learn Mode — `example` stage** | Example-slot visual auto-injects (A1.3 — wiring; no content yet) |
| **Practice — feedback card** | Hero visual revealed in `<details>` (expanded on wrong; collapsed on right) |
| **Challenge bundle** | Bundle currently uses hand-rendered cards; visuals could be wired here in A1.4 |
| **Explore Mode** | Visuals are not yet inline in Explore Mode replies; the "Open Learn walkthrough" chip routes there |

---

## 7. Adaptive routing — Phase D signals

The adaptive layer runs across all four modes and decides *what to suggest next*.

### 7.1 The signals tracked per (student × concept)

- `recent_attempts_json`: last N attempts with timestamps + outcomes
- `practice_attempts`, `practice_correct`, `practice_hints_used`
- `dont_know_count`: how often this student hit the "I don't know" off-ramp
- `learn_engagements`, `learn_completions`
- `consecutive_failures`, `consecutive_aces`
- `archetype`: `struggling` / `on_pace` / `advanced` / `unknown`
- `last_confidence`: most recent confidence chip click
- `challenge_unlocked`: boolean per concept

### 7.2 The four routing rules

| Trigger | Action surfaced |
|---|---|
| 2 consecutive failures on concept X | Nudge banner: *"Stuck? Try the Learn walkthrough for X."* |
| 3 consecutive aces on concept X | Nudge banner: *"You've got it. Try a Challenge?"* + Challenge tab gets green dot |
| "Shaky" confidence after correct | Subtle suggestion to revisit Learn Mode with a different framing |
| Sustained struggle across many concepts | Archetype updates to `struggling`; subsequent Learn sessions default to novice tier |

### 7.3 Per-concept archetype

Critically, archetype is **per-concept**, not global. The same student can:
- Be `advanced` on `limits.definition` (3 aces in a row)
- Be `struggling` on `deriv.chain-rule` (consecutive failures + "don't know" hits)
- Be `on_pace` on everything else

This means Learn Mode defaults to different tiers per concept based on past performance.

### 7.4 The confidence chip

After every Practice submit, a chip rail appears:
- *Got it* → confidence 1.0, no further action
- *Guessed* → confidence 0.5, may trigger alt-framing suggestion
- *Shaky* → confidence 0.2, more likely to trigger Learn Mode nudge

The chip's value is stored alongside the attempt and fed into the
archetype calculation.

---

## 8. Authoring workflows — for content contributors

**Who:** Anyone adding new content (concepts, visuals, problems).

### 8.1 Author a new concept

```bash
# 1. Add the concept spec to scripts/authoring/conceptSpecs.ts
#    (track, prerequisites, one-liner, framing hints, etc.)

# 2. Run the Opus pipeline
npx tsx scripts/authoring/authorConcept.ts <concept_id>

# 3. Validate the output (auto-done — schema check + render check)

# 4. Seed into the DB
npx tsx scripts/authoring/seedContent.ts
```

Each concept produces ~12 Opus calls (explanation × tiers × framings,
worked examples, misconceptions, checks, deep dives, applications).

### 8.2 Author a visual

```bash
# Hand-author (preferred for hero visuals):
# Write content/visuals/<concept_id>.json by hand.

# Or auto-author with Opus:
npx tsx scripts/authoring/authorVisuals.ts <concept_id>
npx tsx scripts/authoring/authorVisuals.ts --all-missing

# Validates: shape + expression-compile + axis-bracket + render-under-JSDOM
# Retries up to 3 times with the validation error fed back to Opus.

# Seed:
npx tsx scripts/authoring/seedVisuals.ts
```

Supported primitives: `function_plot`, `secant_to_tangent`, `riemann_sum`,
`accumulation`, `limit_approach`, `slope_field`, `related_rates`.

### 8.3 Mark problems as stretch (Challenge mode)

```sql
UPDATE problems
SET is_challenge = 1
WHERE difficulty IN ('proof-sketch', 'application')
   AND concept_id = '<concept_id>';
```

### 8.4 Critique pass (E2 — shipped)

Two flavours:

**Single-concept critique (free-form):**
```bash
RUN_CRITIQUE=1 npx tsx scripts/authoring/authorConcept.ts <concept_id>
```
Asks Opus to review the just-authored concept and emit free-form
prose critique. Useful when iterating on a single concept.

**Structured batch critique (across many concepts):**
```bash
# All concepts in the DB
npx tsx scripts/authoring/critiqueAll.ts

# Specific concepts only
npx tsx scripts/authoring/critiqueAll.ts deriv.chain-rule limits.lhopital

# Skip already-critiqued concepts
npx tsx scripts/authoring/critiqueAll.ts --resume
```

Pulls each concept's full content from SQLite, asks Opus to apply a
5-category rubric (math accuracy / pedagogy / AP alignment /
consistency / style), and emits a STRUCTURED JSON verdict per concept
with severity-ranked issues. Generates `content/critiques/<id>.json`
per concept and a `SUMMARY.md` rollup.

Sample verdict:
```json
{
  "verdict": "issues_found",
  "overall_severity": "minor",
  "issues": [
    {
      "severity": "minor",
      "category": "math",
      "location": "checks[1].expected_answer_md",
      "description": "$3(5x)^2 \\cdot 5 = 75x^2$ should simplify to $375x^2$",
      "suggested_fix": "Change '= 75x^2' to '= 375x^2' in the expected answer."
    }
  ],
  "summary": "Mathematically sound and pedagogically strong overall."
}
```

Initial run (May 2026) across all 20 concepts found 2 critical
issues (mathematical contradictions in application problems) and 21
important issues (mostly AP-curriculum drift in advanced tiers).
Both critical issues were fixed; the remaining important issues are
documented and addressable iteratively.

---

## 9. Operator / dev workflows

### 9.1 Run the app locally

```bash
npm install
npx tsx scripts/authoring/runMigration.ts      # apply migrations 002–004
npx tsx scripts/authoring/seedContent.ts        # seed authored concepts
npx tsx scripts/authoring/seedVisuals.ts        # seed visuals
npm run build && npm run bundle                 # compile + bundle
npm run start                                   # boots server + warms Gemma (~25s)
# open http://localhost:3000
```

### 9.2 Deploy to Athena

The `[@CalcuLearn]` computer asset has the running stack. To redeploy:

```bash
# From the asset's sandbox:
cd /workspace/template
git pull
npm run build && npm run bundle
pkill -f "tsx src/server.ts"
nohup npm run start > /tmp/server.log 2>&1 &
```

Then use the `computer_asset_deploy` tool to refresh the public URL.

### 9.3 Verify content footprint

```bash
sqlite3 data/calculearn.sqlite "
  SELECT 'concepts',        COUNT(*) FROM concepts        UNION ALL
  SELECT 'explanations',    COUNT(*) FROM concept_explanations UNION ALL
  SELECT 'examples',        COUNT(*) FROM concept_examples     UNION ALL
  SELECT 'misconceptions',  COUNT(*) FROM concept_misconceptions UNION ALL
  SELECT 'checks',          COUNT(*) FROM concept_checks       UNION ALL
  SELECT 'deep_dives',      COUNT(*) FROM concept_deep_dives   UNION ALL
  SELECT 'applications',    COUNT(*) FROM concept_applications UNION ALL
  SELECT 'visuals',         COUNT(*) FROM concept_visuals      UNION ALL
  SELECT 'problems',        COUNT(*) FROM problems             UNION ALL
  SELECT 'stretch',         COUNT(*) FROM problems WHERE is_challenge=1;
"
```

Current expected counts:
| Resource | Count |
|---|---:|
| concepts | 20 |
| explanations | 80 |
| examples | 60 |
| misconceptions | 105 |
| checks | 120 |
| deep dives | 40 |
| applications | 40 |
| visuals | 20 |
| problems | 206 |
| stretch problems | 82 |

### 9.4 API endpoints quick reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | health check |
| `/api/session/begin` | POST | start Practice session |
| `/api/session/:id/submit` | POST | submit Practice answer |
| `/api/session/:id/hint` | POST | get Practice hint |
| `/api/learn/concepts` | GET | list authored concepts |
| `/api/learn/start` | POST | start Learn Mode session |
| `/api/learn/respond/:id` | POST | continue Learn Mode |
| `/api/challenge/concepts` | GET | list concepts w/ challenge counts |
| `/api/challenge/bundle/:id` | GET | get full bundle for a concept |
| `/api/challenge/application/feedback` | POST | feedback on app answer |
| `/api/challenge/deep-dive/probe` | POST | probe a reflection |
| `/api/teachback/start` | POST | start Teach-It-Back |
| `/api/teachback/respond/:id` | POST | continue Teach-It-Back |
| `/api/teachback/assess/:id` | POST | force final assessment |
| `/api/explore/start` | POST | start Explore session |
| `/api/explore/ask/:id` | POST | ask a question (accepts `pinConceptId`) |
| `/api/visuals/list` | GET | list visuals for a concept (filters: slot, tier) |
| `/api/adaptive/profile/:student` | GET | full adaptive profile across concepts |

### 9.5 Telemetry

- The A5 classifier logs aggregated tier-hit-rates every 30 turns:
  `[classifier] 30 turns: tiers T1=12 T2=2 T3=8 T4=3 T5=4 T6=1 (96.7% fast-path, avg 1842ms/turn)`
- The Explore router logs candidates + scores per question in the
  status line below the chat (visible in the UI)

---

## 10. What's NOT supported (yet)

These appear in the codebase but are deferred or stubbed:

| Feature | Status | Tracked in |
|---|---|---|
| Visuals on `deep_dive` / `application` slots | UI wiring in; no content authored yet | A1.3 (partial) |
| Related-rates beyond the ladder scenario | Only one hand-authored visual | A1.4 |
| Multiple related-rates per concept | Spec supports it; not authored | A1.4 |
| Authoring beyond AP Calc AB/BC | Out of scope | F |
| Audio I/O (TTS / STT) | Out of scope | F |
| Spaced repetition scheduling | Out of scope | F |
| Teacher dashboard | Not built | C1 |
| Daily classroom companion ("what did you cover today?") | Not built | B1 |
| Multi-student profiles | Single-student per browser today | C2 |
| PWA / offline install | Not packaged | D1 |
| Math input toolbar | Plain text only | D2 |
| Dark mode | CSS work pending | D3 |

See [ROADMAP.md](ROADMAP.md) for the full list and effort estimates.

---

## 11. Recipes — combine features

A few useful combinations:

### 11.1 "I bombed a Practice problem — how do I recover?"

1. Submit wrong answer in Practice
2. Click *Shaky* confidence chip
3. **Adaptive nudge appears** suggesting Learn Mode
4. Click into Learn Mode
5. Walk through to **done**
6. Click **Teach it back to lock it in**
7. Explain the concept in your own words
8. Read the assessment
9. Click **Try a Practice problem to lock it in** → back to Practice

### 11.2 "I'm bored with my homework — show me something cool"

1. Open **Explore** tab
2. Ask: *"What is the meaning of an integral?"*
3. Read the answer
4. Click chip: **A real-world use**
5. Click chip: **Why does this work?** → deep dive
6. Click chip: **Open Learn walkthrough** → full mode for the concept
7. End → **Teach it back** → assessment

### 11.3 "I want to push myself on a topic I know well"

1. In **Practice**, get 3 correct answers in a row on a concept
2. **Challenge tab gets a green dot** for that concept (adaptive unlock)
3. Click **Challenge**
4. Click the unlocked concept
5. Work through: 2 applications → 2 deep dives → 4-6 stretch problems
6. Each application: type your modeling approach → click **Check** for SLM feedback
7. End with **Teach it back** if you want the strongest mastery signal

### 11.4 "I'm prepping for an exam — how do I see everything?"

1. Open **Explore** tab
2. Ask each main topic in turn: *"What is X?"*
3. Use chips to drill: examples, deep dives, mistakes
4. For weak topics: click **Open Learn walkthrough** for the full Socratic experience
5. For strong topics: click **Teach it back** to verify mastery
6. Practice → Challenge for stretch

---

## 12. Citations

- The full v1 spec: see [@CalcuLearn v1 Spec — The Copilot Architecture](https://app.athenaintel.com/dashboard/spaces/?asset_ids=asset_fae30172-c0e5-4748-9747-173fcb840b5c&type=document)
- The implementation log: see [@CalcuLearn Phase A — Implementation Artifacts](https://app.athenaintel.com/dashboard/spaces/?asset_ids=asset_8ce32e10-7c81-41cb-be02-e4edcf84deb5&type=document)
- The roadmap: [ROADMAP.md](ROADMAP.md)
