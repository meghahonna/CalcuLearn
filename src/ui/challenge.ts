/**
 * src/ui/challenge.ts — Challenge Mode UI controller
 *
 * Three-screen flow:
 *   1. Topic picker — grid of concepts that have challenge content
 *   2. Bundle view — for the picked concept, all three flavors:
 *        Applications (problem + check-with-Socratic-feedback)
 *        Deep dives   (read + reflect + Socratic probe)
 *        Stretch problems (problem-bank items where is_challenge=1)
 *
 * Re-uses the markdown+LaTeX renderer from learnMode.ts.
 */

import type { KatexLike } from './app.js'
import { renderMarkdownLatex } from './learnMode.js'

// ---------- API types ----------

interface ChallengeConceptCard {
  conceptId: string
  conceptName: string
  oneLiner: string | null
  unlocked: boolean
  applicationCount: number
  deepDiveCount: number
  stretchProblemCount: number
}

interface Application {
  id: number
  concept_id: string
  context: string | null
  problem_md: string
  solution_outline_md: string
}

interface DeepDive {
  id: number
  concept_id: string
  title: string
  body_md: string
}

interface StretchProblem {
  id: string
  concept_id: string
  difficulty: string
  stem: string
  application_context: string | null
  solution_steps: Array<{ step_md?: string; why_md?: string }>
}

interface ChallengeBundle {
  conceptId: string
  conceptName: string
  oneLiner: string | null
  unlocked: boolean
  hasContent: boolean
  applications: Application[]
  deepDives: DeepDive[]
  stretchProblems: StretchProblem[]
}

interface FeedbackResponse {
  message: string
  solutionOutlineMd: string
}

// ---------- API client ----------

class ChallengeApi {
  async listConcepts(studentId: string): Promise<ChallengeConceptCard[]> {
    const r = await fetch(
      `/api/challenge/concepts?studentId=${encodeURIComponent(studentId)}`
    )
    if (!r.ok) throw new Error(`/api/challenge/concepts ${r.status}`)
    const data = (await r.json()) as { concepts: ChallengeConceptCard[] }
    return data.concepts
  }

  async getBundle(studentId: string, conceptId: string): Promise<ChallengeBundle> {
    const r = await fetch(
      `/api/challenge/bundle?studentId=${encodeURIComponent(studentId)}` +
        `&conceptId=${encodeURIComponent(conceptId)}`
    )
    if (!r.ok) throw new Error(`/api/challenge/bundle ${r.status}`)
    return (await r.json()) as ChallengeBundle
  }

  async applicationFeedback(args: {
    applicationId: number
    studentAnswer: string
  }): Promise<FeedbackResponse> {
    const r = await fetch('/api/challenge/application/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!r.ok) throw new Error(`feedback ${r.status}: ${await r.text()}`)
    return (await r.json()) as FeedbackResponse
  }

  async deepDiveProbe(args: {
    deepDiveId: number
    studentReflection: string
  }): Promise<FeedbackResponse> {
    const r = await fetch('/api/challenge/deepdive/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!r.ok) throw new Error(`probe ${r.status}: ${await r.text()}`)
    return (await r.json()) as FeedbackResponse
  }
}

// ---------- Helpers ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function contextEmoji(ctx: string | null): string {
  // Avoid emojis per UX rules — use a short label instead
  return ''
}

function contextLabel(ctx: string | null): string {
  if (!ctx) return 'Real-world'
  return ctx.charAt(0).toUpperCase() + ctx.slice(1)
}

// ---------- Controller ----------

export interface ChallengeUiOptions {
  document: Document
  studentId: string
  katex?: KatexLike
  /** A2: called when the student clicks "Teach it back" on a bundle. */
  onTeachBack?: (conceptId: string, conceptName: string) => void
}

export class ChallengeUi {
  private readonly doc: Document
  private readonly studentId: string
  private readonly katex?: KatexLike
  private readonly onTeachBack?: (conceptId: string, conceptName: string) => void
  private readonly api = new ChallengeApi()
  private root: HTMLElement | null = null
  private currentBundle: ChallengeBundle | null = null

  constructor(opts: ChallengeUiOptions) {
    this.doc = opts.document
    this.studentId = opts.studentId
    this.katex = opts.katex ?? (globalThis as { katex?: KatexLike }).katex
    this.onTeachBack = opts.onTeachBack
  }

  async mount(container: HTMLElement): Promise<void> {
    this.root = container
    container.innerHTML = `
      <section id="challenge-panel" class="panel">
        <div class="challenge-header">
          <h2>Challenge Mode</h2>
          <div id="challenge-header-info" class="challenge-header-info"></div>
        </div>
        <div id="challenge-body"></div>
        <div id="challenge-status" class="challenge-status" role="status" aria-live="polite"></div>
      </section>
    `
    await this.renderPicker()
  }

  /** Skip the picker and jump straight to one concept's bundle. */
  async openConcept(conceptId: string): Promise<void> {
    await this.renderBundle(conceptId)
  }

  // ------------------ Topic picker ------------------

  private async renderPicker(): Promise<void> {
    if (!this.root) return
    const body = this.root.querySelector('#challenge-body') as HTMLElement
    const info = this.root.querySelector('#challenge-header-info') as HTMLElement
    info.textContent = ''
    this.setStatus('Loading challenge content...')
    try {
      const concepts = await this.api.listConcepts(this.studentId)
      if (concepts.length === 0) {
        body.innerHTML = `<p class="challenge-empty">
          No challenge content authored yet. Try Practice or Learn Mode first.
        </p>`
        this.clearStatus()
        return
      }

      const cards = concepts
        .map((c) => {
          const lockBadge = c.unlocked
            ? `<span class="challenge-badge unlocked">UNLOCKED</span>`
            : `<span class="challenge-badge locked">OPEN</span>`
          return `
            <button class="challenge-concept-card" data-concept-id="${escapeHtml(c.conceptId)}">
              <div class="challenge-concept-name">
                ${escapeHtml(c.conceptName)}
                ${lockBadge}
              </div>
              <div class="challenge-concept-oneliner">
                ${escapeHtml(c.oneLiner ?? '')}
              </div>
              <div class="challenge-concept-counts">
                <span title="Application problems">${c.applicationCount} application${c.applicationCount === 1 ? '' : 's'}</span>
                <span class="dot">·</span>
                <span title="Deep dives">${c.deepDiveCount} deep dive${c.deepDiveCount === 1 ? '' : 's'}</span>
                ${c.stretchProblemCount > 0 ? `<span class="dot">·</span><span>${c.stretchProblemCount} stretch</span>` : ''}
              </div>
            </button>
          `
        })
        .join('')

      body.innerHTML = `
        <p class="challenge-intro">
          Real-world applications, derivations, and tougher problems.
          A green <strong>UNLOCKED</strong> badge means you've mastered the basics — but you can open anything you like.
        </p>
        <div class="challenge-concept-grid">
          ${cards}
        </div>
      `

      body.querySelectorAll('.challenge-concept-card').forEach((el) => {
        el.addEventListener('click', () => {
          const conceptId = (el as HTMLElement).dataset['conceptId']
          if (conceptId) void this.renderBundle(conceptId)
        })
      })

      this.clearStatus()
    } catch (err) {
      this.setStatus(`Could not load: ${(err as Error).message}`, true)
    }
  }

  // ------------------ Concept bundle view ------------------

  private async renderBundle(conceptId: string): Promise<void> {
    if (!this.root) return
    const body = this.root.querySelector('#challenge-body') as HTMLElement
    const info = this.root.querySelector('#challenge-header-info') as HTMLElement
    this.setStatus('Loading...')
    try {
      const bundle = await this.api.getBundle(this.studentId, conceptId)
      this.currentBundle = bundle
      info.textContent = `${conceptId}${bundle.unlocked ? ' · unlocked' : ''}`

      const lockNote = bundle.unlocked
        ? `<span class="challenge-badge unlocked">UNLOCKED</span>`
        : `<span class="challenge-badge locked">OPEN</span>`

      body.innerHTML = `
        <div class="challenge-back-row">
          <button class="ghost" id="challenge-back">← All concepts</button>
        </div>
        <div class="challenge-bundle-header">
          <h3>${escapeHtml(bundle.conceptName)} ${lockNote}</h3>
          <div class="challenge-bundle-oneliner">${escapeHtml(bundle.oneLiner ?? '')}</div>
          <div class="challenge-bundle-actions" style="margin-top:0.55rem;">
            <button id="challenge-teachback" class="teachback-trigger">Teach it back</button>
          </div>
        </div>

        ${
          bundle.applications.length > 0
            ? `<div class="challenge-section">
                 <h4 class="challenge-section-title">Application problems</h4>
                 <div id="challenge-applications"></div>
               </div>`
            : ''
        }

        ${
          bundle.deepDives.length > 0
            ? `<div class="challenge-section">
                 <h4 class="challenge-section-title">Why does this work? — deep dives</h4>
                 <div id="challenge-deepdives"></div>
               </div>`
            : ''
        }

        ${
          bundle.stretchProblems.length > 0
            ? `<div class="challenge-section">
                 <h4 class="challenge-section-title">Stretch problems</h4>
                 <div id="challenge-stretch"></div>
               </div>`
            : ''
        }

        ${
          !bundle.hasContent
            ? `<p class="challenge-empty">No challenge content authored for this concept yet.</p>`
            : ''
        }
      `

      const back = body.querySelector('#challenge-back') as HTMLButtonElement
      back.addEventListener('click', () => void this.renderPicker())

      const appsEl = body.querySelector('#challenge-applications') as HTMLElement | null
      if (appsEl) {
        bundle.applications.forEach((app, i) =>
          appsEl.appendChild(this.renderApplicationCard(app, i + 1))
        )
      }

      const ddEl = body.querySelector('#challenge-deepdives') as HTMLElement | null
      if (ddEl) {
        bundle.deepDives.forEach((dd, i) =>
          ddEl.appendChild(this.renderDeepDiveCard(dd, i + 1))
        )
      }

      const stretchEl = body.querySelector('#challenge-stretch') as HTMLElement | null
      if (stretchEl) {
        bundle.stretchProblems.forEach((p, i) =>
          stretchEl.appendChild(this.renderStretchProblemCard(p, i + 1))
        )
      }

      // A2: wire teach-back trigger
      const tbBtn = body.querySelector('#challenge-teachback') as HTMLButtonElement | null
      if (tbBtn) {
        tbBtn.addEventListener('click', () => {
          if (this.onTeachBack) {
            this.onTeachBack(bundle.conceptId, bundle.conceptName)
          }
        })
      }

      this.clearStatus()
    } catch (err) {
      this.setStatus(`Could not load bundle: ${(err as Error).message}`, true)
    }
  }

  // ------------------ Card renderers ------------------

  private renderApplicationCard(app: Application, idx: number): HTMLElement {
    const wrap = this.doc.createElement('div')
    wrap.className = 'challenge-card challenge-card-application'
    wrap.innerHTML = `
      <div class="challenge-card-head">
        <span class="challenge-card-tag">${escapeHtml(contextLabel(app.context))}</span>
        <span class="challenge-card-idx">Application ${idx}</span>
      </div>
      <div class="challenge-card-problem">${renderMarkdownLatex(app.problem_md, this.katex)}</div>
      <div class="challenge-card-input">
        <textarea
          class="challenge-answer"
          rows="3"
          placeholder="Walk through your approach..."
          aria-label="Your answer"
        ></textarea>
        <div class="challenge-card-buttons">
          <button class="primary challenge-check">Check</button>
          <button class="ghost challenge-reveal">Show solution outline</button>
        </div>
      </div>
      <div class="challenge-feedback" hidden></div>
      <div class="challenge-outline" hidden></div>
    `

    const textarea = wrap.querySelector('.challenge-answer') as HTMLTextAreaElement
    const checkBtn = wrap.querySelector('.challenge-check') as HTMLButtonElement
    const revealBtn = wrap.querySelector('.challenge-reveal') as HTMLButtonElement
    const feedbackEl = wrap.querySelector('.challenge-feedback') as HTMLElement
    const outlineEl = wrap.querySelector('.challenge-outline') as HTMLElement

    checkBtn.addEventListener('click', async () => {
      const answer = textarea.value.trim()
      if (!answer) {
        feedbackEl.hidden = false
        feedbackEl.innerHTML =
          '<em>Take a swing at it — what is the first thing you would set up?</em>'
        return
      }
      checkBtn.disabled = true
      checkBtn.textContent = 'Checking...'
      feedbackEl.hidden = false
      feedbackEl.innerHTML = '<em>Thinking...</em>'
      try {
        const fb = await this.api.applicationFeedback({
          applicationId: app.id,
          studentAnswer: answer,
        })
        feedbackEl.innerHTML = renderMarkdownLatex(fb.message, this.katex)
      } catch (err) {
        feedbackEl.innerHTML = `<span class="error">Could not check: ${escapeHtml(
          (err as Error).message
        )}</span>`
      } finally {
        checkBtn.disabled = false
        checkBtn.textContent = 'Check'
      }
    })

    revealBtn.addEventListener('click', () => {
      const isHidden = outlineEl.hidden
      if (isHidden) {
        outlineEl.hidden = false
        outlineEl.innerHTML =
          `<div class="challenge-outline-title">Solution outline</div>` +
          renderMarkdownLatex(app.solution_outline_md, this.katex)
        revealBtn.textContent = 'Hide solution outline'
      } else {
        outlineEl.hidden = true
        revealBtn.textContent = 'Show solution outline'
      }
    })

    return wrap
  }

  private renderDeepDiveCard(dd: DeepDive, idx: number): HTMLElement {
    const wrap = this.doc.createElement('div')
    wrap.className = 'challenge-card challenge-card-deepdive'
    wrap.innerHTML = `
      <div class="challenge-card-head">
        <span class="challenge-card-tag">Why does it work</span>
        <span class="challenge-card-idx">Deep dive ${idx}</span>
      </div>
      <div class="challenge-card-title">${escapeHtml(dd.title)}</div>
      <div class="challenge-card-body">${renderMarkdownLatex(dd.body_md, this.katex)}</div>
      <div class="challenge-card-input">
        <label class="challenge-reflect-label">
          What clicked? What didn't? (optional reflection — the tutor will ask a probing question.)
        </label>
        <textarea
          class="challenge-answer"
          rows="2"
          placeholder="The key step was..."
          aria-label="Your reflection"
        ></textarea>
        <div class="challenge-card-buttons">
          <button class="primary challenge-probe">Probe my understanding</button>
        </div>
      </div>
      <div class="challenge-feedback" hidden></div>
    `

    const textarea = wrap.querySelector('.challenge-answer') as HTMLTextAreaElement
    const probeBtn = wrap.querySelector('.challenge-probe') as HTMLButtonElement
    const feedbackEl = wrap.querySelector('.challenge-feedback') as HTMLElement

    probeBtn.addEventListener('click', async () => {
      const reflection = textarea.value.trim()
      probeBtn.disabled = true
      probeBtn.textContent = 'Thinking...'
      feedbackEl.hidden = false
      feedbackEl.innerHTML = '<em>Thinking...</em>'
      try {
        const fb = await this.api.deepDiveProbe({
          deepDiveId: dd.id,
          studentReflection: reflection,
        })
        feedbackEl.innerHTML = renderMarkdownLatex(fb.message, this.katex)
      } catch (err) {
        feedbackEl.innerHTML = `<span class="error">Could not probe: ${escapeHtml(
          (err as Error).message
        )}</span>`
      } finally {
        probeBtn.disabled = false
        probeBtn.textContent = 'Probe my understanding'
      }
    })

    return wrap
  }

  private renderStretchProblemCard(p: StretchProblem, idx: number): HTMLElement {
    const wrap = this.doc.createElement('div')
    wrap.className = 'challenge-card challenge-card-stretch'
    const stepsHtml = p.solution_steps
      .map((s, i) => {
        const step = s.step_md ? renderMarkdownLatex(s.step_md, this.katex) : ''
        const why = s.why_md
          ? `<div class="challenge-step-why">${renderMarkdownLatex(s.why_md, this.katex)}</div>`
          : ''
        return `<div class="challenge-step">
          <div class="challenge-step-num">Step ${i + 1}</div>
          <div class="challenge-step-body">${step}${why}</div>
        </div>`
      })
      .join('')
    wrap.innerHTML = `
      <div class="challenge-card-head">
        <span class="challenge-card-tag">Stretch · ${escapeHtml(p.difficulty)}</span>
        <span class="challenge-card-idx">Problem ${idx}</span>
      </div>
      <div class="challenge-card-problem">${renderMarkdownLatex(p.stem, this.katex)}</div>
      <div class="challenge-card-buttons">
        <button class="ghost challenge-reveal">Show solution steps</button>
      </div>
      <div class="challenge-outline" hidden>
        <div class="challenge-outline-title">Solution steps</div>
        ${stepsHtml || '<em>No authored solution steps yet.</em>'}
      </div>
    `
    const revealBtn = wrap.querySelector('.challenge-reveal') as HTMLButtonElement
    const outlineEl = wrap.querySelector('.challenge-outline') as HTMLElement
    revealBtn.addEventListener('click', () => {
      const isHidden = outlineEl.hidden
      outlineEl.hidden = !isHidden
      revealBtn.textContent = isHidden ? 'Hide solution steps' : 'Show solution steps'
    })
    return wrap
  }

  // ------------------ Status helpers ------------------

  private setStatus(text: string, isError = false): void {
    if (!this.root) return
    const el = this.root.querySelector('#challenge-status') as HTMLElement
    el.textContent = text
    el.className = isError ? 'challenge-status challenge-status-error' : 'challenge-status'
  }

  private clearStatus(): void {
    if (!this.root) return
    const el = this.root.querySelector('#challenge-status') as HTMLElement
    el.textContent = ''
    el.className = 'challenge-status'
  }
}
