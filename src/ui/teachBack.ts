/**
 * src/ui/teachBack.ts — A2 Teach-It-Back UI
 *
 * Flow:
 *   1. App opens a teach-back card for the chosen concept
 *   2. Student types a long-form explanation
 *   3. App probes ONE gap, may surface a misconception card
 *   4. After N probes (or on Finish) app renders an assessment card:
 *      strengths, gaps, recommendations
 *
 * Reuses the markdown+LaTeX renderer from learnMode.ts.
 */

import type { KatexLike } from './app.js'
import { renderMarkdownLatex } from './learnMode.js'

// ---------- API types ----------

interface OpenerResponse {
  sessionId: string
  stage: string
  agentMessage: string
  scaffolding: string[]
}

interface ProbeResponse {
  sessionId: string
  stage: string
  agentMessage: string
  contentBlock?: {
    type: 'misconception' | 'facet'
    title: string
    body_md: string
  }
  done: boolean
  probesRemaining: number
}

interface Assessment {
  sessionId: string
  stage: 'done'
  strongSummary: string
  weakSummary: string
  closingMessage: string
  recommendations: Array<{
    kind: 'learn_alt_framing' | 'review_misconception' | 'practice'
    label: string
    target: string
  }>
}

// ---------- API client ----------

class TeachBackApi {
  async start(args: { studentId: string; conceptId: string; tier?: string }): Promise<OpenerResponse> {
    const r = await fetch('/api/teachback/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!r.ok) throw new Error(`/api/teachback/start ${r.status}: ${await r.text()}`)
    return (await r.json()) as OpenerResponse
  }

  async respond(sessionId: string, studentExplanation: string): Promise<ProbeResponse> {
    const r = await fetch(`/api/teachback/respond/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentExplanation }),
    })
    if (!r.ok) throw new Error(`/api/teachback/respond ${r.status}: ${await r.text()}`)
    return (await r.json()) as ProbeResponse
  }

  async assess(sessionId: string): Promise<Assessment> {
    const r = await fetch(`/api/teachback/assess/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
    })
    if (!r.ok) throw new Error(`/api/teachback/assess ${r.status}: ${await r.text()}`)
    return (await r.json()) as Assessment
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

// ---------- Controller ----------

export interface TeachBackUiOptions {
  document: Document
  studentId: string
  katex?: KatexLike
  /** Called when the student clicks a recommendation linking back to Learn Mode. */
  onOpenLearn?: (conceptId: string) => void
}

export class TeachBackUi {
  private readonly doc: Document
  private readonly studentId: string
  private readonly katex?: KatexLike
  private readonly onOpenLearn?: (conceptId: string) => void
  private readonly api = new TeachBackApi()
  private sessionId: string | null = null
  private conceptId: string | null = null
  private chatEl: HTMLElement | null = null
  private actionsEl: HTMLElement | null = null
  private inputEl: HTMLTextAreaElement | null = null
  private busy = false

  constructor(opts: TeachBackUiOptions) {
    this.doc = opts.document
    this.studentId = opts.studentId
    this.katex = opts.katex ?? (globalThis as { katex?: KatexLike }).katex
    this.onOpenLearn = opts.onOpenLearn
  }

  /**
   * Render the teach-back UI inside the given container for the given concept.
   * Idempotent — calling again resets the panel.
   */
  async open(container: HTMLElement, conceptId: string, conceptName: string): Promise<void> {
    this.conceptId = conceptId
    container.innerHTML = `
      <section class="teachback-panel">
        <header class="teachback-header">
          <h3>Teach it back: ${escapeHtml(conceptName)}</h3>
          <div class="teachback-subtle">
            Explain it in your own words. I'll find one gap to probe.
          </div>
        </header>

        <div id="teachback-chat" class="teachback-chat" aria-live="polite"></div>

        <div id="teachback-scaffolding" class="teachback-scaffolding"></div>

        <div class="teachback-input-row">
          <textarea
            id="teachback-input"
            class="teachback-input"
            rows="5"
            placeholder="Pretend a classmate has never seen this — explain it to them..."
            aria-label="Your explanation"
          ></textarea>
        </div>

        <div id="teachback-actions" class="teachback-actions"></div>

        <div id="teachback-status" class="teachback-status" role="status" aria-live="polite"></div>
      </section>
    `

    this.chatEl = container.querySelector('#teachback-chat') as HTMLElement
    this.actionsEl = container.querySelector('#teachback-actions') as HTMLElement
    this.inputEl = container.querySelector('#teachback-input') as HTMLTextAreaElement
    const scaffEl = container.querySelector('#teachback-scaffolding') as HTMLElement

    this.setStatus('Starting teach-back...')
    try {
      const r = await this.api.start({ studentId: this.studentId, conceptId })
      this.sessionId = r.sessionId
      this.appendAgent(r.agentMessage)
      this.renderScaffolding(scaffEl, r.scaffolding)
      this.renderInitialActions()
      this.clearStatus()
      this.inputEl.focus()
    } catch (err) {
      this.setStatus(`Could not start: ${(err as Error).message}`, true)
    }
  }

  // -------------------- internals --------------------

  private renderScaffolding(el: HTMLElement, scaffolds: string[]): void {
    if (scaffolds.length === 0) {
      el.innerHTML = ''
      return
    }
    el.innerHTML = `
      <details class="teachback-hints">
        <summary>Want a few prompts to get started?</summary>
        <ul>
          ${scaffolds.map((s) => `<li>${renderMarkdownLatex(s, this.katex)}</li>`).join('')}
        </ul>
      </details>
    `
  }

  private renderInitialActions(): void {
    if (!this.actionsEl) return
    this.actionsEl.innerHTML = `
      <button id="teachback-send" class="primary">Submit explanation</button>
      <button id="teachback-finish" class="ghost">Finish &amp; see assessment</button>
    `
    const send = this.actionsEl.querySelector('#teachback-send') as HTMLButtonElement
    const finish = this.actionsEl.querySelector('#teachback-finish') as HTMLButtonElement
    send.addEventListener('click', () => void this.handleSend())
    finish.addEventListener('click', () => void this.handleAssess())
    // Submit on Ctrl/Cmd+Enter
    this.inputEl?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void this.handleSend()
      }
    })
  }

  private async handleSend(): Promise<void> {
    if (!this.sessionId || !this.inputEl || this.busy) return
    const text = this.inputEl.value.trim()
    if (text.length < 10) {
      this.setStatus('Give it a real swing — at least a sentence or two.', true)
      return
    }
    this.busy = true
    this.setSendBusy(true)
    this.appendStudent(text)
    this.inputEl.value = ''
    this.setStatus('Probing...')
    try {
      const r = await this.api.respond(this.sessionId, text)
      this.appendAgent(r.agentMessage)
      if (r.contentBlock) {
        this.appendContentBlock(r.contentBlock.type, r.contentBlock.title, r.contentBlock.body_md)
      }
      if (r.done) {
        // The service signalled it has reached the probe cap; auto-trigger assessment.
        await this.handleAssess()
      } else {
        this.setStatus(`${r.probesRemaining} ${r.probesRemaining === 1 ? 'probe' : 'probes'} left.`)
      }
    } catch (err) {
      this.setStatus(`Error: ${(err as Error).message}`, true)
    } finally {
      this.busy = false
      this.setSendBusy(false)
      this.inputEl.focus()
    }
  }

  private async handleAssess(): Promise<void> {
    if (!this.sessionId || this.busy) return
    this.busy = true
    this.setSendBusy(true)
    this.setStatus('Putting it all together...')
    try {
      const a = await this.api.assess(this.sessionId)
      this.appendAssessment(a)
      // Lock the panel
      if (this.inputEl) this.inputEl.disabled = true
      if (this.actionsEl) {
        this.actionsEl.innerHTML = `
          <button id="teachback-retry" class="primary">Try another teach-back</button>
        `
        const retry = this.actionsEl.querySelector('#teachback-retry') as HTMLButtonElement
        retry.addEventListener('click', () => {
          // Bubble up via DOM: reload the same panel with the same conceptId.
          if (this.conceptId) {
            // Find parent container by walking up from chatEl
            const root = this.chatEl?.closest('.teachback-host') as HTMLElement | null
            if (root) {
              void this.open(root, this.conceptId, this.conceptId)
            }
          }
        })
      }
      this.clearStatus()
    } catch (err) {
      this.setStatus(`Could not assess: ${(err as Error).message}`, true)
    } finally {
      this.busy = false
    }
  }

  private appendAgent(text: string): void {
    if (!this.chatEl) return
    const wrap = this.doc.createElement('div')
    wrap.className = 'teachback-msg teachback-msg-agent'
    const bubble = this.doc.createElement('div')
    bubble.className = 'teachback-bubble'
    bubble.innerHTML = renderMarkdownLatex(text, this.katex)
    wrap.appendChild(bubble)
    this.chatEl.appendChild(wrap)
    this.chatEl.scrollTop = this.chatEl.scrollHeight
  }

  private appendStudent(text: string): void {
    if (!this.chatEl) return
    const wrap = this.doc.createElement('div')
    wrap.className = 'teachback-msg teachback-msg-student'
    const bubble = this.doc.createElement('div')
    bubble.className = 'teachback-bubble'
    bubble.innerHTML = renderMarkdownLatex(text, this.katex)
    wrap.appendChild(bubble)
    this.chatEl.appendChild(wrap)
    this.chatEl.scrollTop = this.chatEl.scrollHeight
  }

  private appendContentBlock(type: string, title: string, body: string): void {
    if (!this.chatEl) return
    const wrap = this.doc.createElement('div')
    wrap.className = `teachback-block teachback-block-${type}`
    wrap.innerHTML = `
      <div class="teachback-block-title">${escapeHtml(title)}</div>
      <div class="teachback-block-body">${renderMarkdownLatex(body, this.katex)}</div>
    `
    this.chatEl.appendChild(wrap)
    this.chatEl.scrollTop = this.chatEl.scrollHeight
  }

  private appendAssessment(a: Assessment): void {
    if (!this.chatEl) return
    const wrap = this.doc.createElement('div')
    wrap.className = 'teachback-assessment'
    const recHtml = a.recommendations
      .map(
        (r) =>
          `<button class="teachback-rec" data-kind="${escapeHtml(r.kind)}" data-target="${escapeHtml(r.target)}">${escapeHtml(r.label)}</button>`
      )
      .join('')
    wrap.innerHTML = `
      <div class="teachback-assessment-head">Assessment</div>
      <div class="teachback-assessment-grid">
        <div class="teachback-assessment-col">
          <div class="teachback-col-title strong">What landed</div>
          <div class="teachback-col-body">${renderMarkdownLatex(a.strongSummary, this.katex)}</div>
        </div>
        <div class="teachback-assessment-col">
          <div class="teachback-col-title weak">What's still thin</div>
          <div class="teachback-col-body">${renderMarkdownLatex(a.weakSummary, this.katex)}</div>
        </div>
      </div>
      <div class="teachback-closing">${renderMarkdownLatex(a.closingMessage, this.katex)}</div>
      <div class="teachback-recs">${recHtml}</div>
    `
    this.chatEl.appendChild(wrap)
    this.chatEl.scrollTop = this.chatEl.scrollHeight

    // Wire recommendation buttons
    wrap.querySelectorAll('.teachback-rec').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = (btn as HTMLElement).dataset['kind'] ?? ''
        const target = (btn as HTMLElement).dataset['target'] ?? ''
        if ((kind === 'learn_alt_framing' || kind === 'review_misconception') && this.onOpenLearn) {
          this.onOpenLearn(target)
        }
        // 'practice' kind just closes/dismisses the teach-back for now
      })
    })
  }

  private setSendBusy(busy: boolean): void {
    const send = this.actionsEl?.querySelector('#teachback-send') as HTMLButtonElement | null
    const finish = this.actionsEl?.querySelector('#teachback-finish') as HTMLButtonElement | null
    if (send) send.disabled = busy
    if (finish) finish.disabled = busy
    if (this.inputEl) this.inputEl.disabled = busy
  }

  private setStatus(text: string, isError = false): void {
    const el = this.doc.getElementById('teachback-status') as HTMLElement | null
    if (!el) return
    el.textContent = text
    el.className = isError ? 'teachback-status teachback-status-error' : 'teachback-status'
  }

  private clearStatus(): void {
    this.setStatus('')
  }
}
