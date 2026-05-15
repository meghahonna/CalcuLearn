/**
 * src/ui/explore.ts — A3 Explore Mode UI
 *
 * Free-form chat surface. The student types a question; the app routes
 * it to a concept and replies. Each agent message has a chip rail with
 * 3-4 follow-up actions (deterministic, no SLM).
 *
 * Reuses renderMarkdownLatex from learnMode.ts.
 */

import type { KatexLike } from './app.js'
import { renderMarkdownLatex } from './learnMode.js'

// ---------- API types ----------

interface AskResponse {
  sessionId: string
  agentMessage: string
  routedConceptId: string | null
  routedConceptName: string | null
  offTopic: boolean
  followUps: Array<{
    id: string
    label: string
    action: {
      kind: 'ask_followup' | 'open_learn' | 'open_challenge'
      question?: string
      conceptId?: string
    }
  }>
  routerVerdict?: {
    tier: 1 | 2
    confidence: number
    candidates: Array<{ conceptId: string; score: number }>
    latencyMs: number
  }
}

// ---------- API ----------

class ExploreApi {
  async start(studentId: string): Promise<{ sessionId: string }> {
    const r = await fetch('/api/explore/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    })
    if (!r.ok) throw new Error(`/api/explore/start ${r.status}: ${await r.text()}`)
    return (await r.json()) as { sessionId: string }
  }

  async ask(sessionId: string, question: string, pinConceptId?: string): Promise<AskResponse> {
    const r = await fetch(`/api/explore/ask/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pinConceptId ? { question, pinConceptId } : { question }),
    })
    if (!r.ok) throw new Error(`/api/explore/ask ${r.status}: ${await r.text()}`)
    return (await r.json()) as AskResponse
  }
}

// ---------- helpers ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ---------- UI controller ----------

export interface ExploreUiOptions {
  document: Document
  studentId: string
  katex?: KatexLike
  onOpenLearn?: (conceptId: string) => void
  onOpenChallenge?: (conceptId: string) => void
}

export class ExploreUi {
  private readonly doc: Document
  private readonly studentId: string
  private readonly katex?: KatexLike
  private readonly onOpenLearn?: (conceptId: string) => void
  private readonly onOpenChallenge?: (conceptId: string) => void
  private readonly api = new ExploreApi()
  private sessionId: string | null = null
  private chatEl: HTMLElement | null = null
  private inputEl: HTMLInputElement | null = null
  private sendBtn: HTMLButtonElement | null = null
  private statusEl: HTMLElement | null = null
  private busy = false
  /** A3: the concept the conversation is currently focused on (last route). */
  private currentConceptId: string | null = null

  constructor(opts: ExploreUiOptions) {
    this.doc = opts.document
    this.studentId = opts.studentId
    this.katex = opts.katex ?? (globalThis as { katex?: KatexLike }).katex
    this.onOpenLearn = opts.onOpenLearn
    this.onOpenChallenge = opts.onOpenChallenge
  }

  async mount(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <section class="explore-panel">
        <header class="explore-header">
          <h3>Explore Mode</h3>
          <div class="explore-subtle">
            Ask anything about AP Calculus — I'll route to the right concept and stay on the authored material.
          </div>
        </header>

        <div id="explore-chat" class="explore-chat" aria-live="polite"></div>

        <div class="explore-input-row">
          <input
            id="explore-input"
            type="text"
            class="explore-input"
            placeholder="e.g. 'What is the chain rule?' or 'How do I find a horizontal asymptote?'"
            aria-label="Your question"
          />
          <button id="explore-send" class="primary">Ask</button>
        </div>

        <div id="explore-status" class="explore-status" role="status"></div>
      </section>
    `

    this.chatEl = container.querySelector('#explore-chat') as HTMLElement
    this.inputEl = container.querySelector('#explore-input') as HTMLInputElement
    this.sendBtn = container.querySelector('#explore-send') as HTMLButtonElement
    this.statusEl = container.querySelector('#explore-status') as HTMLElement

    this.sendBtn.addEventListener('click', () => void this.handleAsk())
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void this.handleAsk()
      }
    })

    this.setStatus('Starting session...')
    try {
      const r = await this.api.start(this.studentId)
      this.sessionId = r.sessionId
      this.clearStatus()
      this.appendAgentIntro()
      this.inputEl.focus()
    } catch (err) {
      this.setStatus(`Could not start: ${(err as Error).message}`, true)
    }
  }

  // ---------- internals ----------

  private appendAgentIntro(): void {
    if (!this.chatEl) return
    this.appendAgentMessage(
      "Welcome to Explore Mode. Ask me anything about AP Calculus — limits, derivatives, integrals, ODEs. I'll find the relevant concept and answer using only the authored content.",
      [],
      null
    )
  }

  private async handleAsk(opts?: { pinConceptId?: string }): Promise<void> {
    if (!this.sessionId || !this.inputEl || this.busy) return
    const q = this.inputEl.value.trim()
    if (q.length === 0) return
    this.busy = true
    this.setSendBusy(true)
    this.appendStudent(q)
    this.inputEl.value = ''
    this.setStatus('Routing & responding...')
    try {
      const r = await this.api.ask(this.sessionId, q, opts?.pinConceptId)
      this.currentConceptId = r.routedConceptId
      this.appendAgentMessage(r.agentMessage, r.followUps, r.routedConceptName)
      if (r.routerVerdict) {
        const cands = r.routerVerdict.candidates.slice(0, 2).map((c) => c.conceptId).join(', ')
        this.setStatus(
          `tier-${r.routerVerdict.tier} · conf ${r.routerVerdict.confidence.toFixed(2)} · ${r.routerVerdict.latencyMs}ms · candidates: ${cands}`
        )
      } else {
        this.clearStatus()
      }
    } catch (err) {
      this.setStatus(`Error: ${(err as Error).message}`, true)
    } finally {
      this.busy = false
      this.setSendBusy(false)
      this.inputEl.focus()
    }
  }

  private appendStudent(text: string): void {
    if (!this.chatEl) return
    const wrap = this.doc.createElement('div')
    wrap.className = 'explore-msg explore-msg-student'
    const bubble = this.doc.createElement('div')
    bubble.className = 'explore-bubble'
    bubble.textContent = text
    wrap.appendChild(bubble)
    this.chatEl.appendChild(wrap)
    this.chatEl.scrollTop = this.chatEl.scrollHeight
  }

  private appendAgentMessage(
    text: string,
    followUps: AskResponse['followUps'],
    conceptName: string | null
  ): void {
    if (!this.chatEl) return
    const wrap = this.doc.createElement('div')
    wrap.className = 'explore-msg explore-msg-agent'

    if (conceptName) {
      const tag = this.doc.createElement('div')
      tag.className = 'explore-tag'
      tag.textContent = `concept: ${conceptName}`
      wrap.appendChild(tag)
    }

    const bubble = this.doc.createElement('div')
    bubble.className = 'explore-bubble'
    bubble.innerHTML = renderMarkdownLatex(text, this.katex)
    wrap.appendChild(bubble)

    if (followUps.length > 0) {
      const chipsEl = this.doc.createElement('div')
      chipsEl.className = 'explore-chips'
      for (const c of followUps) {
        const chip = this.doc.createElement('button')
        chip.type = 'button'
        chip.className = 'explore-chip'
        chip.textContent = c.label
        chip.addEventListener('click', () => this.handleChip(c))
        chipsEl.appendChild(chip)
      }
      wrap.appendChild(chipsEl)
    }

    this.chatEl.appendChild(wrap)
    this.chatEl.scrollTop = this.chatEl.scrollHeight
  }

  private handleChip(c: AskResponse['followUps'][number]): void {
    if (c.action.kind === 'ask_followup' && c.action.question && this.inputEl) {
      this.inputEl.value = c.action.question
      // Pin to the current concept so the chip's question doesn't drift
      // off-topic when its wording doesn't directly mention the concept.
      void this.handleAsk(
        this.currentConceptId ? { pinConceptId: this.currentConceptId } : undefined
      )
      return
    }
    if (c.action.kind === 'open_learn' && c.action.conceptId && this.onOpenLearn) {
      this.onOpenLearn(c.action.conceptId)
      return
    }
    if (c.action.kind === 'open_challenge' && c.action.conceptId && this.onOpenChallenge) {
      this.onOpenChallenge(c.action.conceptId)
      return
    }
  }

  private setSendBusy(busy: boolean): void {
    if (this.sendBtn) this.sendBtn.disabled = busy
    if (this.inputEl) this.inputEl.disabled = busy
  }

  private setStatus(text: string, isError = false): void {
    if (!this.statusEl) return
    this.statusEl.textContent = text
    this.statusEl.className = isError ? 'explore-status explore-status-error' : 'explore-status'
  }

  private clearStatus(): void {
    this.setStatus('')
  }
}
