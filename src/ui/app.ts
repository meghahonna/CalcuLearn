/**
 * CalcuLearn UI — Phase 2
 *
 * Improvements over Phase 1:
 * - Loading spinners on every async action (Start, Submit, Hint, End)
 * - Animated status bar: "Thinking…" with spinner while Gemma runs
 * - Smooth problem stem fade-transition on new problem
 * - Difficulty badge + turn counter in problem header
 * - Feedback cards colour-coded by correctness (correct/incorrect)
 * - Hint cards with level label and streaming cursor animation
 * - Session progress bar (mastery proxy)
 * - Redesigned summary with stat cards + mastery delta bars
 * - Keyboard shortcuts: Enter to submit, Ctrl+H for hint
 * - Student name display from localStorage
 * - Error boundary: all async errors caught and shown in status bar
 */

import type { HintResult, Session, SessionSummary, TurnResult } from '../models/types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Controller (pure state, no DOM)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// KaTeX helpers
// ─────────────────────────────────────────────────────────────────────────────

export function renderLatexMarkup(text: string): string {
  return text.replace(/\$([^$]+)\$/g, '<span class="math">$1</span>')
}

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

// ─────────────────────────────────────────────────────────────────────────────
// DOM binding
// ─────────────────────────────────────────────────────────────────────────────

export interface DomBindingOptions {
  document: Document
  controller: StudentUiController
  studentId: string
  katex?: KatexLike
}

export function bindDom(options: DomBindingOptions): () => void {
  const { document: doc, controller, studentId } = options
  const katex = options.katex ?? (globalThis as { katex?: KatexLike }).katex

  // ── Element refs ──────────────────────────────────────────────────
  const startBtn      = doc.getElementById('start-btn')      as HTMLButtonElement | null
  const submitBtn     = doc.getElementById('submit-btn')     as HTMLButtonElement | null
  const hintBtn       = doc.getElementById('hint-btn')       as HTMLButtonElement | null
  const endBtn        = doc.getElementById('end-btn')        as HTMLButtonElement | null
  const newSessionBtn = doc.getElementById('new-session-btn') as HTMLButtonElement | null
  const answerInput   = doc.getElementById('answer-input')   as HTMLInputElement  | null
  const stemEl        = doc.getElementById('problem-stem')
  const feedbackArea  = doc.getElementById('feedback-area')
  const hintArea      = doc.getElementById('hint-area')
  const summaryPanel  = doc.getElementById('summary-panel')
  const summaryStats  = doc.getElementById('summary-stats')
  const masteryDeltas = doc.getElementById('mastery-deltas')

  /**
   * A1.3: fetch and append the concept's explanation-slot visual under
   * the practice feedback card. Wrapped in a <details> so it's
   * collapsed by default; expanded by default when the answer was wrong.
   */
  const appendPracticeVisual = async (
    container: HTMLElement,
    conceptId: string,
    expandedByDefault: boolean
  ): Promise<void> => {
    try {
      const resp = await fetch(
        `/api/visuals/list?conceptId=${encodeURIComponent(conceptId)}&slot=explanation`
      )
      if (!resp.ok) return
      const data = (await resp.json()) as {
        visuals: Array<{ spec: unknown; title?: string; captionMd?: string }>
      }
      if (!data.visuals || data.visuals.length === 0) return
      const v = data.visuals[0]!
      const { renderVisual } = await import('../visuals/render.js')
      const wrap = doc.createElement('details')
      wrap.className = 'practice-visual'
      if (expandedByDefault) wrap.open = true
      const summary = doc.createElement('summary')
      summary.textContent = expandedByDefault
        ? 'Diagram (open) — visualize this concept'
        : 'Diagram — visualize this concept'
      wrap.appendChild(summary)
      if (v.title) {
        const titleEl = doc.createElement('div')
        titleEl.className = 'visual-title'
        titleEl.textContent = v.title
        wrap.appendChild(titleEl)
      }
      const node = renderVisual(v.spec as never)
      wrap.appendChild(node)
      if (v.captionMd) {
        const cap = doc.createElement('div')
        cap.className = 'visual-caption'
        // Apply the same markdown+LaTeX renderer used in Learn Mode so
        // captions match visually across modes.
        renderLatexInElement(cap, v.captionMd, katex)
        wrap.appendChild(cap)
      }
      container.appendChild(wrap)
    } catch (err) {
      console.warn('[practice] visual fetch failed:', err)
    }
  }
  const statusBar     = doc.getElementById('status-bar')
  const progressWrap  = doc.getElementById('progress-bar-wrap')
  const progressBar   = doc.getElementById('progress-bar')
  const diffBadge     = doc.getElementById('difficulty-badge')
  const turnCounter   = doc.getElementById('turn-counter')
  const kbdHint       = doc.getElementById('kbd-hint')
  const studentNameEl = doc.getElementById('student-name')

  let turnCount = 0
  let isBusy = false

  // ── Status bar helpers ────────────────────────────────────────────

  function showStatus(
    msg: string,
    kind: 'thinking' | 'success' | 'error' | 'idle' = 'thinking',
    spinner = true
  ): void {
    if (statusBar === null) return
    statusBar.className = `visible ${kind}`
    statusBar.innerHTML = spinner && kind === 'thinking'
      ? `<span class="spinner"></span> ${escapeHtml(msg)}`
      : escapeHtml(msg)
  }

  function clearStatus(): void {
    if (statusBar === null) return
    statusBar.className = ''
    statusBar.innerHTML = ''
  }

  // ── Button busy state ─────────────────────────────────────────────

  function setBusy(busy: boolean, btn?: HTMLButtonElement | null, originalLabel?: string): void {
    isBusy = busy
    if (btn !== null && btn !== undefined) {
      if (busy) {
        btn.dataset['originalLabel'] = btn.innerHTML
        btn.innerHTML = '<span class="spinner"></span>'
        btn.disabled = true
      } else {
        btn.innerHTML = originalLabel ?? btn.dataset['originalLabel'] ?? btn.innerHTML
        // Re-enable state is handled by setActive()
      }
    }
  }

  // ── Active / inactive session state ──────────────────────────────

  function setActive(active: boolean): void {
    if (answerInput !== null) answerInput.disabled = !active
    if (submitBtn   !== null) submitBtn.disabled   = !active
    if (hintBtn     !== null) hintBtn.disabled     = !active
    if (endBtn      !== null) endBtn.disabled      = !active
    if (startBtn    !== null) startBtn.disabled    = active
    if (kbdHint     !== null) kbdHint.className    = active ? 'kbd-hint visible' : 'kbd-hint'
  }

  // ── Progress bar ──────────────────────────────────────────────────

  function updateProgress(masteryDeltas: Record<string, number>): void {
    if (progressBar === null || progressWrap === null) return
    progressWrap.className = 'visible'
    const values = Object.values(masteryDeltas)
    if (values.length === 0) return
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    // Map avg mastery (0→1) to a progress bar width (10%→100%)
    const pct = Math.min(100, Math.max(10, Math.round(avg * 100)))
    progressBar.style.width = `${pct}%`
  }

  // ── Stem transition ───────────────────────────────────────────────

  async function transitionStem(newStem: string): Promise<void> {
    if (stemEl === null) return
    stemEl.classList.add('fading')
    await sleep(160)
    renderLatexInElement(stemEl, newStem, katex)
    stemEl.classList.remove('fading')
  }

  // ── Difficulty badge ──────────────────────────────────────────────

  function updateDifficultyBadge(difficulty?: string): void {
    if (diffBadge === null) return
    if (difficulty === undefined) { diffBadge.style.display = 'none'; return }
    diffBadge.textContent = difficulty.replace('-', ' ')
    diffBadge.className = difficulty
    diffBadge.style.display = 'inline-block'
  }

  // ── Turn counter ──────────────────────────────────────────────────

  function updateTurnCounter(): void {
    if (turnCounter === null) return
    turnCounter.textContent = turnCount > 0 ? `Turn ${turnCount}` : ''
  }

  // ── Handlers ─────────────────────────────────────────────────────

  async function onStart(): Promise<void> {
    if (isBusy) return
    setBusy(true, startBtn)
    showStatus('Starting session — Gemma is thinking…', 'thinking')
    if (summaryPanel !== null) summaryPanel.hidden = true
    if (feedbackArea !== null) feedbackArea.innerHTML = ''
    if (hintArea     !== null) hintArea.innerHTML     = ''
    turnCount = 0
    updateTurnCounter()

    try {
      await controller.start(studentId)
      const problem = controller.state.session?.currentProblem
      await transitionStem(problem?.stem ?? '')
      updateDifficultyBadge(problem?.difficulty)
      updateTurnCounter()
      setActive(true)
      if (answerInput !== null) answerInput.focus()
      showStatus('Session started — good luck!', 'success', false)
      setTimeout(clearStatus, 2000)
    } catch (err) {
      showStatus(`Failed to start session: ${errorMsg(err)}`, 'error', false)
    } finally {
      setBusy(false, startBtn)
    }
  }

  async function onSubmit(): Promise<void> {
    if (isBusy) return
    const raw = (answerInput?.value ?? '').trim()
    if (raw.length === 0) return

    setBusy(true, submitBtn)
    showStatus('Evaluating your answer…', 'thinking')
    if (hintArea !== null) hintArea.innerHTML = ''

    try {
      const result = await controller.submit(raw)
      turnCount++
      updateTurnCounter()

      // Feedback card — colour by correctness
      if (feedbackArea !== null) {
        feedbackArea.innerHTML = ''
        const card = doc.createElement('div')
        const isCorrect = result.evaluationResult.isCorrect
        card.className = `feedback-card ${isCorrect ? 'correct' : 'incorrect'}`
        renderLatexInElement(card, controller.state.feedbackText, katex)
        feedbackArea.appendChild(card)
        // A1.3: surface the concept's hero visual under the feedback (collapsed).
        // Especially useful on an incorrect answer — calculus visuals unlock
        // intuition that prose alone can't.
        const conceptId = controller.state.session?.targetConcept?.id
        if (conceptId) {
          void appendPracticeVisual(feedbackArea, conceptId, !isCorrect)
        }
      }

      // Animate to next problem — use result.currentProblem which the server
      // returns directly so we never read stale client-side session state
      if (answerInput !== null) answerInput.value = ''
      const nextProblem = (result as any).currentProblem
      const nextStem = nextProblem?.stem ?? controller.state.session?.currentProblem?.stem ?? ''
      if (nextStem) {
        await sleep(400)
        await transitionStem(nextStem)
        updateDifficultyBadge(nextProblem?.difficulty ?? controller.state.session?.currentProblem?.difficulty)
      }

      // Update progress
      if (result.masteryUpdated) {
        updateProgress({ [controller.state.session?.targetConcept?.id ?? 'concept']: 0.1 })
      }

      if (answerInput !== null) answerInput.focus()
      clearStatus()
    } catch (err) {
      showStatus(`Error submitting answer: ${errorMsg(err)}`, 'error', false)
    } finally {
      setBusy(false, submitBtn)
    }
  }

  async function onHint(): Promise<void> {
    if (isBusy) return
    setBusy(true, hintBtn)
    showStatus('Generating hint…', 'thinking')

    try {
      const result = await controller.hint()

      if (hintArea !== null) {
        hintArea.innerHTML = ''
        const card = doc.createElement('div')
        card.className = 'hint-card'
        const label = doc.createElement('div')
        label.className = 'hint-label'
        label.textContent = `Hint ${result.hintLevel}`
        card.appendChild(label)
        const body = doc.createElement('div')
        renderLatexInElement(body, controller.state.hintText, katex)
        card.appendChild(body)
        hintArea.appendChild(card)
      }

      clearStatus()
      if (answerInput !== null) answerInput.focus()
    } catch (err) {
      showStatus(`Error getting hint: ${errorMsg(err)}`, 'error', false)
    } finally {
      setBusy(false, hintBtn)
    }
  }

  async function onEnd(): Promise<void> {
    if (isBusy) return
    if (!confirm('End this session and see your summary?')) return
    setBusy(true, endBtn)
    showStatus('Saving session…', 'thinking')

    try {
      const summary = await controller.end()
      setActive(false)
      clearStatus()
      if (progressWrap !== null) progressWrap.className = ''

      if (stemEl !== null) {
        stemEl.classList.add('fading')
        await sleep(160)
        stemEl.textContent = 'Session complete. Start a new session to continue.'
        stemEl.classList.remove('fading')
      }
      updateDifficultyBadge(undefined)
      if (turnCounter !== null) turnCounter.textContent = ''

      renderSummary(summary)
      if (summaryPanel !== null) summaryPanel.hidden = false
    } catch (err) {
      showStatus(`Error ending session: ${errorMsg(err)}`, 'error', false)
    } finally {
      setBusy(false, endBtn)
    }
  }

  async function onNewSession(): Promise<void> {
    if (summaryPanel !== null) summaryPanel.hidden = true
    if (feedbackArea !== null) feedbackArea.innerHTML = ''
    if (hintArea     !== null) hintArea.innerHTML     = ''
    if (stemEl       !== null) stemEl.textContent = 'Click Start session to begin.'
    await onStart()
  }

  // ── Summary rendering ─────────────────────────────────────────────

  function renderSummary(summary: SessionSummary): void {
    // Stat cards
    if (summaryStats !== null) {
      summaryStats.innerHTML = ''
      const durationSec = Math.round(
        (new Date(summary.endTime).getTime() - new Date(summary.startTime).getTime()) / 1000
      )
      const stats: Array<[string, string]> = [
        [String(summary.totalTurns),               'Questions'],
        [String(summary.hintsUsed),                'Hints used'],
        [String(summary.conceptsProgressed.length),'Concepts +'],
        [`${durationSec}s`,                        'Duration'],
      ]
      for (const [val, label] of stats) {
        const card = doc.createElement('div')
        card.className = 'stat-card'
        card.innerHTML = `<div class="stat-value">${escapeHtml(val)}</div><div class="stat-label">${escapeHtml(label)}</div>`
        summaryStats.appendChild(card)
      }
    }

    // Mastery delta bars
    if (masteryDeltas !== null) {
      masteryDeltas.innerHTML = ''
      const entries = Object.entries(summary.masteryDeltas)
        .filter(([, d]) => Math.abs(d) > 1e-4)
        .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))

      if (entries.length === 0) {
        const li = doc.createElement('li')
        li.style.color = 'var(--muted)'
        li.style.fontSize = '0.85rem'
        li.textContent = 'No mastery changes this session.'
        masteryDeltas.appendChild(li)
        return
      }

      const maxDelta = Math.max(...entries.map(([, d]) => Math.abs(d)))

      for (const [conceptId, delta] of entries) {
        const li = doc.createElement('li')
        li.className = `delta-row ${delta >= 0 ? 'delta-positive' : 'delta-negative'}`

        const pct = Math.round((Math.abs(delta) / maxDelta) * 100)
        const sign = delta >= 0 ? '+' : ''
        const label = conceptId.replace(/\./g, ' › ').replace(/-/g, ' ')

        li.innerHTML = `
          <span class="delta-label">${escapeHtml(label)}</span>
          <div class="delta-bar-wrap"><div class="delta-bar" style="width:${pct}%"></div></div>
          <span class="delta-value">${sign}${(delta * 100).toFixed(1)}%</span>
        `
        masteryDeltas.appendChild(li)
      }
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent): void {
    // Enter → submit (when answer input is focused or active)
    if (e.key === 'Enter' && !e.shiftKey && !isBusy) {
      if (doc.activeElement === answerInput && submitBtn !== null && !submitBtn.disabled) {
        e.preventDefault()
        void onSubmit()
      }
    }
    // Ctrl+H → hint
    if (e.key === 'h' && e.ctrlKey && !isBusy) {
      if (hintBtn !== null && !hintBtn.disabled) {
        e.preventDefault()
        void onHint()
      }
    }
  }

  // ── Student name display ──────────────────────────────────────────

  if (studentNameEl !== null) {
    const name = localStorage.getItem('calculearn-student-name')
    if (name !== null && name.trim().length > 0) {
      studentNameEl.textContent = `👤 ${name}`
    } else {
      studentNameEl.textContent = `ID: ${studentId.slice(0, 8)}`
    }
  }

  // ── Wire up events ────────────────────────────────────────────────

  startBtn?.addEventListener('click', () => { void onStart() })
  submitBtn?.addEventListener('click', () => { void onSubmit() })
  hintBtn?.addEventListener('click', () => { void onHint() })
  endBtn?.addEventListener('click', () => { void onEnd() })
  newSessionBtn?.addEventListener('click', () => { void onNewSession() })
  doc.addEventListener('keydown', onKeyDown)

  return () => {
    startBtn?.removeEventListener('click', () => { void onStart() })
    submitBtn?.removeEventListener('click', () => { void onSubmit() })
    hintBtn?.removeEventListener('click', () => { void onHint() })
    endBtn?.removeEventListener('click', () => { void onEnd() })
    newSessionBtn?.removeEventListener('click', () => { void onNewSession() })
    doc.removeEventListener('keydown', onKeyDown)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API client
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API ${response.status}: ${text}`)
  }
  return response.json() as Promise<T>
}

function reviveSession(session: Session): Session {
  return { ...session, startTime: new Date(session.startTime as unknown as string) }
}

function reviveSummary(summary: SessionSummary): SessionSummary {
  return {
    ...summary,
    startTime: new Date(summary.startTime as unknown as string),
    endTime:   new Date(summary.endTime   as unknown as string),
  }
}

function createRemoteSessionEngine(apiBase: string): SessionEngineUiPort {
  return {
    async beginSession(studentId: string): Promise<Session> {
      const s = await apiFetch<Session>(`${apiBase}/session/begin`, {
        method: 'POST',
        body: JSON.stringify({ studentId }),
      })
      return reviveSession(s)
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
      const s = await apiFetch<SessionSummary>(
        `${apiBase}/session/${encodeURIComponent(sessionId)}/end`,
        { method: 'POST' }
      )
      return reviveSummary(s)
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function errorMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap (browser only)
// ─────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const storageKey = 'calculearn-student-id'
  const storedId   = window.localStorage.getItem(storageKey)
  const crypto     = typeof window.crypto !== 'undefined' ? window.crypto : undefined
  const studentId  = storedId ?? (crypto?.randomUUID?.() ?? `student-${Math.random().toString(36).slice(2)}`)

  if (storedId === null) window.localStorage.setItem(storageKey, studentId)

  const controller = new StudentUiController(createRemoteSessionEngine('/api'))
  bindDom({ document, controller, studentId })

  // ── Phase C: mode tabs + Learn Mode wiring ──
  void (async () => {
    const { LearnModeUi } = await import('./learnMode.js')
    const { ChallengeUi } = await import('./challenge.js')
    const { TeachBackUi } = await import('./teachBack.js')
    const { ExploreUi } = await import('./explore.js')
    const learnContainer = document.getElementById('learn-container') as HTMLElement
    const challengeContainer = document.getElementById('challenge-container') as HTMLElement
    const exploreContainer = document.getElementById('explore-container') as HTMLElement
    const practicePanel = document.getElementById('problem-panel') as HTMLElement
    const summaryPanel = document.getElementById('summary-panel') as HTMLElement

    // A2: shared teach-back host. We mount it at the bottom of <main> and
    // scroll it into view when triggered from either Learn or Challenge.
    const main = document.getElementById('app') as HTMLElement
    const teachBackHost = document.createElement('div')
    teachBackHost.id = 'teachback-host'
    teachBackHost.className = 'teachback-host'
    teachBackHost.hidden = true
    main.appendChild(teachBackHost)
    const teachBackUi = new TeachBackUi({
      document,
      studentId,
      onOpenLearn: (conceptId) => {
        teachBackHost.hidden = true
        void (async () => {
          await ensureLearnMounted()
          setMode('learn')
          try {
            await learnUi.startConcept(conceptId, 'on_pace')
          } catch (err) {
            console.error('[teachback->learn]', err)
          }
        })()
      },
    })

    function openTeachBack(conceptId: string, conceptName: string): void {
      teachBackHost.hidden = false
      void teachBackUi.open(teachBackHost, conceptId, conceptName)
      teachBackHost.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const learnUi = new LearnModeUi({
      document,
      studentId,
      onTeachBack: openTeachBack,
    })
    const challengeUi = new ChallengeUi({
      document,
      studentId,
      onTeachBack: openTeachBack,
    })
    // ExploreUi is constructed lazily inside ensureExploreMounted below so
    // we can pass it deep-link callbacks that reference setMode / learnUi
    // / challengeUi (defined just above us). We declare it here.
    let exploreUi: InstanceType<typeof ExploreUi> | null = null
    let learnMounted = false
    let challengeMounted = false
    let exploreMounted = false

    async function ensureLearnMounted(): Promise<void> {
      if (!learnMounted) {
        await learnUi.mount(learnContainer)
        learnMounted = true
      }
    }

    async function ensureChallengeMounted(): Promise<void> {
      if (!challengeMounted) {
        await challengeUi.mount(challengeContainer)
        challengeMounted = true
      }
    }

    async function ensureExploreMounted(): Promise<void> {
      if (!exploreMounted) {
        exploreUi = new ExploreUi({
          document,
          studentId,
          onOpenLearn: (conceptId) => {
            void (async () => {
              await ensureLearnMounted()
              setMode('learn')
              try { await learnUi.startConcept(conceptId, 'on_pace') }
              catch (err) { console.error('[explore->learn]', err) }
            })()
          },
          onOpenChallenge: (conceptId) => {
            void (async () => {
              await ensureChallengeMounted()
              setMode('challenge')
              try { await challengeUi.openConcept?.(conceptId) }
              catch (err) { console.error('[explore->challenge]', err) }
            })()
          },
        })
        await exploreUi.mount(exploreContainer)
        exploreMounted = true
      }
    }

    function setMode(mode: 'practice' | 'learn' | 'challenge' | 'explore'): void {
      document.querySelectorAll('.mode-tab').forEach((b) => {
        b.classList.toggle('active', (b as HTMLElement).dataset['mode'] === mode)
      })
      const showPractice = mode === 'practice'
      practicePanel.hidden = !showPractice
      summaryPanel.hidden = !showPractice || summaryPanel.hasAttribute('data-stay-hidden')
      if (!showPractice) summaryPanel.hidden = true
      learnContainer.hidden = mode !== 'learn'
      challengeContainer.hidden = mode !== 'challenge'
      exploreContainer.hidden = mode !== 'explore'
      if (mode === 'learn') void ensureLearnMounted()
      if (mode === 'challenge') void ensureChallengeMounted()
      if (mode === 'explore') void ensureExploreMounted()
    }

    document.querySelectorAll('.mode-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset['mode'] as 'practice' | 'learn' | 'challenge' | 'explore'
        if (mode && !(btn as HTMLButtonElement).disabled) setMode(mode)
      })
    })


    // ── Phase D: confidence chip + adaptive nudge ──
    const adaptive = await import('./adaptive.js')
    const chipContainer = document.getElementById('confidence-chip') as HTMLElement
    const nudgeContainer = document.getElementById('adaptive-nudge') as HTMLElement
    let lastSubmittedConceptId: string | null = null

    const chip = adaptive.mountConfidenceChip({
      document,
      container: chipContainer,
      studentId,
      getConceptId: () => lastSubmittedConceptId,
      onRecorded: () => {
        chip.setVisible(false)
        if (lastSubmittedConceptId) void nudge.refresh(lastSubmittedConceptId)
      },
    })
    chip.setVisible(false)

    const nudge = adaptive.mountNudgeBanner({
      document,
      container: nudgeContainer,
      studentId,
      onAction: (action, conceptId) => {
        if (action.kind === 'open_learn') {
          void (async () => {
            await ensureLearnMounted()
            setMode('learn')
            try {
              await learnUi.startConcept(conceptId, action.tier)
            } catch (err) {
              console.error('[nudge open_learn]', err)
            }
          })()
        } else if (action.kind === 'unlock_challenge') {
          // Tab is enabled by default in Phase E; visually mark it unlocked
          const tab = document.querySelector('.mode-tab[data-mode=\"challenge\"]') as HTMLButtonElement | null
          if (tab) {
            tab.title = 'Challenge mode unlocked'
            tab.classList.add('unlocked')
          }
          // Open Challenge Mode and jump to the unlocked concept
          void (async () => {
            await ensureChallengeMounted()
            setMode('challenge')
            try {
              await challengeUi.openConcept(conceptId)
            } catch (err) {
              console.error('[nudge unlock_challenge]', err)
            }
          })()
        } else if (action.kind === 'try_alt_framing') {
          void (async () => {
            await ensureLearnMounted()
            setMode('learn')
            try {
              await learnUi.startConcept(conceptId, 'on_pace')
            } catch (err) {
              console.error('[nudge alt_framing]', err)
            }
          })()
        }
      },
    })

    // Poll lightly so we can show the chip + refresh the nudge after each
    // submit — the existing controller doesn't emit events, so this matches
    // the pattern used for the help-understand-btn above.
    let lastFeedback: string | undefined
    setInterval(() => {
      const s = controller.state
      const fb = s.feedbackText
      const concept = s.session?.currentProblem?.conceptId ?? null
      // Detect a fresh submission: feedback text changed
      if (fb && fb !== lastFeedback) {
        lastFeedback = fb
        // The conceptId of the JUST-submitted problem might already be the
        // current (next) problem's. Capture the prior one if we can.
        if (concept) {
          lastSubmittedConceptId = concept
          chip.setVisible(true)
          void nudge.refresh(concept)
        }
      }
      // Hide chip when a new problem comes in without confirmation
      if (!fb) {
        chip.setVisible(false)
      }
    }, 600)

    // "I don't know — help me understand" off-ramp from Practice Mode.
    // Switches to Learn Mode and starts a session for the current problem's concept.
    const helpBtn = document.getElementById('help-understand-btn') as HTMLButtonElement
    if (helpBtn) {
      helpBtn.addEventListener('click', async () => {
        const conceptId = controller.state.session?.currentProblem?.conceptId
        if (!conceptId) return
        helpBtn.disabled = true
        await ensureLearnMounted()
        setMode('learn')
        // Default to novice tier for the off-ramp — student is asking for help
        try {
          await learnUi.startConcept(conceptId, 'novice')
        } catch (err) {
          console.error('[learn off-ramp]', err)
        }
        helpBtn.disabled = false
      })

      // Enable/disable the help button based on whether a problem is active.
      // We poll because controller doesn't emit events.
      setInterval(() => {
        const hasProblem = !!controller.state.session?.currentProblem
        helpBtn.disabled = !hasProblem
      }, 500)
    }
  })()
}
