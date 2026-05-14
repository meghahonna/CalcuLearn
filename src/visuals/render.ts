/**
 * src/visuals/render.ts
 *
 * Render a Visual spec into a self-contained DOM tree: SVG + optional
 * controls (sliders, segmented toggles) that re-render the SVG on change.
 *
 * Design rules:
 *   - Pure DOM, no framework, no dependencies.
 *   - All math evaluation goes through compileExpression() — no eval.
 *   - Re-rendering is cheap: we recompile expressions ONCE at mount,
 *     then call the compiled functions on every slider change.
 *   - Each visual is dimensioned in a parent container that owns the
 *     responsive width. Internally we render to a fixed viewBox.
 */

import { compileExpression } from './expr.js'
import type {
  Visual,
  AxisConfig,
  FunctionPlotVisual,
  SecantToTangentVisual,
  RiemannSumVisual,
  AccumulationVisual,
  LimitApproachVisual,
} from './types.js'

// ---------- constants ----------

const VB_W = 480 // viewBox width
const VB_H = 320 // viewBox height
const PAD = { top: 16, right: 16, bottom: 32, left: 40 }
const PLOT_W = VB_W - PAD.left - PAD.right
const PLOT_H = VB_H - PAD.top - PAD.bottom

const SVG_NS = 'http://www.w3.org/2000/svg'

const COLOR = {
  curve: '#2563eb',         // primary curve color (accent blue)
  tangent: '#16a34a',       // green for the limiting/tangent line
  secant: '#ea580c',         // orange for the moving secant
  rect: '#2563eb',           // riemann rectangles (with alpha)
  rectStroke: '#1e3a8a',
  area: '#2563eb',           // accumulation area
  axis: '#cbd5e1',           // light gray for axes
  axisText: '#64748b',       // muted for tick labels
  hole: '#ef4444',           // red for a hole at a point
  point: '#2563eb',
  grid: '#f1f5f9',
}

// ---------- helpers ----------

function el(tag: string, attrs: Record<string, string | number> = {}, parent?: Element): SVGElement {
  const e = document.createElementNS(SVG_NS, tag) as SVGElement
  for (const [k, v] of Object.entries(attrs)) {
    e.setAttribute(k, String(v))
  }
  if (parent) parent.appendChild(e)
  return e
}

interface AxisTransform {
  toX(x: number): number
  toY(y: number): number
  axes: AxisConfig
}

function mkAxisTransform(axes: AxisConfig): AxisTransform {
  const xRange = axes.xMax - axes.xMin
  const yRange = axes.yMax - axes.yMin
  return {
    axes,
    toX(x: number): number {
      return PAD.left + ((x - axes.xMin) / xRange) * PLOT_W
    },
    toY(y: number): number {
      return PAD.top + (1 - (y - axes.yMin) / yRange) * PLOT_H
    },
  }
}

function autoStep(range: number): number {
  // Pick a tick spacing that gives ~5-8 ticks
  const rough = range / 6
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  let nice: number
  if (norm < 1.5) nice = 1
  else if (norm < 3) nice = 2
  else if (norm < 7) nice = 5
  else nice = 10
  return nice * mag
}

function formatTick(v: number): string {
  if (Math.abs(v) < 1e-10) return '0'
  // Avoid -0
  if (Object.is(v, -0)) v = 0
  if (Math.abs(v) >= 100) return v.toFixed(0)
  if (Math.abs(v) >= 10) return v.toFixed(1).replace(/\.0$/, '')
  return v.toFixed(2).replace(/\.?0+$/, '')
}

function drawAxes(svg: SVGElement, t: AxisTransform): void {
  const xStep = t.axes.xStep ?? autoStep(t.axes.xMax - t.axes.xMin)
  const yStep = t.axes.yStep ?? autoStep(t.axes.yMax - t.axes.yMin)

  // Plot area background
  el('rect', {
    x: PAD.left, y: PAD.top, width: PLOT_W, height: PLOT_H,
    fill: '#fff', stroke: COLOR.axis, 'stroke-width': 1,
  }, svg)

  // Vertical gridlines + x ticks
  const startX = Math.ceil(t.axes.xMin / xStep) * xStep
  for (let x = startX; x <= t.axes.xMax + 1e-9; x += xStep) {
    const px = t.toX(x)
    el('line', {
      x1: px, y1: PAD.top, x2: px, y2: PAD.top + PLOT_H,
      stroke: COLOR.grid, 'stroke-width': 1,
    }, svg)
    const tickLabel = el('text', {
      x: px, y: PAD.top + PLOT_H + 14,
      'text-anchor': 'middle', 'font-size': 10, fill: COLOR.axisText,
    }, svg)
    tickLabel.textContent = formatTick(x)
  }

  // Horizontal gridlines + y ticks
  const startY = Math.ceil(t.axes.yMin / yStep) * yStep
  for (let y = startY; y <= t.axes.yMax + 1e-9; y += yStep) {
    const py = t.toY(y)
    el('line', {
      x1: PAD.left, y1: py, x2: PAD.left + PLOT_W, y2: py,
      stroke: COLOR.grid, 'stroke-width': 1,
    }, svg)
    const tickLabel = el('text', {
      x: PAD.left - 4, y: py + 3,
      'text-anchor': 'end', 'font-size': 10, fill: COLOR.axisText,
    }, svg)
    tickLabel.textContent = formatTick(y)
  }

  // x = 0 axis line
  if (t.axes.xMin <= 0 && t.axes.xMax >= 0) {
    const x0 = t.toX(0)
    el('line', {
      x1: x0, y1: PAD.top, x2: x0, y2: PAD.top + PLOT_H,
      stroke: COLOR.axis, 'stroke-width': 1.2,
    }, svg)
  }
  // y = 0 axis line
  if (t.axes.yMin <= 0 && t.axes.yMax >= 0) {
    const y0 = t.toY(0)
    el('line', {
      x1: PAD.left, y1: y0, x2: PAD.left + PLOT_W, y2: y0,
      stroke: COLOR.axis, 'stroke-width': 1.2,
    }, svg)
  }

  // Axis labels
  if (t.axes.xLabel) {
    const lab = el('text', {
      x: PAD.left + PLOT_W / 2, y: VB_H - 4,
      'text-anchor': 'middle', 'font-size': 11, fill: COLOR.axisText,
    }, svg)
    lab.textContent = t.axes.xLabel
  }
  if (t.axes.yLabel) {
    const lab = el('text', {
      x: 12, y: PAD.top + PLOT_H / 2,
      'text-anchor': 'middle', 'font-size': 11, fill: COLOR.axisText,
      transform: `rotate(-90 12 ${PAD.top + PLOT_H / 2})`,
    }, svg)
    lab.textContent = t.axes.yLabel
  }
}

/**
 * Sample a function across [xMin, xMax] and return an SVG path "d" string.
 * NaN samples (e.g. division by zero) start a new sub-path with M.
 */
function samplePath(
  f: (env: Record<string, number>) => number,
  t: AxisTransform,
  extraEnv: Record<string, number> = {},
  samples = 240
): string {
  const { xMin, xMax } = t.axes
  const dx = (xMax - xMin) / samples
  let d = ''
  let penDown = false
  for (let i = 0; i <= samples; i++) {
    const x = xMin + i * dx
    const y = f({ ...extraEnv, x })
    if (!Number.isFinite(y) || y < t.axes.yMin - 1 || y > t.axes.yMax + 1) {
      penDown = false
      continue
    }
    const px = t.toX(x)
    const py = t.toY(y)
    d += penDown ? `L${px.toFixed(2)},${py.toFixed(2)}` : `M${px.toFixed(2)},${py.toFixed(2)}`
    penDown = true
  }
  return d
}

// Build an SVG element with the standard viewBox.
function makeSvg(): SVGElement {
  const svg = el('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    width: '100%',
    height: 'auto',
    role: 'img',
    'aria-label': 'CalcuLearn visual',
  })
  ;(svg as SVGSVGElement).style.maxWidth = '560px'
  ;(svg as SVGSVGElement).style.display = 'block'
  return svg
}

// ---------- Controls ----------

interface SliderSpec {
  id: string
  label: string
  min: number
  max: number
  step: number
  initial: number
  unit?: string
  /** integer slider clamps to whole numbers. */
  integer?: boolean
  onInput: (value: number) => void
}

interface ChoiceSpec {
  id: string
  label: string
  choices: Array<{ value: string; label: string }>
  initial: string
  onChange: (value: string) => void
}

function mkSlider(spec: SliderSpec): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'visual-control visual-control-slider'
  const labelText = document.createElement('label')
  labelText.htmlFor = `vc-${spec.id}`
  labelText.className = 'visual-control-label'
  const valSpan = document.createElement('span')
  valSpan.className = 'visual-control-value'
  valSpan.textContent = spec.integer
    ? String(Math.round(spec.initial))
    : spec.initial.toFixed(spec.step >= 0.1 ? 2 : 3)
  labelText.textContent = `${spec.label}: `
  labelText.appendChild(valSpan)
  if (spec.unit) {
    const u = document.createElement('span')
    u.className = 'visual-control-unit'
    u.textContent = ` ${spec.unit}`
    labelText.appendChild(u)
  }
  const input = document.createElement('input')
  input.type = 'range'
  input.id = `vc-${spec.id}`
  input.min = String(spec.min)
  input.max = String(spec.max)
  input.step = String(spec.step)
  input.value = String(spec.initial)
  input.className = 'visual-control-input'
  input.addEventListener('input', () => {
    const v = spec.integer ? Math.round(Number(input.value)) : Number(input.value)
    valSpan.textContent = spec.integer ? String(v) : v.toFixed(spec.step >= 0.1 ? 2 : 3)
    spec.onInput(v)
  })
  wrap.appendChild(labelText)
  wrap.appendChild(input)
  return wrap
}

function mkChoice(spec: ChoiceSpec): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'visual-control visual-control-choice'
  const labelText = document.createElement('span')
  labelText.className = 'visual-control-label'
  labelText.textContent = `${spec.label}: `
  wrap.appendChild(labelText)
  const group = document.createElement('div')
  group.className = 'visual-control-segments'
  spec.choices.forEach((c) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = c.label
    btn.dataset['value'] = c.value
    btn.className = c.value === spec.initial
      ? 'visual-control-segment active'
      : 'visual-control-segment'
    btn.addEventListener('click', () => {
      group.querySelectorAll('.visual-control-segment').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      spec.onChange(c.value)
    })
    group.appendChild(btn)
  })
  wrap.appendChild(group)
  return wrap
}

// ---------- Per-kind renderers ----------

function renderFunctionPlot(v: FunctionPlotVisual): HTMLElement {
  const container = document.createElement('div')
  container.className = 'visual'
  const t = mkAxisTransform(v.axes)

  const f = compileExpression(v.expression)
  const svg = makeSvg()
  container.appendChild(svg)
  drawAxes(svg, t)

  // Main curve
  el('path', { d: samplePath(f, t), fill: 'none', stroke: COLOR.curve, 'stroke-width': 2 }, svg)

  // Extra curves
  if (v.curves) {
    for (const c of v.curves) {
      const fc = compileExpression(c.expression)
      el('path', {
        d: samplePath(fc, t),
        fill: 'none',
        stroke: c.color ?? COLOR.tangent,
        'stroke-width': 2,
        'stroke-dasharray': c.style === 'dashed' ? '5,4' : '0',
      }, svg)
    }
  }

  // Points
  if (v.points) {
    for (const p of v.points) {
      const xv = typeof p.x === 'number' ? p.x : NaN  // bind not supported in static spec
      if (!Number.isFinite(xv)) continue
      let yv: number
      if (p.y === 'f(x)') yv = f({ x: xv })
      else if (typeof p.y === 'number') yv = p.y
      else continue
      if (!Number.isFinite(yv)) continue
      const cx = t.toX(xv), cy = t.toY(yv)
      const filled = (p.style ?? 'filled') === 'filled'
      el('circle', {
        cx, cy, r: 4,
        fill: filled ? (p.color ?? COLOR.point) : '#fff',
        stroke: p.color ?? COLOR.point,
        'stroke-width': 1.6,
      }, svg)
      if (p.label) {
        const lab = el('text', {
          x: cx + 6, y: cy - 6,
          'font-size': 10, fill: COLOR.axisText,
        }, svg)
        lab.textContent = p.label
      }
    }
  }

  // Lines (vertical asymptotes etc — static only)
  if (v.lines) {
    for (const ln of v.lines) {
      if (ln.kind === 'vertical' && typeof ln.c === 'number') {
        const px = t.toX(ln.c)
        el('line', {
          x1: px, y1: PAD.top, x2: px, y2: PAD.top + PLOT_H,
          stroke: ln.color ?? COLOR.hole,
          'stroke-width': 1.6,
          'stroke-dasharray': ln.style === 'dashed' ? '5,4' : '3,3',
        }, svg)
      } else if (ln.kind === 'horizontal' && typeof ln.c === 'number') {
        const py = t.toY(ln.c)
        el('line', {
          x1: PAD.left, y1: py, x2: PAD.left + PLOT_W, y2: py,
          stroke: ln.color ?? COLOR.tangent,
          'stroke-width': 1.6,
          'stroke-dasharray': ln.style === 'dashed' ? '5,4' : '3,3',
        }, svg)
      }
    }
  }

  return container
}

function renderSecantToTangent(v: SecantToTangentVisual): HTMLElement {
  const container = document.createElement('div')
  container.className = 'visual'
  const t = mkAxisTransform(v.axes)
  const f = compileExpression(v.expression)
  const svg = makeSvg()
  container.appendChild(svg)
  drawAxes(svg, t)

  // Static curve
  el('path', { d: samplePath(f, t), fill: 'none', stroke: COLOR.curve, 'stroke-width': 2 }, svg)

  // Anchor point at (a, f(a))
  const fa = f({ x: v.a })
  if (Number.isFinite(fa)) {
    el('circle', { cx: t.toX(v.a), cy: t.toY(fa), r: 4, fill: COLOR.curve }, svg)
    const lab = el('text', {
      x: t.toX(v.a) + 6, y: t.toY(fa) - 6, 'font-size': 10, fill: COLOR.axisText,
    }, svg)
    lab.textContent = `(${formatTick(v.a)}, ${formatTick(fa)})`
  }

  // Secant line (will be updated by slider)
  const secant = el('line', {
    x1: 0, y1: 0, x2: 0, y2: 0,
    stroke: COLOR.secant, 'stroke-width': 2,
  }, svg) as SVGLineElement
  const secantDot = el('circle', { cx: 0, cy: 0, r: 4, fill: COLOR.secant }, svg) as SVGCircleElement
  const slopeLabel = el('text', {
    x: PAD.left + PLOT_W - 4, y: PAD.top + 14,
    'text-anchor': 'end', 'font-size': 11, fill: COLOR.secant, 'font-weight': '600',
  }, svg) as SVGTextElement

  function update(h: number): void {
    const x1 = v.a + h
    const y0 = f({ x: v.a })
    const y1 = f({ x: x1 })
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) return
    // Extend the secant across the plot for "line, not segment" feel
    const slope = (y1 - y0) / h
    const xL = v.axes.xMin
    const xR = v.axes.xMax
    const yL = y0 + slope * (xL - v.a)
    const yR = y0 + slope * (xR - v.a)
    secant.setAttribute('x1', String(t.toX(xL)))
    secant.setAttribute('y1', String(t.toY(yL)))
    secant.setAttribute('x2', String(t.toX(xR)))
    secant.setAttribute('y2', String(t.toY(yR)))
    secantDot.setAttribute('cx', String(t.toX(x1)))
    secantDot.setAttribute('cy', String(t.toY(y1)))
    const isSmall = Math.abs(h) < 0.05
    slopeLabel.textContent = `slope ≈ ${formatTick(slope)}${isSmall ? ' (≈ tangent)' : ''}`
  }
  update(v.hInitial)

  // Controls
  const controls = document.createElement('div')
  controls.className = 'visual-controls'
  controls.appendChild(mkSlider({
    id: 'h',
    label: v.hLabel ?? 'h',
    min: v.hMin,
    max: v.hMax,
    step: 0.01,
    initial: v.hInitial,
    onInput: (val) => update(val),
  }))
  container.appendChild(controls)
  return container
}

function renderRiemannSum(v: RiemannSumVisual): HTMLElement {
  const container = document.createElement('div')
  container.className = 'visual'
  const t = mkAxisTransform(v.axes)
  const f = compileExpression(v.expression)
  const svg = makeSvg()
  container.appendChild(svg)
  drawAxes(svg, t)

  // Curve
  el('path', { d: samplePath(f, t), fill: 'none', stroke: COLOR.curve, 'stroke-width': 2 }, svg)

  // Rectangles group (cleared on every update)
  const group = el('g', {}, svg)
  const sumLabel = el('text', {
    x: PAD.left + PLOT_W - 4, y: PAD.top + 14,
    'text-anchor': 'end', 'font-size': 11, fill: COLOR.rectStroke, 'font-weight': '600',
  }, svg) as SVGTextElement

  let currentN = v.nInitial
  let currentMethod: 'left' | 'right' | 'midpoint' = (v.methods?.[0] ?? 'left') as 'left' | 'right' | 'midpoint'

  function update(): void {
    while (group.firstChild) group.removeChild(group.firstChild)
    const n = Math.max(1, Math.round(currentN))
    const dx = (v.b - v.a) / n
    const baseY = Math.max(0, v.axes.yMin)
    const baseYPx = t.toY(baseY)
    let sum = 0
    for (let i = 0; i < n; i++) {
      const xl = v.a + i * dx
      const xr = xl + dx
      let sx: number
      if (currentMethod === 'left') sx = xl
      else if (currentMethod === 'right') sx = xr
      else sx = (xl + xr) / 2
      const h = f({ x: sx })
      if (!Number.isFinite(h)) continue
      sum += h * dx
      const topY = t.toY(h)
      const yTop = Math.min(topY, baseYPx)
      const height = Math.abs(topY - baseYPx)
      el('rect', {
        x: t.toX(xl),
        y: yTop,
        width: t.toX(xr) - t.toX(xl),
        height,
        fill: COLOR.rect,
        'fill-opacity': '0.25',
        stroke: COLOR.rectStroke,
        'stroke-width': 1,
      }, group)
    }
    sumLabel.textContent = `S ≈ ${formatTick(sum)}  (n=${n}, ${currentMethod})`
  }
  update()

  // Controls
  const controls = document.createElement('div')
  controls.className = 'visual-controls'
  controls.appendChild(mkSlider({
    id: 'n',
    label: 'n',
    min: v.nMin,
    max: v.nMax,
    step: 1,
    initial: v.nInitial,
    integer: true,
    unit: 'rect',
    onInput: (val) => { currentN = val; update() },
  }))
  if (v.methods && v.methods.length > 1) {
    controls.appendChild(mkChoice({
      id: 'method',
      label: 'method',
      choices: v.methods.map((m) => ({ value: m, label: m })),
      initial: currentMethod,
      onChange: (val) => { currentMethod = val as 'left' | 'right' | 'midpoint'; update() },
    }))
  }
  container.appendChild(controls)
  return container
}

function renderAccumulation(v: AccumulationVisual): HTMLElement {
  const container = document.createElement('div')
  container.className = 'visual'
  const t = mkAxisTransform(v.axes)
  const f = compileExpression(v.expression)
  const svg = makeSvg()
  container.appendChild(svg)
  drawAxes(svg, t)

  // Curve
  el('path', { d: samplePath(f, t), fill: 'none', stroke: COLOR.curve, 'stroke-width': 2 }, svg)

  // Filled area path (rebuilt on update)
  const area = el('path', { d: '', fill: COLOR.area, 'fill-opacity': '0.2' }, svg) as SVGPathElement
  const vertical = el('line', {
    x1: 0, y1: PAD.top, x2: 0, y2: PAD.top + PLOT_H,
    stroke: COLOR.tangent, 'stroke-width': 1.5, 'stroke-dasharray': '4,3',
  }, svg) as SVGLineElement
  const fxLabel = el('text', {
    x: PAD.left + PLOT_W - 4, y: PAD.top + 14,
    'text-anchor': 'end', 'font-size': 11, fill: COLOR.tangent, 'font-weight': '600',
  }, svg) as SVGTextElement

  function update(x: number): void {
    // Sample area from a to x as a polygon
    if (x <= v.a + 1e-6) {
      area.setAttribute('d', '')
      vertical.setAttribute('x1', String(t.toX(v.a)))
      vertical.setAttribute('x2', String(t.toX(v.a)))
      fxLabel.textContent = `F(${formatTick(v.a)}) = 0`
      return
    }
    const samples = 100
    const dx = (x - v.a) / samples
    const baseY = 0
    let d = `M${t.toX(v.a).toFixed(2)},${t.toY(baseY).toFixed(2)}`
    let sum = 0
    for (let i = 0; i <= samples; i++) {
      const xi = v.a + i * dx
      const yi = f({ x: xi })
      const ys = Number.isFinite(yi) ? yi : 0
      d += `L${t.toX(xi).toFixed(2)},${t.toY(ys).toFixed(2)}`
      if (i > 0) {
        const xim1 = v.a + (i - 1) * dx
        const yim1 = f({ x: xim1 })
        const yLeft = Number.isFinite(yim1) ? yim1 : 0
        sum += ((yLeft + ys) / 2) * dx // trapezoid
      }
    }
    d += `L${t.toX(x).toFixed(2)},${t.toY(baseY).toFixed(2)}Z`
    area.setAttribute('d', d)
    vertical.setAttribute('x1', String(t.toX(x)))
    vertical.setAttribute('x2', String(t.toX(x)))
    fxLabel.textContent = `F(${formatTick(x)}) ≈ ${formatTick(sum)}`
  }
  update(v.xInitial)

  const controls = document.createElement('div')
  controls.className = 'visual-controls'
  controls.appendChild(mkSlider({
    id: 'x',
    label: 'x',
    min: v.xMin,
    max: v.xMax,
    step: 0.05,
    initial: v.xInitial,
    onInput: (val) => update(val),
  }))
  container.appendChild(controls)
  return container
}

function renderLimitApproach(v: LimitApproachVisual): HTMLElement {
  const container = document.createElement('div')
  container.className = 'visual'
  const t = mkAxisTransform(v.axes)
  const f = compileExpression(v.expression)
  const svg = makeSvg()
  container.appendChild(svg)
  drawAxes(svg, t)

  // Curve
  el('path', { d: samplePath(f, t), fill: 'none', stroke: COLOR.curve, 'stroke-width': 2 }, svg)

  // Hole at x = c (if requested)
  const cy = f({ x: v.c })
  const yAtC = Number.isFinite(cy) ? cy : (v.limitValue ?? 0)
  if (v.hole !== false) {
    el('circle', {
      cx: t.toX(v.c), cy: t.toY(yAtC), r: 5,
      fill: '#fff', stroke: COLOR.hole, 'stroke-width': 2,
    }, svg)
  }

  // Two approach dots
  const leftDot = el('circle', { cx: 0, cy: 0, r: 4, fill: COLOR.secant }, svg) as SVGCircleElement
  const rightDot = el('circle', { cx: 0, cy: 0, r: 4, fill: COLOR.tangent }, svg) as SVGCircleElement
  const leftLabel = el('text', { x: 0, y: 0, 'font-size': 10, fill: COLOR.secant }, svg) as SVGTextElement
  const rightLabel = el('text', { x: 0, y: 0, 'font-size': 10, fill: COLOR.tangent }, svg) as SVGTextElement
  const limitLabel = el('text', {
    x: PAD.left + PLOT_W - 4, y: PAD.top + 14,
    'text-anchor': 'end', 'font-size': 11, fill: COLOR.tangent, 'font-weight': '600',
  }, svg) as SVGTextElement

  function update(eps: number): void {
    const xl = v.c - eps
    const xr = v.c + eps
    const yl = f({ x: xl })
    const yr = f({ x: xr })
    if (Number.isFinite(yl)) {
      leftDot.setAttribute('cx', String(t.toX(xl)))
      leftDot.setAttribute('cy', String(t.toY(yl)))
      leftLabel.setAttribute('x', String(t.toX(xl) - 4))
      leftLabel.setAttribute('y', String(t.toY(yl) - 6))
      leftLabel.setAttribute('text-anchor', 'end')
      leftLabel.textContent = `f(${formatTick(xl)}) = ${formatTick(yl)}`
    }
    if (Number.isFinite(yr)) {
      rightDot.setAttribute('cx', String(t.toX(xr)))
      rightDot.setAttribute('cy', String(t.toY(yr)))
      rightLabel.setAttribute('x', String(t.toX(xr) + 4))
      rightLabel.setAttribute('y', String(t.toY(yr) - 6))
      rightLabel.textContent = `f(${formatTick(xr)}) = ${formatTick(yr)}`
    }
    if (v.limitValue !== undefined) {
      limitLabel.textContent = `limit = ${formatTick(v.limitValue)}`
    }
  }
  update(v.epsilonInitial)

  const controls = document.createElement('div')
  controls.className = 'visual-controls'
  controls.appendChild(mkSlider({
    id: 'eps',
    label: 'ε',
    min: v.epsilonMin,
    max: v.epsilonMax,
    step: 0.01,
    initial: v.epsilonInitial,
    onInput: (val) => update(val),
  }))
  container.appendChild(controls)
  return container
}

// ---------- Public entry ----------

/**
 * Render a Visual spec into a DOM element. Errors are caught and rendered
 * as a small error card so a single bad visual can't break the page.
 */
export function renderVisual(spec: Visual): HTMLElement {
  try {
    switch (spec.kind) {
      case 'function_plot': return renderFunctionPlot(spec)
      case 'secant_to_tangent': return renderSecantToTangent(spec)
      case 'riemann_sum': return renderRiemannSum(spec)
      case 'accumulation': return renderAccumulation(spec)
      case 'limit_approach': return renderLimitApproach(spec)
      default: {
        const err = document.createElement('div')
        err.className = 'visual-error'
        err.textContent = `Unknown visual kind: ${(spec as { kind: string }).kind}`
        return err
      }
    }
  } catch (e) {
    const err = document.createElement('div')
    err.className = 'visual-error'
    err.textContent = `Visual error: ${(e as Error).message}`
    return err
  }
}
