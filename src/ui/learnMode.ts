/**
 * src/ui/learnMode.ts
 *
 * Phase C — Learn Mode UI controller.
 *
 * Talks to the Phase B endpoints:
 *   GET  /api/learn/concepts
 *   POST /api/learn/start
 *   POST /api/learn/respond/:sid
 *
 * Renders a Socratic walkthrough: agent message, optional content block
 * (rendered as markdown + KaTeX), suggested-action chips, free-text input.
 *
 * The on-device SLM produces conversational glue; substantive math content
 * comes from pre-authored DB blocks.
 */

import type { KatexLike } from './app.js'

// ---------- API types (mirror server contract) ----------

export interface ConceptListItem {
  id: string
  name: string
  one_liner: string | null
  track: 'AB' | 'BC' | 'BOTH'
  prerequisites: string[]
  difficulty: number | null
}

export interface LearnTurnResponse {
  sessionId: string
  stage: string
  agentMessage: string
  contentBlock?: {
    type: 'explanation' | 'intuition' | 'example' | 'check' | 'misconception'
    body_md: string
    title?: string
  }
  done: boolean
  suggestedActions?: string[]
}

export type LearnTier = 'novice' | 'on_pace' | 'advanced'

// ---------- Lightweight markdown -> HTML (with LaTeX) ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Render markdown with embedded LaTeX into safe HTML.
 *
 * Supports:
 *   - Headings (#, ##, ###)
 *   - Bold (**text**)
 *   - Italic (*text*)
 *   - Inline code (`text`)
 *   - Numbered lists (1. ...)
 *   - Bulleted lists (- ...)
 *   - Paragraphs separated by blank lines
 *   - Inline LaTeX ($...$) and block LaTeX ($$...$$)
 *
 * No HTML tags pass through; everything is escaped first, then we
 * re-introduce safe markup.
 */
export function renderMarkdownLatex(md: string, katex?: KatexLike): string {
  // 1. Extract LaTeX blocks/inlines so they aren't escaped.
  const latexTokens: Array<{ display: boolean; latex: string }> = []
  let working = md.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
    latexTokens.push({ display: true, latex })
    return `\u0000LX${latexTokens.length - 1}\u0000`
  })
  working = working.replace(/\$([^$\n]+?)\$/g, (_, latex) => {
    latexTokens.push({ display: false, latex })
    return `\u0000LX${latexTokens.length - 1}\u0000`
  })

  // 2. Escape everything else.
  working = escapeHtml(working)

  // 3. Apply markdown transforms line-by-line.
  const lines = working.split('\n')
  const out: string[] = []
  let inList: 'ul' | 'ol' | null = null
  let paragraph: string[] = []

  function flushParagraph(): void {
    if (paragraph.length > 0) {
      out.push(`<p>${paragraph.join(' ')}</p>`)
      paragraph = []
    }
  }
  function closeList(): void {
    if (inList) {
      out.push(`</${inList}>`)
      inList = null
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line.length === 0) {
      flushParagraph()
      closeList()
      continue
    }
    // Headings
    const h3 = line.match(/^### (.*)$/)
    const h2 = line.match(/^## (.*)$/)
    const h1 = line.match(/^# (.*)$/)
    if (h1) { flushParagraph(); closeList(); out.push(`<h3>${h1[1]}</h3>`); continue }
    if (h2) { flushParagraph(); closeList(); out.push(`<h3>${h2[1]}</h3>`); continue }
    if (h3) { flushParagraph(); closeList(); out.push(`<h4>${h3[1]}</h4>`); continue }

    // Numbered list
    const ol = line.match(/^\d+\.\s+(.*)$/)
    if (ol) {
      flushParagraph()
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol' }
      out.push(`<li>${ol[1]}</li>`)
      continue
    }
    // Bulleted list
    const ul = line.match(/^-\s+(.*)$/)
    if (ul) {
      flushParagraph()
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul' }
      out.push(`<li>${ul[1]}</li>`)
      continue
    }
    // Otherwise accumulate as paragraph
    closeList()
    paragraph.push(line)
  }
  flushParagraph()
  closeList()

  let html = out.join('\n')

  // 4. Inline emphasis (bold then italic) and code.
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // italic must NOT match inside a word; require boundary or whitespace
  html = html.replace(/(^|\s|>)\*([^*\n]+)\*(?=\s|<|$|[.,;:!?])/g, '$1<em>$2</em>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 5. Re-insert LaTeX rendered via KaTeX.
  html = html.replace(/\u0000LX(\d+)\u0000/g, (_, idx) => {
    const tok = latexTokens[Number(idx)]
    if (!tok) return ''
    if (katex) {
      try {
        return katex.renderToString(tok.latex, {
          displayMode: tok.display,
          throwOnError: false,
        })
      } catch {
        return `<span class="math">${escapeHtml(tok.latex)}</span>`
      }
    }
    return `<span class="math">${escapeHtml(tok.latex)}</span>`
  })

  return html
}

// ---------- API client ----------

class LearnApi {
  async listConcepts(): Promise<ConceptListItem[]> {
    const r = await fetch('/api/learn/concepts')
    if (!r.ok) throw new Error(`/api/learn/concepts ${r.status}`)
    const data = (await r.json()) as { concepts: ConceptListItem[] }
    return data.concepts
  }

  async start(args: { studentId: string; conceptId: string; tier: LearnTier }): Promise<LearnTurnResponse> {
    const r = await fetch('/api/learn/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!r.ok) throw new Error(`/api/learn/start ${r.status}: ${await r.text()}`)
    return (await r.json()) as LearnTurnResponse
  }

  async respond(sessionId: string, studentInput: string): Promise<LearnTurnResponse> {
    const r = await fetch(`/api/learn/respond/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentInput }),
    })
    if (!r.ok) throw new Error(`/api/learn/respond ${r.status}: ${await r.text()}`)
    return (await r.json()) as LearnTurnResponse
  }
}

// ---------- Controller ----------

export interface LearnModeUiOptions {
  document: Document
  studentId: string
  katex?: KatexLike
  /** A2: called when the student clicks "Teach it back" on the Learn done card. */
  onTeachBack?: (conceptId: string, conceptName: string) => void
}

interface ChatMessage {
  role: 'agent' | 'student'
  text: string
  block?: LearnTurnResponse['contentBlock']
}

export class LearnModeUi {
  private readonly doc: Document
  private readonly studentId: string
  private readonly katex?: KatexLike
  private readonly onTeachBack?: (conceptId: string, conceptName: string) => void
  private readonly api = new LearnApi()
  private sessionId: string | null = null
  private currentConceptId: string | null = null
  private currentConceptName: string | null = null
  private messages: ChatMessage[] = []
  private busy = false
  /** A1: tracks which slot visuals have been injected in this session. */
  private injectedSlots = new Set<string>()

  // Element refs
  private panel!: HTMLElement
  private picker!: HTMLElement
  private chat!: HTMLElement
  private chatInput!: HTMLInputElement
  private sendBtn!: HTMLButtonElement
  private actionsRow!: HTMLElement
  private statusEl!: HTMLElement
  private headerInfo!: HTMLElement

  constructor(opts: LearnModeUiOptions) {
    this.doc = opts.document
    this.studentId = opts.studentId
    this.katex = opts.katex ?? (globalThis as { katex?: KatexLike }).katex
    this.onTeachBack = opts.onTeachBack
  }

  /** Mount the Learn Mode panel inside the given container. */
  async mount(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <section id="learn-panel" class="panel">
        <div class="learn-header">
          <h2>Learn Mode</h2>
          <div id="learn-header-info" class="learn-header-info"></div>
        </div>

        <!-- Topic picker (shown before a session starts) -->
        <div id="learn-picker">
          <p class="learn-intro">
            Pick a concept and tell me the pace you want.
            I'll walk you through it step by step.
          </p>
          <div id="learn-concept-list" class="learn-concept-list"></div>
        </div>

        <!-- Chat (shown once a session starts) -->
        <div id="learn-chat-wrap" hidden>
          <div id="learn-chat" class="learn-chat" aria-live="polite"></div>
          <div id="learn-actions" class="learn-actions"></div>
          <div class="learn-input-row">
            <input
              id="learn-input"
              type="text"
              autocomplete="off"
              placeholder="Type your answer or 'I don't know'..."
              aria-label="Your response"
            />
            <button id="learn-send" class="primary">Send</button>
            <button id="learn-back" class="ghost">New topic</button>
          </div>
        </div>

        <div id="learn-status" class="learn-status" role="status" aria-live="polite"></div>
      </section>
    `

    this.panel       = container.querySelector('#learn-panel')         as HTMLElement
    this.picker      = container.querySelector('#learn-picker')        as HTMLElement
    this.chat        = container.querySelector('#learn-chat')          as HTMLElement
    this.chatInput   = container.querySelector('#learn-input')         as HTMLInputElement
    this.sendBtn     = container.querySelector('#learn-send')          as HTMLButtonElement
    this.actionsRow  = container.querySelector('#learn-actions')       as HTMLElement
    this.statusEl    = container.querySelector('#learn-status')        as HTMLElement
    this.headerInfo  = container.querySelector('#learn-header-info')   as HTMLElement
    const backBtn    = container.querySelector('#learn-back')          as HTMLButtonElement

    this.sendBtn.addEventListener('click', () => void this.handleSend())
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void this.handleSend()
      }
    })
    backBtn.addEventListener('click', () => this.resetToPicker())

    await this.loadConceptList()
  }

  /** Skip the picker and start a session for a specific concept. */
  async startConcept(conceptId: string, tier: LearnTier = 'novice'): Promise<void> {
    await this.startSession(conceptId, tier)
  }

  /** Current concept (used by integrations like the teach-back trigger). */
  getCurrentConceptId(): string | null {
    return this.currentConceptId
  }

  // -------------------- internals --------------------

  private async loadConceptList(): Promise<void> {
    this.setStatus('Loading concepts...')
    try {
      const concepts = await this.api.listConcepts()
      const listEl = this.doc.getElementById('learn-concept-list') as HTMLElement
      listEl.innerHTML = ''
      if (concepts.length === 0) {
        listEl.innerHTML = '<p class="learn-empty">No concepts authored yet.</p>'
        this.clearStatus()
        return
      }
      for (const c of concepts) {
        const card = this.doc.createElement('div')
        card.className = 'learn-concept-card'
        card.dataset['conceptId'] = c.id
        card.innerHTML = `
          <div class="learn-concept-name">${escapeHtml(c.name)}</div>
          <div class="learn-concept-oneliner">${escapeHtml(c.one_liner ?? '')}</div>
          <div class="learn-concept-row">
            <span class="learn-concept-meta">Track: ${c.track}</span>
            <span class="learn-concept-meta">Difficulty: ${c.difficulty ?? '-'}</span>
          </div>
          <div class="learn-tier-row">
            <button data-tier="novice" class="ghost">Slow & simple</button>
            <button data-tier="on_pace" class="ghost">Match the class</button>
            <button data-tier="advanced" class="ghost">Push me</button>
          </div>
        `
        card.querySelectorAll('button[data-tier]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const tier = (btn as HTMLButtonElement).dataset['tier'] as LearnTier
            void this.startSession(c.id, tier)
          })
        })
        listEl.appendChild(card)
      }
      this.clearStatus()
    } catch (err) {
      this.setStatus(`Could not load concepts: ${(err as Error).message}`, true)
    }
  }

  private async startSession(conceptId: string, tier: LearnTier): Promise<void> {
    this.busy = true
    this.setStatus('Starting Learn Mode...')
    this.injectedSlots.clear()
    try {
      const r = await this.api.start({ studentId: this.studentId, conceptId, tier })
      this.sessionId = r.sessionId
      this.currentConceptId = conceptId
      // Try to find the concept name from the picker list we previously loaded.
      const listEl = this.doc.getElementById('learn-concept-list')
      const card = listEl?.querySelector(
        '.learn-concept-card[data-concept-id="' + conceptId + '"] .learn-concept-name'
      )
      this.currentConceptName = (card?.textContent ?? conceptId).trim()
      this.messages = []
      this.picker.hidden = true
      ;(this.doc.getElementById('learn-chat-wrap') as HTMLElement).hidden = false
      this.headerInfo.textContent = `${conceptId} · ${tier}`
      this.applyTurn(r)
    } catch (err) {
      this.setStatus(`Failed to start: ${(err as Error).message}`, true)
    } finally {
      this.busy = false
    }
  }

  private async handleSend(): Promise<void> {
    if (this.busy) return
    const text = this.chatInput.value.trim()
    if (!text || !this.sessionId) return
    this.busy = true
    this.sendBtn.disabled = true
    this.chatInput.disabled = true
    this.appendMessage({ role: 'student', text })
    this.chatInput.value = ''
    this.setStatus('Thinking...')
    try {
      const r = await this.api.respond(this.sessionId, text)
      this.applyTurn(r)
    } catch (err) {
      this.setStatus(`Error: ${(err as Error).message}`, true)
    } finally {
      this.busy = false
      this.sendBtn.disabled = false
      this.chatInput.disabled = false
      this.chatInput.focus()
    }
  }

  private applyTurn(r: LearnTurnResponse): void {
    this.appendMessage({
      role: 'agent',
      text: r.agentMessage,
      block: r.contentBlock,
    })
    // A1: inject inline visuals after the first explanation is delivered.
    // A1.3: also inject example-slot visuals when an example is delivered.
    if (this.currentConceptId) {
      if (r.stage === 'explain' && !this.injectedSlots.has('explanation')) {
        this.injectedSlots.add('explanation')
        void this.injectVisuals(this.currentConceptId, 'explanation')
      } else if (r.stage === 'example' && !this.injectedSlots.has('example')) {
        this.injectedSlots.add('example')
        void this.injectVisuals(this.currentConceptId, 'example')
      }
    }
    this.renderActions(r.suggestedActions ?? [])
    this.headerInfo.textContent = `Stage: ${r.stage}${r.done ? ' · done' : ''}`
    this.clearStatus()
    if (r.done) {
      this.chatInput.disabled = true
      this.sendBtn.disabled = true
      // A2 entry point: surface a teach-back trigger on the done screen.
      if (this.onTeachBack && this.currentConceptId) {
        const trigger = this.doc.createElement('button')
        trigger.className = 'teachback-trigger'
        trigger.textContent = 'Teach it back to lock it in'
        trigger.style.marginTop = '0.6rem'
        trigger.addEventListener('click', () => {
          if (this.currentConceptId && this.currentConceptName) {
            this.onTeachBack!(this.currentConceptId, this.currentConceptName)
          }
        })
        this.actionsRow.appendChild(trigger)
      }
    }
  }

  /**
   * A1: Fetch visuals for the current concept and render them inline in the
   * chat as an "agent" message. Best-effort — failure is silent.
   */
  private async injectVisuals(conceptId: string, slot: string): Promise<void> {
    try {
      const url = `/api/visuals/list?conceptId=${encodeURIComponent(conceptId)}&slot=${encodeURIComponent(slot)}`
      const resp = await fetch(url)
      if (!resp.ok) return
      const data = (await resp.json()) as { visuals: Array<{ spec: unknown; title?: string; captionMd?: string }> }
      if (!data.visuals || data.visuals.length === 0) return
      const { renderVisual } = await import('../visuals/render.js')
      for (const v of data.visuals) {
        const wrap = this.doc.createElement('div')
        wrap.className = 'learn-msg learn-msg-agent'
        const bubble = this.doc.createElement('div')
        bubble.className = 'learn-bubble visual-bubble'
        if (v.title) {
          const titleEl = this.doc.createElement('div')
          titleEl.className = 'visual-title'
          titleEl.textContent = v.title
          bubble.appendChild(titleEl)
        }
        const node = renderVisual(v.spec as never)
        bubble.appendChild(node)
        if (v.captionMd) {
          const cap = this.doc.createElement('div')
          cap.className = 'visual-caption'
          cap.innerHTML = renderMarkdownLatex(v.captionMd, this.katex)
          bubble.appendChild(cap)
        }
        wrap.appendChild(bubble)
        this.chat.appendChild(wrap)
      }
      this.chat.scrollTop = this.chat.scrollHeight
    } catch (err) {
      console.warn('[learn] visual injection failed:', err)
    }
  }

    private appendMessage(m: ChatMessage): void {
    this.messages.push(m)
    const wrap = this.doc.createElement('div')
    wrap.className = `learn-msg learn-msg-${m.role}`
    const bubble = this.doc.createElement('div')
    bubble.className = 'learn-bubble'
    bubble.innerHTML = renderMarkdownLatex(m.text, this.katex)
    wrap.appendChild(bubble)

    if (m.block) {
      const block = this.doc.createElement('div')
      block.className = `learn-content-block learn-block-${m.block.type}`
      const inner = []
      if (m.block.title) {
        inner.push(`<div class="learn-block-title">${escapeHtml(m.block.title)}</div>`)
      }
      inner.push(`<div class="learn-block-body">${renderMarkdownLatex(m.block.body_md, this.katex)}</div>`)
      block.innerHTML = inner.join('')
      wrap.appendChild(block)
    }
    this.chat.appendChild(wrap)
    this.chat.scrollTop = this.chat.scrollHeight
  }

  private renderActions(actions: string[]): void {
    this.actionsRow.innerHTML = ''
    for (const a of actions) {
      const btn = this.doc.createElement('button')
      btn.type = 'button'
      btn.className = 'learn-chip'
      btn.textContent = a
      btn.addEventListener('click', () => {
        this.chatInput.value = a
        void this.handleSend()
      })
      this.actionsRow.appendChild(btn)
    }
  }

  private resetToPicker(): void {
    this.sessionId = null
    this.messages = []
    this.chat.innerHTML = ''
    this.actionsRow.innerHTML = ''
    this.chatInput.value = ''
    this.chatInput.disabled = false
    this.sendBtn.disabled = false
    ;(this.doc.getElementById('learn-chat-wrap') as HTMLElement).hidden = true
    this.picker.hidden = false
    this.headerInfo.textContent = ''
    this.clearStatus()
  }

  private setStatus(text: string, isError = false): void {
    this.statusEl.textContent = text
    this.statusEl.className = isError ? 'learn-status learn-status-error' : 'learn-status'
  }

  private clearStatus(): void {
    this.statusEl.textContent = ''
    this.statusEl.className = 'learn-status'
  }
}
