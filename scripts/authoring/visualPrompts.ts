/**
 * scripts/authoring/visualPrompts.ts
 *
 * Opus prompts for A1.2 — auto-author one inline visual per concept.
 *
 * Constraints:
 *   1. Output MUST be valid JSON matching one of our 6 primitives.
 *   2. The visual must be PEDAGOGICALLY MEANINGFUL — not just an arbitrary
 *      f(x) = ... plot, but something that illustrates the *concept*.
 *   3. Expressions must use ONLY the operators our parser supports:
 *      + - * / ^ ( ) sin cos tan asin acos atan sinh cosh tanh
 *      exp log ln sqrt abs floor ceil round, plus constants pi and e.
 *      Variables: x (always) and y (only for slope_field).
 *      No implicit multiplication issues — write "2*x" not "2x".
 *   4. The caption MUST be short, in plain student-facing language, and
 *      tell the student exactly what to DO with the visual (drag h,
 *      slide n, etc.).
 */

import type { Tier } from './authoringPrompts.js'

export const VISUAL_SYSTEM = `
You are an expert AP Calculus AB/BC content author choosing the single best
interactive visual to illustrate a concept inside the CalcuLearn app.

You have SIX primitives to choose from. Use the one that best fits the
concept — don't force-fit. The goal is for the student to SEE the idea
move, not just see a static plot.

PRIMITIVES:

1. "function_plot" — static y = f(x) curve with optional dots and lines.
   Use when: showing a single function or a feature on it (asymptote, hole,
   tangent line at a fixed point, two curves overlaid).
   Slider/interactivity: NONE.

2. "secant_to_tangent" — y = f(x) with a movable secant line at (a, a+h).
   Slider: h, with the student dragging it toward 0.
   Use when: the concept is about THE DERIVATIVE AS A LIMIT or how local
   linearization works. Pick a simple function with a clear-slope anchor.

3. "riemann_sum" — y = f(x) over [a, b] with n rectangles.
   Sliders: n (number of rectangles), method (left/right/midpoint toggle).
   Use when: the concept is about RIEMANN SUMS or the INTEGRAL AS A LIMIT.

4. "accumulation" — y = f(x) plus a filled area from a to a draggable x,
   showing F(x) = integral_a^x f(t) dt in real time.
   Slider: x (sweeps right; the area grows).
   Use when: the concept is about THE FUNDAMENTAL THEOREM or the
   accumulation interpretation of the integral.

5. "limit_approach" — y = f(x) with a hole at x = c and two dots showing
   f(c - eps) and f(c + eps).
   Slider: eps (the student squeezes it toward 0).
   Use when: the concept is about LIMITS, especially limits where the
   function is undefined at the point of interest.

6. "slope_field" — short tangent segments at a grid of (x, y) points where
   slopes come from y' = f(x, y). Optionally one or more particular
   solutions traced via Euler's method, with a draggable initial condition.
   Use when: the concept is about A FIRST-ORDER ODE (separable, linear,
   logistic, etc).

EXPRESSION RULES (CRITICAL):
- Use ONLY these operators: + - * / ^ ( )
- Use ONLY these functions: sin cos tan asin acos atan sinh cosh tanh
  exp log ln sqrt abs floor ceil round
- Use ONLY these constants: pi, e
- ALWAYS write multiplication explicitly: "2*x" not "2x", "3*(x+1)" not "3(x+1)"
- Variables: "x" for all primitives. "y" is ONLY allowed in slope_field's expression.

AXES RULES:
- Pick a range that ACTUALLY shows the concept. Too zoomed-in misses context;
  too zoomed-out makes features invisible.
- xMin/xMax/yMin/yMax: prefer values within plus/minus 10.
- COMPUTE the function at xMin, xMid, xMax. Set yMin and yMax to bracket
  those values with at least 20% padding on each side. NEVER let the
  curve exit the plot box at the chosen x range.
- If the function is positive-only (e^x, x^2, |x|), set yMin = 0 or
  slightly negative.
- If the function is monotone-increasing and at xMax it equals 5, set
  yMax = 6.5 (not 70). If it equals 70, set xMax smaller until the
  value at xMax is reasonable (~10x the typical mid-range value).

CAPTION RULES:
- 1-3 sentences. Plain English. Use LaTeX for math (inline: $f(x)$, block: $$...$$).
- Tell the student what to DO. "Drag h toward 0...", "Slide n up...", "Drag the dot..."
- End with one concrete observation the student should make.
- No emojis. No exclamation marks.

OUTPUT FORMAT:
- Output ONLY a JSON object — no prose, no markdown fences, no commentary.
- The object must match the schema for the primitive you chose:

  function_plot:    { "slot": "explanation", "title": "...", "caption_md": "...",
                      "spec": { "kind": "function_plot", "expression": "...",
                                "axes": {...},
                                "points"?: [{ "x": n, "y": n | "f(x)", "label"?: "...",
                                              "style"?: "filled" | "open" }],
                                "lines"?:  [{ "kind": "tangent", "at": n, "label"?: "...", "style"?: "solid" | "dashed" }
                                            | { "kind": "secant", "a": n, "b": n, "label"?: "...", "style"?: "solid" | "dashed" }
                                            | { "kind": "vertical", "c": n, "label"?: "...", "style"?: "dashed" }
                                            | { "kind": "horizontal", "c": n, "label"?: "...", "style"?: "dashed" }
                                            | { "kind": "segment", "x0": n, "y0": n | "f(x)",
                                                "x1": n, "y1": n | "f(x)", "label"?: "...", "style"?: "solid" | "dashed" }],
                                "curves"?: [{ "expression": "...", "color"?: "#hex",
                                              "style"?: "solid" | "dashed" }] } }
  secant_to_tangent: { "slot": "explanation", "title": "...", "caption_md": "...",
                       "spec": { "kind": "secant_to_tangent", "expression": "...",
                                 "axes": {...}, "a": <number>, "hInitial": <0..2>,
                                 "hMin": 0.01, "hMax": 2, "hLabel": "h" } }
  riemann_sum:      { "slot": "explanation", "title": "...", "caption_md": "...",
                      "spec": { "kind": "riemann_sum", "expression": "...",
                                "axes": {...}, "a": <number>, "b": <number>,
                                "nInitial": 4, "nMin": 1, "nMax": 40,
                                "methods": ["left", "right", "midpoint"] } }
  accumulation:     { "slot": "explanation", "title": "...", "caption_md": "...",
                      "spec": { "kind": "accumulation", "expression": "...",
                                "axes": {...}, "a": <number>, "xInitial": <number>,
                                "xMin": <number>, "xMax": <number> } }
  limit_approach:   { "slot": "explanation", "title": "...", "caption_md": "...",
                      "spec": { "kind": "limit_approach", "expression": "...",
                                "axes": {...}, "c": <number>, "epsilonInitial": 0.5,
                                "epsilonMin": 0.01, "epsilonMax": 1.5,
                                "hole": <bool>, "limitValue"?: <number> } }
  slope_field:      { "slot": "explanation", "title": "...", "caption_md": "...",
                      "spec": { "kind": "slope_field", "expression": "<f(x,y)>",
                                "axes": {...}, "gridX": 12, "gridY": 12,
                                "initialConditions": [{ "x": ..., "y": ..., "label": "..." }] } }

Always set "slot" to "explanation".
`.trim()

export function visualPromptForConcept(args: {
  conceptId: string
  conceptName: string
  oneLiner: string
  groundTruthExplanation: string
}): { system: string; user: string } {
  return {
    system: VISUAL_SYSTEM,
    user: `
CONCEPT: ${args.conceptName} (id: ${args.conceptId})
ONE-LINER: ${args.oneLiner}

GROUND-TRUTH EXPLANATION (this is what the student just read; the visual
should illustrate THIS):
${args.groundTruthExplanation}

TASK:
Choose the SINGLE best primitive for this concept and emit one JSON object
matching the schema. Be pedagogical, not flashy. If the concept is about
limits, lean toward limit_approach. If it's about a derivative as a slope,
lean toward secant_to_tangent or function_plot with a tangent line. If it's
about integrals as accumulation/area, lean toward riemann_sum or accumulation.

Output ONLY the JSON. No prose. No markdown fences.
`.trim(),
  }
}

// Hint specs for which primitive is most appropriate for each concept. These
// are HINTS, not constraints — Opus may pick differently if it has reason.
// We pass these only when we want to nudge Opus away from a common wrong
// choice (e.g. "function_plot" being the lazy default for everything).
export const PRIMITIVE_HINTS: Record<string, string> = {
  'limits.one-sided': 'limit_approach with hole=true OR a piecewise-looking function plot showing the jump',
  'limits.infinity': 'function_plot with horizontal asymptote line annotation',
  'limits.lhopital': 'function_plot showing a 0/0 form near a point',
  'continuity.definition': 'function_plot or limit_approach showing continuity vs. a hole',
  'continuity.types': 'function_plot showing one type of discontinuity (hole, jump, or asymptote)',
  'deriv.chain-rule': 'function_plot with tangent line at a composition like sin(x^2)',
  'deriv.product-rule': 'function_plot of u(x)*v(x) with tangent line at a chosen x',
  'deriv.quotient-rule': 'function_plot of u(x)/v(x) with tangent line at a chosen x',
  'deriv.implicit': 'function_plot of an implicit curve, with tangent line annotation',
  'deriv.related-rates': 'function_plot showing one of the variables vs. time',
  'deriv.optimisation': 'function_plot of a single-variable function with the minimum/maximum point marked',
  'integ.substitution': 'function_plot of an integrand that simplifies after u-substitution',
  'integ.by-parts': 'function_plot of x*e^x or similar product, plus an accumulation primitive',
  'integ.definite-apps': 'accumulation showing area under a velocity curve = displacement',
}
