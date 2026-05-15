/**
 * src/visuals/types.ts
 *
 * A Visual spec is a small declarative JSON object that gets stored in
 * concept_visuals.spec_json and rendered into an SVG (with optional
 * controls) at runtime by the UI.
 *
 * Each Visual is a discriminated union on the `kind` field. Keeping the
 * surface small and declarative means:
 *  - The same spec can be saved in SQLite, sent over the wire, and
 *    rendered on the client without any code-eval.
 *  - Adding a new kind is a single new case in src/visuals/render.ts.
 *  - Opus can author visuals as JSON later (A1.2) — exact same shape.
 */

/** Axis configuration shared by all 2-D primitives. */
export interface AxisConfig {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  /** Optional x-axis tick spacing (auto if omitted). */
  xStep?: number
  /** Optional y-axis tick spacing (auto if omitted). */
  yStep?: number
  /** Optional axis labels. */
  xLabel?: string
  yLabel?: string
}

/** A single point annotation drawn on top of a plot. */
export interface PointAnnotation {
  /** "x value" — can be a number or a binding to a control id (see Visual.controls). */
  x: number | { bind: string }
  /** "y value" — number, "f(x)" to use the function, or a control binding. */
  y: number | 'f(x)' | { bind: string }
  /** Optional label drawn next to the point. */
  label?: string
  /** open=ring (typical for a hole), filled=dot. */
  style?: 'open' | 'filled'
  /** Optional color. Defaults to the accent color. */
  color?: string
}

/** A line segment annotation (e.g. a secant, tangent, vertical asymptote). */
export interface LineAnnotation {
  /** Endpoints. Either explicit (x,y) or expressed in terms of a function and a control. */
  kind: 'segment' | 'tangent' | 'secant' | 'vertical' | 'horizontal'
  /** For 'segment': both endpoints required. */
  x0?: number | { bind: string }
  y0?: number | 'f(x)'
  x1?: number | { bind: string }
  y1?: number | 'f(x)'
  /** For 'tangent': at x = at (binding allowed). */
  at?: number | { bind: string }
  /** For 'secant': between two x values. */
  a?: number | { bind: string }
  b?: number | { bind: string }
  /** For 'vertical': x = c. For 'horizontal': y = c. */
  c?: number | { bind: string }
  label?: string
  color?: string
  /** Default 'solid'. */
  style?: 'solid' | 'dashed' | 'dotted'
}

/** A slider/picker the student can drag. */
export interface VisualControl {
  id: string                // unique within the spec
  label: string             // human-readable label rendered next to the slider
  kind: 'range' | 'integer' | 'choice'
  min?: number              // range/integer
  max?: number              // range/integer
  step?: number             // range only (default 0.01); integer step is always 1
  initial: number | string  // initial value
  choices?: Array<{ value: string; label: string }> // choice only
  /** Optional unit suffix shown after the value, e.g. "h" or "rectangles". */
  unit?: string
}

// ---------- Visual variants ----------

/**
 * 'function_plot' — y = f(x) over [xMin, xMax]. Optional annotations.
 * The simplest primitive — also the building block under everything else.
 */
export interface FunctionPlotVisual {
  kind: 'function_plot'
  /** Plain-math expression in x, e.g. "x^2", "sin(x)", "1/(1+x^2)". */
  expression: string
  axes: AxisConfig
  points?: PointAnnotation[]
  lines?: LineAnnotation[]
  /** Optional extra curves. Each is a separate expression. */
  curves?: Array<{ expression: string; color?: string; style?: 'solid' | 'dashed' }>
  controls?: VisualControl[]
}

/**
 * 'secant_to_tangent' — the derivative-as-limit picture.
 * Renders f(x) plus a secant line from (a, f(a)) to (a+h, f(a+h)). The student
 * drags h toward 0 and watches the secant become the tangent.
 */
export interface SecantToTangentVisual {
  kind: 'secant_to_tangent'
  expression: string
  axes: AxisConfig
  /** The fixed x-coordinate around which the secant is drawn. */
  a: number
  /** Initial h value for the slider. */
  hInitial: number
  hMin: number
  hMax: number
  /** Caption shown next to the slider. */
  hLabel?: string
}

/**
 * 'riemann_sum' — area-under-curve rectangles over [a, b] with n rectangles.
 * Student toggles left/right/midpoint and drags n up.
 */
export interface RiemannSumVisual {
  kind: 'riemann_sum'
  expression: string
  axes: AxisConfig
  a: number
  b: number
  nInitial: number
  nMin: number
  nMax: number
  /** Methods the student can toggle between. */
  methods?: Array<'left' | 'right' | 'midpoint'>
}

/**
 * 'accumulation' — F(x) = integral from a to x of f(t) dt, drawn as the area
 * accumulated under the curve up to a draggable x. Renders f(t) on top, the
 * filled area as the student drags x, and the value of F(x) below.
 */
export interface AccumulationVisual {
  kind: 'accumulation'
  expression: string
  axes: AxisConfig
  a: number
  xInitial: number
  xMin: number
  xMax: number
}

/**
 * 'limit_approach' — function with an optional hole at x = c. Shows numerical
 * values f(c - epsilon) and f(c + epsilon) as the student decreases epsilon,
 * illustrating the limit from both sides.
 */
export interface LimitApproachVisual {
  kind: 'limit_approach'
  expression: string
  axes: AxisConfig
  /** The point of interest. */
  c: number
  /** Initial epsilon value. */
  epsilonInitial: number
  epsilonMin: number
  epsilonMax: number
  /** If true, render a hole (open circle) at x = c. */
  hole?: boolean
  /** Optional limit value to label. */
  limitValue?: number
}

/**
 * 'slope_field' — direction field for a first-order ODE y' = f(x, y).
 * Draws short tangent line segments at a grid of (x, y) points whose slopes
 * are given by the expression. Optionally overlays one or more particular
 * solution curves traced by Euler's method, anchored at user-draggable
 * initial conditions.
 */
export interface SlopeFieldVisual {
  kind: 'slope_field'
  /** Expression in x and y, e.g. "x*y", "y - x", "-x/y", "0.5*y*(1 - y/10)". */
  expression: string
  axes: AxisConfig
  /** Grid density along each axis. Defaults to 12. */
  gridX?: number
  gridY?: number
  /**
   * Initial conditions to trace. Each becomes a solution curve. The first
   * one is also exposed as a draggable point (the student can move the
   * initial condition and watch the solution morph).
   */
  initialConditions?: Array<{ x: number; y: number; color?: string; label?: string }>
  /**
   * Step size for Euler integration. Smaller = more accurate but slower.
   * Defaults to (axes.xMax - axes.xMin) / 200.
   */
  stepSize?: number
}

/**
 * 'related_rates' — animated scenario for related-rates problems.
 *
 * Declarative time-driven scene: one or more state variables driven by
 * expressions in t (time), and one or more drawables (circle, line,
 * rect, polygon, polyline, point, text) whose attributes reference
 * those state variables. The student scrubs a time slider and watches
 * the configuration evolve while a readout shows the current values
 * and rates of change.
 *
 * Coordinates are in axis units, not pixels — same as every other
 * primitive. The renderer maps them through the AxisConfig.
 */
export type RRDrawableKind = 'circle' | 'line' | 'segment' | 'rect' | 'polygon' | 'polyline' | 'point' | 'text'

export interface RRStateVar {
  /** Variable name (e.g. "r", "h", "theta"). Must be a-z, 0-9, underscore. */
  name: string
  /** Expression in t (time). e.g. "5 - 0.2*t", "sqrt(100 - t^2)". */
  expression: string
}

export interface RRDrawable {
  kind: RRDrawableKind
  /** Each attribute is either a numeric constant or an expression in t + state vars. */
  attrs: Record<string, number | string>
  /** Optional stroke / fill / style hints (passed through to SVG). */
  stroke?: string
  fill?: string
  strokeWidth?: number
  dash?: 'solid' | 'dashed' | 'dotted'
  /** Optional label drawn near the drawable. */
  label?: string
  /** Label anchor offset in axis units. */
  labelOffset?: { dx: number; dy: number }
}

export interface RRReadout {
  /** Variable name to display. Can be a state var OR a computed expression. */
  label: string
  expression: string
  /** Optional sprintf-style format: "%.2f". Defaults to one-decimal. */
  format?: string
  /** Unit suffix to append (e.g. "m", "rad/s"). */
  unit?: string
}

export interface RelatedRatesVisual {
  kind: 'related_rates'
  axes: AxisConfig
  /** Hide axis grid + ticks for a cleaner diagram. Default false. */
  hideAxes?: boolean
  /** State variables, evaluated in order (later ones may reference earlier ones). */
  state: RRStateVar[]
  /** Drawables, rendered in order (later ones appear on top). */
  drawables: RRDrawable[]
  /** Live readouts shown below the diagram. */
  readouts?: RRReadout[]
  /** Time slider configuration. */
  tInitial: number
  tMin: number
  tMax: number
  tStep?: number
  /** Optional label for the time variable (default "t"). */
  tLabel?: string
}

export type Visual =
  | FunctionPlotVisual
  | SecantToTangentVisual
  | RiemannSumVisual
  | AccumulationVisual
  | LimitApproachVisual
  | SlopeFieldVisual
  | RelatedRatesVisual

/** Row-level wrapper as stored in concept_visuals. */
export interface ConceptVisual {
  id: number
  conceptId: string
  slot: 'explanation' | 'example' | 'deep_dive' | 'application' | 'hero'
  tier: 'novice' | 'on_pace' | 'advanced' | null
  title: string | null
  captionMd: string | null
  spec: Visual
  displayOrder: number
}
