/**
 * src/ui/adaptive.ts — Phase D
 *
 * Client-side adaptive UI helpers:
 *   - Confidence chip (after each Practice problem)
 *   - Adaptive nudge banner ("seems stuck — open Learn Mode for X?")
 *   - Challenge mode unlock indicator
 */

export type Confidence = 'got_it' | 'guessed' | 'shaky'

export type RoutingAction =
  | { kind: 'open_learn'; tier: 'novice' | 'on_pace'; reason: string }
  | { kind: 'unlock_challenge'; reason: string }
  | { kind: 'continue_practice'; reason: string }
  | { kind: 'try_alt_framing'; reason: string }
  | { kind: 'none' }

export interface RoutingSuggestion {
  conceptId: string
  archetype: 'struggling' | 'on_pace' | 'advanced' | 'unknown'
  action: RoutingAction
  message: string
}

export class AdaptiveApi {
  async recordConfidence(args: {
    studentId: string
    conceptId: string
    confidence: Confidence
  }): Promise<{ archetype: string; challengeUnlocked: boolean }> {
    const r = await fetch('/api/practice/confidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!r.ok) throw new Error(`/api/practice/confidence ${r.status}`)
    return (await r.json()) as { archetype: string; challengeUnlocked: boolean }
  }

  async getSuggestion(studentId: string, conceptId: string): Promise<RoutingSuggestion> {
    const r = await fetch(
      `/api/adaptive/suggestion?studentId=${encodeURIComponent(studentId)}&conceptId=${encodeURIComponent(conceptId)}`
    )
    if (!r.ok) throw new Error(`/api/adaptive/suggestion ${r.status}`)
    return (await r.json()) as RoutingSuggestion
  }

  async getProfile(studentId: string): Promise<unknown> {
    const r = await fetch(`/api/adaptive/profile?studentId=${encodeURIComponent(studentId)}`)
    if (!r.ok) throw new Error(`/api/adaptive/profile ${r.status}`)
    return await r.json()
  }
}

// ---------- Confidence chip ----------

export interface ConfidenceChipOpts {
  document: Document
  container: HTMLElement
  studentId: string
  /** Returns the conceptId of the just-submitted problem at the moment of click. */
  getConceptId: () => string | null
  /** Called after a confidence is recorded (so the parent can refresh suggestions). */
  onRecorded?: (confidence: Confidence) => void
}

export function mountConfidenceChip(opts: ConfidenceChipOpts): { setVisible: (v: boolean) => void } {
  const api = new AdaptiveApi()
  opts.container.classList.add('confidence-chip-row')
  opts.container.innerHTML = `
    <span class="confidence-chip-label">How sure were you?</span>
    <button class="confidence-chip" data-c="got_it">Got it</button>
    <button class="confidence-chip" data-c="guessed">Guessed</button>
    <button class="confidence-chip" data-c="shaky">Shaky</button>
  `
  const buttons = Array.from(opts.container.querySelectorAll('button.confidence-chip')) as HTMLButtonElement[]
  buttons.forEach((b) => {
    b.addEventListener('click', async () => {
      const c = (b.dataset['c'] as Confidence)
      const conceptId = opts.getConceptId()
      if (!conceptId) return
      buttons.forEach((x) => (x.disabled = true))
      b.classList.add('selected')
      try {
        await api.recordConfidence({ studentId: opts.studentId, conceptId, confidence: c })
        opts.onRecorded?.(c)
      } catch (err) {
        console.error('[confidence-chip]', err)
      }
    })
  })

  return {
    setVisible(v: boolean): void {
      opts.container.style.display = v ? '' : 'none'
      if (v) {
        buttons.forEach((b) => {
          b.disabled = false
          b.classList.remove('selected')
        })
      }
    },
  }
}

// ---------- Adaptive nudge banner ----------

export interface NudgeBannerOpts {
  document: Document
  container: HTMLElement
  studentId: string
  /** Called when the user accepts an "open_learn" or "unlock_challenge" action. */
  onAction: (action: RoutingAction, conceptId: string) => void
}

export function mountNudgeBanner(opts: NudgeBannerOpts): {
  refresh: (conceptId: string) => Promise<void>
  hide: () => void
} {
  const api = new AdaptiveApi()
  opts.container.classList.add('adaptive-nudge')
  opts.container.style.display = 'none'

  function render(s: RoutingSuggestion): void {
    if (s.action.kind === 'none' || s.action.kind === 'continue_practice' || !s.message) {
      opts.container.style.display = 'none'
      return
    }
    opts.container.style.display = ''
    let buttonText = 'Yes'
    if (s.action.kind === 'open_learn') buttonText = 'Open Learn Mode'
    if (s.action.kind === 'unlock_challenge') buttonText = 'Unlock Challenge'
    if (s.action.kind === 'try_alt_framing') buttonText = 'Show me'

    opts.container.innerHTML = `
      <div class="nudge-message">${escapeHtml(s.message)}</div>
      <div class="nudge-actions">
        <button class="nudge-accept primary">${escapeHtml(buttonText)}</button>
        <button class="nudge-dismiss ghost">Dismiss</button>
      </div>
    `
    const accept = opts.container.querySelector('.nudge-accept') as HTMLButtonElement
    const dismiss = opts.container.querySelector('.nudge-dismiss') as HTMLButtonElement
    accept.addEventListener('click', () => {
      opts.onAction(s.action, s.conceptId)
      opts.container.style.display = 'none'
    })
    dismiss.addEventListener('click', () => {
      opts.container.style.display = 'none'
    })
  }

  return {
    async refresh(conceptId: string): Promise<void> {
      try {
        const s = await api.getSuggestion(opts.studentId, conceptId)
        render(s)
      } catch (err) {
        console.error('[nudge]', err)
        opts.container.style.display = 'none'
      }
    },
    hide(): void {
      opts.container.style.display = 'none'
    },
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
