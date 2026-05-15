/**
 * A3 — ConceptRouter unit tests.
 *
 * Lock in the routing for the question patterns students actually ask.
 * Uses a real SQLite-backed ContentRetrieval against the seeded
 * `data/calculearn.sqlite`, with a mock SLM that always picks the
 * first candidate (mirrors the "best tier-1 guess" semantics).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'
import { ContentRetrieval } from '../src/components/contentRetrieval.js'
import { ConceptRouter } from '../src/components/conceptRouter.js'
import type { DialogueGenerator } from '../src/components/dialogueGenerator.js'

const DB_PATH = './data/calculearn.sqlite'

class MockDialogue {
  public callCount = 0
  public nextReply: string | null = null
  async inferRaw(prompt: string, _max?: number): Promise<string> {
    this.callCount++
    if (this.nextReply !== null) return this.nextReply
    // Default: pick the first candidate from the prompt's "1. id=..."
    const m = prompt.match(/1\.\s*id=([\w.-]+)/)
    return m?.[1] ?? 'off_topic'
  }
  async inferStream(): Promise<AsyncIterable<string>> {
    return (async function* () {})()
  }
}

let db: DB
let content: ContentRetrieval
let router: ConceptRouter
let mock: MockDialogue

beforeAll(() => {
  db = new BetterSqlite3(DB_PATH, { readonly: true })
  content = new ContentRetrieval(db)
  mock = new MockDialogue()
  router = new ConceptRouter(content, mock as unknown as DialogueGenerator, {
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  })
})

afterAll(() => { db?.close() })

describe('ConceptRouter — clear-cut tier 1 cases', () => {
  const cases: Array<[string, string]> = [
    ['What is the chain rule?',                       'deriv.chain-rule'],
    ['How do I find a horizontal asymptote?',         'limits.infinity'],
    ['Explain integration by parts',                  'integ.by-parts'],
    ['I forgot how to use u-substitution',            'integ.substitution'],
    ['What is a limit?',                              'limits.definition'],
    ['What is the fundamental theorem of calculus?',  'integ.ftc'],
    ['How do I differentiate sin(x^2)?',              'deriv.chain-rule'],
    ['help me with rates of change',                  'deriv.related-rates'],
    ['Derivative of x^5?',                            'deriv.power-rule'],
    ['What is dy/dx for x^2 + y^2 = 25?',             'deriv.implicit'],
    ['Riemann sum estimate',                          'integ.riemann'],
    ['Lhopital rule',                                 'limits.lhopital'],
  ]

  it.each(cases)('routes "%s" to %s', async (q, expected) => {
    const r = await router.route(q)
    expect(r.conceptId).toBe(expected)
    expect(r.latencyMs).toBeLessThan(50)
  })
})

describe('ConceptRouter — off-topic detection', () => {
  it.each([
    ['Tell me about pizza'],
    ['What is the meaning of life?'],
    ['How do I write a Python loop?'],
    ['hello'],
    [''],
  ])('returns null conceptId for "%s"', async (q) => {
    const r = await router.route(q)
    expect(r.conceptId).toBeNull()
  })
})

describe('ConceptRouter — SLM disambiguation', () => {
  it('routes through SLM when tier-1 is ambiguous', async () => {
    mock.callCount = 0
    const r = await router.route('How do I maximize a function?')
    // The word "function" appears in many concepts; this should require tier 2
    expect(r.conceptId).toBe('deriv.optimisation')
    expect(r.tier).toBe(2)
    expect(mock.callCount).toBe(1)
  })

  it('SLM not called when tier-1 has a clear winner', async () => {
    mock.callCount = 0
    const r = await router.route('What is the chain rule?')
    expect(r.tier).toBe(1)
    expect(mock.callCount).toBe(0)
  })

  it('disableSlmDisambiguation skips the SLM entirely', async () => {
    const localMock = new MockDialogue()
    const r2 = new ConceptRouter(content, localMock as unknown as DialogueGenerator, {
      disableSlmDisambiguation: true,
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    })
    const r = await r2.route('How do I maximize a function?')
    expect(r.tier).toBe(1) // forced to use tier-1 best
    expect(localMock.callCount).toBe(0)
  })
})

describe('ConceptRouter — top candidate transparency', () => {
  it('returns top-N candidates with scores', async () => {
    const r = await router.route('What is the chain rule?')
    expect(r.candidates.length).toBeGreaterThan(0)
    expect(r.candidates.length).toBeLessThanOrEqual(3)
    // Scores should be sorted descending
    for (let i = 1; i < r.candidates.length; i++) {
      expect(r.candidates[i]!.score).toBeLessThanOrEqual(r.candidates[i - 1]!.score)
    }
  })
})

describe('ConceptRouter — latency budget', () => {
  it('clear-cut question resolves in under 50ms (no SLM)', async () => {
    const r = await router.route('What is the power rule?')
    expect(r.tier).toBe(1)
    expect(r.latencyMs).toBeLessThan(50)
  })
})
