/**
 * Student UI controller and DOM bindings for CalcuLearn.
 *
 * `StudentUiController` is a thin pure-state object — it keeps no DOM
 * references and is fully testable in Node. The `bindDom(...)` helper wires
 * a controller instance to the static elements in `index.html`. KaTeX is
 * loaded as a global by `index.html` (offline, no CDN). Reqs 4.3, 14.1–14.3.
 */

import type { HintResult, Session, SessionSummary, TurnResult } from '../models/types.js'

export interface SessionEngineUiPort {
  beginSession(studentId: string): Promise<Session>
  submitAnswer(sessionId: string, rawAnswer: string): Promise<TurnResult>
  requestHint(sessionId: string): Promise<HintResult>
  endSession(sessionId: string): Promise<SessionSummary>
}

export interface UiState {
  session: Session | null
  feedbackText: string
  hintText: string
  summary: SessionSummary | null
}

export class StudentUiController {
  readonly state: UiState = {
    session: null,
    feedbackText: '',
    hintText: '',
    summary: null,
  }

  constructor(private readonly sessionEngine: SessionEngineUiPort) {}

  async start(studentId: string): Promise<void> {
    this.state.session = await this.sessionEngine.beginSession(studentId)
    this.state.feedbackText = ''
    this.state.hintText = ''
    this.state.summary = null
  }

  async submit(rawAnswer: string): Promise<TurnResult> {
    if (this.state.session === null) throw new Error('No active session')
    const result = await this.sessionEngine.submitAnswer(this.state.session.sessionId, rawAnswer)
    this.state.feedbackText = result.feedbackText
    return result
  }

  async hint(): Promise<HintResult> {
    if (this.state.session === null) throw new Error('No active session')
    const result = await this.sessionEngine.requestHint(this.state.session.sessionId)
    this.state.hintText = result.text
    return result
  }

  async end(): Promise<SessionSummary> {
    if (this.state.session === null) throw new Error('No active session')
    const summary = await this.sessionEngine.endSession(this.state.session.sessionId)
    this.state.summary = summary
    this.state.session = null
    return summary
  }
}

/**
 * Pre-Task-30 placeholder kept for backward compatibility. Real LaTeX
 * rendering is done by `renderLatexInElement` using the bundled KaTeX library.
 * This helper is still useful in Node-side tests where no DOM exists.
 */
export function renderLatexMarkup(text: string): string {
  return text.replace(/\$([^$]+)\$/g, '<span class="math">$1</span>')
}

/**
 * Renders inline ($…$) and display (\[…\]) LaTeX spans inside `element` using
 * KaTeX. KaTeX is expected to be exposed as a global named `katex` by a
 * `<script>` tag in `index.html`. When KaTeX is unavailable (e.g. tests in a
 * non-DOM environment), falls back to wrapping spans in `<span class="math">`
 * so behaviour stays observable.
 *
 * The injected text-node content is escaped before insertion to prevent any
 * stem text from being interpreted as HTML.
 */
export interface KatexLike {
  renderToString(latex: string, options?: { displayMode?: boolean; throwOnError?: boolean }): string
}

export function renderLatexInElement(
  element: { textContent: string | null; innerHTML: string },
  text: string,
  katex?: KatexLike
): void {
  const inlinePattern = /\$([^$]+)\$|\\\[([\s\S]*?)\\\]/g
  let lastIndex = 0
  let html = ''
  let match: RegExpExecArray | null
  while ((match = inlinePattern.exec(text)) !== null) {
    html += escapeHtml(text.slice(lastIndex, match.index))
    const inline = match[1]
    const display = match[2]
    const latex = inline ?? display ?? ''
    const isDisplay = display !== undefined
    if (katex !== undefined) {
      try {
        html += katex.renderToString(latex, { displayMode: isDisplay, throwOnError: false })
      } catch {
        html += `<span class="math">${escapeHtml(latex)}</span>`
      }
    } else {
      html += `<span class="math">${escapeHtml(latex)}</span>`
    }
    lastIndex = match.index + match[0].length
  }
  html += escapeHtml(text.slice(lastIndex))
  element.innerHTML = html
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// DOM wiring (browser-only)
// ---------------------------------------------------------------------------

/**
 * Wires a `StudentUiController` to the static HTML elements in `index.html`.
 * Returns a teardown function that removes the listeners (useful in tests
 * with jsdom). Safe to call even if some elements are missing — the binder
 * skips them.
 */
export interface DomBindingOptions {
  document: Document
  controller: StudentUiController
  studentId: string
  /** Optional KaTeX global. Defaults to `globalThis.katex` if available. */
  katex?: KatexLike
}

export function bindDom(options: DomBindingOptions): () => void {
  const { document: doc, controller, studentId } = options
  const katex = options.katex ?? (globalThis as { katex?: KatexLike }).katex

  const startBtn = doc.getElementById('start-btn') as HTMLButtonElement | null
  const submitBtn = doc.getElementById('submit-btn') as HTMLButtonElement | null
  const hintBtn = doc.getElementById('hint-btn') as HTMLButtonElement | null
  const endBtn = doc.getElementById('end-btn') as HTMLButtonElement | null
  const answerInput = doc.getElementById('answer-input') as HTMLInputElement | null
  const stemEl = doc.getElementById('problem-stem')
  const feedbackArea = doc.getElementById('feedback-area')
  const hintArea = doc.getElementById('hint-area')
  const summaryPanel = doc.getElementById('summary-panel')
  const summaryGrid = doc.getElementById('summary-grid')
  const masteryDeltas = doc.getElementById('mastery-deltas')

  function setActive(active: boolean): void {
    if (answerInput !== null) answerInput.disabled = !active
    if (submitBtn !== null) submitBtn.disabled = !active
    if (hintBtn !== null) hintBtn.disabled = !active
    if (endBtn !== null) endBtn.disabled = !active
    if (startBtn !== null) startBtn.disabled = active
  }

  async function onStart(): Promise<void> {
    await controller.start(studentId)
    const stem = controller.state.session?.currentProblem?.stem ?? ''
    if (stemEl !== null) renderLatexInElement(stemEl, stem, katex)
    if (feedbackArea !== null) feedbackArea.innerHTML = ''
    if (hintArea !== null) hintArea.innerHTML = ''
    if (summaryPanel !== null) summaryPanel.hidden = true
    setActive(true)
  }

  async function onSubmit(): Promise<void> {
    const raw = (answerInput?.value ?? '').trim()
    if (raw.length === 0) return
    await controller.submit(raw)
    if (feedbackArea !== null) {
      feedbackArea.innerHTML = ''
      const div = doc.createElement('div')
      div.className = 'feedback'
      renderLatexInElement(div, controller.state.feedbackText, katex)
      feedbackArea.appendChild(div)
    }
    if (answerInput !== null) answerInput.value = ''
    // Refresh stem — beginSession already set `currentProblem` for the next turn.
    const stem = controller.state.session?.currentProblem?.stem ?? ''
    if (stemEl !== null) renderLatexInElement(stemEl, stem, katex)
  }

  async function onHint(): Promise<void> {
    await controller.hint()
    if (hintArea !== null) {
      hintArea.innerHTML = ''
      const div = doc.createElement('div')
      div.className = 'hint'
      renderLatexInElement(div, controller.state.hintText, katex)
      hintArea.appendChild(div)
    }
  }

  async function onEnd(): Promise<void> {
    const summary = await controller.end()
    setActive(false)
    if (stemEl !== null) stemEl.textContent = 'Session complete.'
    if (summaryPanel !== null) summaryPanel.hidden = false
    if (summaryGrid !== null) {
      summaryGrid.innerHTML = ''
      const dl: Array<[string, string]> = [
        ['Total turns', String(summary.totalTurns)],
        ['Hints used', String(summary.hintsUsed)],
        ['Concepts progressed', String(summary.conceptsProgressed.length)],
        ['Duration', `${Math.round((summary.endTime.getTime() - summary.startTime.getTime()) / 1000)}s`],
      ]
      for (const [label, value] of dl) {
        const dt = doc.createElement('dt')
        dt.textContent = label
        const dd = doc.createElement('dd')
        dd.textContent = value
        summaryGrid.appendChild(dt)
        summaryGrid.appendChild(dd)
      }
    }
    if (masteryDeltas !== null) {
      masteryDeltas.innerHTML = ''
      for (const [conceptId, delta] of Object.entries(summary.masteryDeltas)) {
        if (Math.abs(delta) < 1e-4) continue
        const li = doc.createElement('li')
        li.textContent = `${conceptId}: ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`
        li.className = delta >= 0 ? 'delta-positive' : 'delta-negative'
        masteryDeltas.appendChild(li)
      }
    }
  }

  startBtn?.addEventListener('click', onStart)
  submitBtn?.addEventListener('click', onSubmit)
  hintBtn?.addEventListener('click', onHint)
  endBtn?.addEventListener('click', onEnd)

  return () => {
    startBtn?.removeEventListener('click', onStart)
    submitBtn?.removeEventListener('click', onSubmit)
    hintBtn?.removeEventListener('click', onHint)
    endBtn?.removeEventListener('click', onEnd)
  }
}

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API request failed (${response.status}): ${text}`)
  }
  return response.json() as Promise<T>
}

function reviveSession(session: Session): Session {
  return {
    ...session,
    startTime: new Date(session.startTime as unknown as string),
  }
}

function reviveSummary(summary: SessionSummary): SessionSummary {
  return {
    ...summary,
    startTime: new Date(summary.startTime as unknown as string),
    endTime: new Date(summary.endTime as unknown as string),
  }
}

function createRemoteSessionEngine(apiBase: string): SessionEngineUiPort {
  return {
    async beginSession(studentId: string): Promise<Session> {
      const session = await apiFetch<Session>(`${apiBase}/session/begin`, {
        method: 'POST',
        body: JSON.stringify({ studentId }),
      })
      return reviveSession(session)
    },
    async submitAnswer(sessionId: string, rawAnswer: string) {
      return apiFetch<TurnResult>(`${apiBase}/session/${encodeURIComponent(sessionId)}/submit`, {
        method: 'POST',
        body: JSON.stringify({ rawAnswer }),
      })
    },
    async requestHint(sessionId: string) {
      return apiFetch<HintResult>(`${apiBase}/session/${encodeURIComponent(sessionId)}/hint`, {
        method: 'POST',
      })
    },
    async endSession(sessionId: string) {
      const summary = await apiFetch<SessionSummary>(`${apiBase}/session/${encodeURIComponent(sessionId)}/end`, {
        method: 'POST',
      })
      return reviveSummary(summary)
    },
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const storageKey = 'calculearn-student-id'
  const storedStudentId = window.localStorage.getItem(storageKey)
  const browserCrypto = typeof window.crypto !== 'undefined' ? window.crypto : undefined
  const studentId = storedStudentId ??
    (browserCrypto?.randomUUID?.() ?? `student-${Math.random().toString(36).slice(2)}`)

  if (!storedStudentId) {
    window.localStorage.setItem(storageKey, studentId)
  }

  const apiBase = '/api'
  const controller = new StudentUiController(createRemoteSessionEngine(apiBase))
  bindDom({ document, controller, studentId })
}
