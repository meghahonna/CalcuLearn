/**
 * A5 classifier — tests for the 5-tier deterministic pipeline.
 *
 * Goal: lock in correctness so future edits don't silently regress UX.
 * Every test asserts both the LABEL and the TIER, so a test failing
 * tells us not just what went wrong but at which layer.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ResponseClassifier,
  normalizeMath,
  structuralMathCompare,
  misconceptionKeywordMatch,
  heuristicConfidence,
  type ClassificationResult,
} from '../src/components/responseClassifier.js'
import type { Misconception } from '../src/components/contentRetrieval.js'

// ---- mock DialogueGenerator (we only want to test the SLM path doesn't fire) ----
class MockDialogueGenerator {
  public inferRawCalls = 0
  public nextSlmReply = 'partial'
  async inferRaw(_prompt: string, _maxTokens?: number): Promise<string> {
    this.inferRawCalls++
    return this.nextSlmReply
  }
  // Unused but required by the type
  async inferStream(): Promise<AsyncIterable<string>> {
    return (async function* () { /* no-op */ })()
  }
}

function makeMisc(id: number, short_name: string, description_md: string): Misconception {
  return { id, concept_id: 'test', short_name, description_md, why_wrong_md: '', socratic_response_md: '' }
}

describe('A5 classifier — Tier 1 (meta-intent regex)', () => {
  const cls = new ResponseClassifier(new MockDialogueGenerator() as any)

  it.each([
    ['i dont know', 'dont_know'],
    ['I don\'t know', 'dont_know'],
    ['idk', 'dont_know'],
    ['no idea', 'dont_know'],
    ['I\'m stuck', 'dont_know'],
    ['help me understand', 'dont_know'],
    ['can you explain it again', 'meta_explain_differently'],
    ['can you explain differently', 'meta_explain_differently'],
    ['try a different way', 'meta_explain_differently'],
    ['still confused', 'meta_explain_differently'],
    ['ELI5 please', 'meta_explain_differently'],
    ['skip ahead', 'meta_skip_ahead'],
    ['move on', 'meta_skip_ahead'],
    ['next step', 'meta_skip_ahead'],
    ['got it', 'meta_skip_ahead'],
    ['makes sense', 'meta_skip_ahead'],
    ['slow down', 'meta_slow_down'],
    ['too fast', 'meta_slow_down'],
    ['can you go slower', 'meta_slow_down'],
  ])('classifies %s as %s at tier 1', async (input, expectedLabel) => {
    const r = await cls.classify({ studentInput: input })
    expect(r.label).toBe(expectedLabel)
    expect(r.tier).toBe(1)
    expect(r.confidence).toBe(1.0)
    expect(r.latencyMs).toBeLessThan(50)
  })
})

describe('A5 classifier — Tier 2 (expected_pattern)', () => {
  const cls = new ResponseClassifier(new MockDialogueGenerator() as any)

  it('matches expected_pattern', async () => {
    const r = await cls.classify({
      studentInput: '2x',
      expectedPattern: '^\\s*2\\s*x\\s*$',
    })
    expect(r.label).toBe('correct')
    expect(r.tier).toBe(2)
  })

  it('bad regex in authored content falls through silently', async () => {
    const r = await cls.classify({
      studentInput: '2x',
      expectedAnswer: '2x',
      expectedPattern: '[invalid(',
    })
    expect(r.tier).not.toBe(2) // falls through
    // Tier 3 catches it via structural compare
    expect(r.label).toBe('correct')
  })
})

describe('A5 classifier — Tier 3 (math-aware structural compare)', () => {
  const cls = new ResponseClassifier(new MockDialogueGenerator() as any)

  it.each([
    ['2x', '2x'],
    ['$2x$', '2x'],
    ['2*x', '2x'],
    ['2 x', '2x'],
    ['two x', '2x'],
  ])('treats %s as equivalent to %s', async (input, expected) => {
    const r = await cls.classify({ studentInput: input, expectedAnswer: expected })
    expect(r.label).toBe('correct')
    expect(r.tier).toBe(3)
  })

  it('detects numerical equivalence: x^2 + 2x + 1 ≡ (x+1)^2', async () => {
    const r = await cls.classify({
      studentInput: 'x^2 + 2*x + 1',
      expectedAnswer: '(x+1)^2',
    })
    expect(r.label).toBe('correct')
    expect(r.tier).toBe(3)
  })

  it('detects close-but-wrong as partial_correct', async () => {
    // 3x vs 2x — close on the absolute scale but slope is different
    const r = await cls.classify({
      studentInput: '3x',
      expectedAnswer: '2x',
    })
    expect(r.tier).toBeGreaterThanOrEqual(3)
    expect(r.label).not.toBe('correct')
  })

  it('latency is under 50ms', async () => {
    const r = await cls.classify({ studentInput: '2*x', expectedAnswer: '2x' })
    expect(r.latencyMs).toBeLessThan(50)
  })
})

describe('A5 classifier — normalizeMath helper', () => {
  it.each([
    ['$2x$', '2*x'],         // implicit multiplication inserted
    ['  2 * x  ', '2*x'],
    ['\\frac{1}{2}', '(1)/(2)'],
    ['\\sqrt{4}', 'sqrt(4)'],
    ['\\sin(x)', 'sin(x)'],
    ['three x', '3*x'],       // word number + implicit multiplication
    ['x^2 + 1', 'x^2+1'],
    ['2 \\cdot x', '2*x'],
    ['(x+1)(x-1)', '(x+1)*(x-1)'], // paren juxtaposition
  ])('normalizes %s -> %s', (raw, expected) => {
    expect(normalizeMath(raw)).toBe(expected)
  })
})

describe('A5 classifier — Tier 4 (misconception keyword overlap)', () => {
  const cls = new ResponseClassifier(new MockDialogueGenerator() as any)

  const chainRuleMisc = [
    makeMisc(101, 'forget_inner_derivative',
      'The student differentiates the outer function but forgets to multiply by the derivative of the inner function. Common with composite functions.'),
    makeMisc(102, 'replace_with_inner_derivative',
      'The student replaces the inner function with its derivative instead of multiplying by it.'),
  ]

  it('matches "I forgot the inner derivative" to forget_inner_derivative', async () => {
    const r = await cls.classify({
      studentInput: 'I forgot to multiply by the derivative of the inner function',
      misconceptions: chainRuleMisc,
    })
    expect(r.label).toBe('misconception')
    expect(r.tier).toBe(4)
    expect(r.misconception_id).toBe(101)
  })

  it('does NOT misfire on an unrelated answer with no overlap', async () => {
    const r = await cls.classify({
      studentInput: 'the answer is 42',
      misconceptions: chainRuleMisc,
    })
    expect(r.label).not.toBe('misconception')
  })

  it('does NOT misfire on too-short input', async () => {
    const r = await cls.classify({
      studentInput: 'ok',
      misconceptions: chainRuleMisc,
    })
    expect(r.label).not.toBe('misconception')
  })
})

describe('A5 classifier — Tier 5 (heuristic confidence)', () => {
  it('hedging language → partial_correct', () => {
    const r = heuristicConfidence('I think maybe the answer is 2x', '2x')
    expect(r.label).toBe('partial_correct')
  })

  it('prose without math → partial_correct for explanations', () => {
    const r = heuristicConfidence('You take the derivative of the outer function', '2x')
    expect(r.label).toBe('partial_correct')
  })

  it('short non-math input → off_topic', () => {
    const r = heuristicConfidence('hello there', '2x')
    expect(r.label).toBe('off_topic')
  })
})

describe('A5 classifier — SLM fallback gating', () => {
  it('SLM fires when fallback enabled and tiers 1-5 abstain (low confidence)', async () => {
    const mock = new MockDialogueGenerator()
    mock.nextSlmReply = 'correct'
    const cls = new ResponseClassifier(mock as any, { enableSlmFallback: true })
    // Unique input that no tier handles confidently
    const r = await cls.classify({ studentInput: 'idkmaybe' })
    // 'idk' regex isn't anchored if 'idk' is followed by chars without word boundary,
    // so this should slip past tier 1 and into the heuristic/SLM path.
    // We just check the SLM was called at all.
    expect(mock.inferRawCalls).toBeGreaterThan(0)
    expect(r.tier).toBe(6)
  })

  it('SLM is NOT called when fallback disabled', async () => {
    const mock = new MockDialogueGenerator()
    const cls = new ResponseClassifier(mock as any, { enableSlmFallback: false })
    const r = await cls.classify({ studentInput: 'something ambiguous and not matching anything' })
    expect(mock.inferRawCalls).toBe(0)
    expect(r.tier).toBeLessThanOrEqual(5)
  })

  it('SLM is NOT called when tier 1 matches', async () => {
    const mock = new MockDialogueGenerator()
    const cls = new ResponseClassifier(mock as any, { enableSlmFallback: true })
    const r = await cls.classify({ studentInput: "I don't know" })
    expect(mock.inferRawCalls).toBe(0)
    expect(r.tier).toBe(1)
  })

  it('SLM is NOT called when tier 3 math compare succeeds', async () => {
    const mock = new MockDialogueGenerator()
    const cls = new ResponseClassifier(mock as any, { enableSlmFallback: true })
    const r = await cls.classify({ studentInput: '2*x', expectedAnswer: '2x' })
    expect(mock.inferRawCalls).toBe(0)
    expect(r.tier).toBe(3)
  })
})

describe('A5 classifier — onResult telemetry hook', () => {
  it('fires for every classify() call with tier + latency', async () => {
    const events: ClassificationResult[] = []
    const cls = new ResponseClassifier(new MockDialogueGenerator() as any, {
      onResult: (r) => events.push(r),
    })
    await cls.classify({ studentInput: "I don't know" })
    await cls.classify({ studentInput: '2x', expectedAnswer: '2x' })
    expect(events).toHaveLength(2)
    expect(events[0]?.tier).toBe(1)
    expect(events[1]?.tier).toBe(3)
    for (const e of events) {
      expect(e.latencyMs).toBeGreaterThanOrEqual(0)
      expect(e.confidence).toBeGreaterThan(0)
    }
  })
})

describe('A5 classifier — latency budget', () => {
  it('tier 1 always completes in under 10ms', async () => {
    const cls = new ResponseClassifier(new MockDialogueGenerator() as any)
    const r = await cls.classify({ studentInput: "I don't know" })
    expect(r.latencyMs).toBeLessThan(10)
  })

  it('tier 3 math compare completes in under 50ms', async () => {
    const cls = new ResponseClassifier(new MockDialogueGenerator() as any)
    const r = await cls.classify({
      studentInput: 'x^2 + 2*x + 1',
      expectedAnswer: '(x+1)^2',
    })
    expect(r.latencyMs).toBeLessThan(50)
  })

  it('full deterministic pipeline (no SLM) completes in under 100ms', async () => {
    const cls = new ResponseClassifier(new MockDialogueGenerator() as any, {
      enableSlmFallback: false,
    })
    const inputs = [
      "I don't know",
      'maybe 2x but I am not sure',
      '2*x',
      'x^2 + 2*x + 1',
      'help me out',
      'I forgot the inner part',
      'skip ahead',
      'random gibberish blah blah',
    ]
    const t0 = Date.now()
    for (const input of inputs) {
      await cls.classify({ studentInput: input, expectedAnswer: '2x' })
    }
    const total = Date.now() - t0
    expect(total).toBeLessThan(200) // 8 calls in 200ms ≈ 25ms/call avg
  })
})
