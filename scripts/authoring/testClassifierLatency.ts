/**
 * scripts/authoring/testClassifierLatency.ts
 *
 * A5 smoke test: boots the full app (including Gemma), then puts the
 * ResponseClassifier through a battery of real-world inputs, recording
 * the tier and latency for each. Prints a summary table and fast-path
 * hit rate.
 *
 * Run: npx tsx scripts/authoring/testClassifierLatency.ts
 */

import { createApp } from '../../src/main.js'
import { parseQuantisationOverride } from '../../src/bootstrap.js'
import type { ClassificationResult } from '../../src/components/responseClassifier.js'

interface TestCase {
  desc: string
  input: string
  expectedAnswer?: string
  expectedPattern?: string
  expectedTier?: number  // for assertion-style tests
}

const CASES: TestCase[] = [
  // Tier 1: meta-intent regexes
  { desc: "T1: dont know",      input: "I don't know",                              expectedTier: 1 },
  { desc: "T1: idk",            input: "idk",                                       expectedTier: 1 },
  { desc: "T1: explain again",  input: "can you explain it differently",            expectedTier: 1 },
  { desc: "T1: slow down",      input: "slow down please",                          expectedTier: 1 },
  { desc: "T1: skip ahead",     input: "got it, move on",                           expectedTier: 1 },
  { desc: "T1: i'm lost",       input: "I'm lost",                                  expectedTier: 1 },

  // Tier 2: expected_pattern
  { desc: "T2: pattern match",  input: "2x",   expectedPattern: "^\\s*2\\s*x\\s*$", expectedTier: 2 },

  // Tier 3: math compare
  { desc: "T3: 2*x vs 2x",      input: "2*x",          expectedAnswer: "2x",                expectedTier: 3 },
  { desc: "T3: $2x$ vs 2x",     input: "$2x$",         expectedAnswer: "2x",                expectedTier: 3 },
  { desc: "T3: two x vs 2x",    input: "two x",        expectedAnswer: "2x",                expectedTier: 3 },
  { desc: "T3: expand square",  input: "x^2+2*x+1",    expectedAnswer: "(x+1)^2",           expectedTier: 3 },
  { desc: "T3: 1/2 vs frac",    input: "0.5",          expectedAnswer: "\\frac{1}{2}",      expectedTier: 3 },
  { desc: "T3: trig identity",  input: "sin(x)^2+cos(x)^2", expectedAnswer: "1",            expectedTier: 3 },

  // Tier 5: heuristics
  { desc: "T5: prose answer",   input: "you take the derivative of the outer function and multiply", expectedAnswer: "f'(g(x))*g'(x)" },

  // Anything ambiguous: SLM fallback OR tier 5
  { desc: "T?: gibberish",      input: "blah blah blah" },
]

async function main(): Promise<void> {
  console.log('[A5] Booting full app...')
  const app = await createApp({
    dbPath: process.env['DB_PATH'] ?? './data/calculearn.sqlite',
    modelDir: process.env['MODEL_DIR'] ?? './models',
    gemmaHashes: {
      Q4_K_M: process.env['GEMMA_Q4_SHA256'] ?? '',
      Q8: process.env['GEMMA_Q8_SHA256'] ?? '',
    },
    quantisation: parseQuantisationOverride(process.env['GEMMA_QUANTISATION']),
  })

  const records: Array<{ desc: string; input: string; result: ClassificationResult }> = []

  // Use the chain-rule misconception catalog so tier 4 has something to match
  const miscs = app.contentRetrieval.listMisconceptions('deriv.chain-rule')
  console.log(`[A5] Loaded ${miscs.length} chain-rule misconceptions for tier-4 testing\n`)

  // Add tier-4 cases now that we have real misconceptions
  CASES.push({
    desc: "T4: forgot inner derivative",
    input: "I forgot to multiply by the derivative of the inner function",
    expectedTier: 4,
  })

  console.log('Running test cases (no Gemma calls unless tier 6 fires)...\n')
  console.log(
    '  ' +
    'tier'.padStart(5) + '  ' +
    'label'.padEnd(28) + '  ' +
    'ms'.padStart(8) + '  ' +
    'conf'.padStart(5) + '  ' +
    'desc'
  )
  console.log('  ' + '-'.repeat(80))

  for (const tc of CASES) {
    const result = await app.responseClassifier.classify({
      studentInput: tc.input,
      expectedAnswer: tc.expectedAnswer,
      expectedPattern: tc.expectedPattern,
      misconceptions: miscs,
      questionContext: 'What is the derivative of f(g(x))?',
    })
    records.push({ desc: tc.desc, input: tc.input, result })

    const tierStr = String(result.tier).padStart(5)
    const labelStr = result.label.padEnd(28)
    const msStr = String(result.latencyMs).padStart(8)
    const confStr = result.confidence.toFixed(2).padStart(5)
    const okMark = tc.expectedTier !== undefined
      ? (result.tier === tc.expectedTier ? '  ' : ' X')
      : '  '
    console.log(`${okMark}${tierStr}  ${labelStr}  ${msStr}  ${confStr}  ${tc.desc}`)
  }

  // Summary
  console.log('\n--- Summary ---')
  const byTier: Record<number, { count: number; totalMs: number }> = {}
  for (const r of records) {
    const t = r.result.tier
    if (!byTier[t]) byTier[t] = { count: 0, totalMs: 0 }
    byTier[t]!.count++
    byTier[t]!.totalMs += r.result.latencyMs
  }
  for (const [tier, stats] of Object.entries(byTier).sort()) {
    const avg = stats.totalMs / stats.count
    console.log(`  Tier ${tier}: ${stats.count} call(s), avg ${avg.toFixed(1)}ms`)
  }
  const fastCount = records.filter((r) => r.result.tier <= 5).length
  const totalCount = records.length
  console.log(`\n  Fast-path hit rate: ${fastCount}/${totalCount} (${((fastCount/totalCount)*100).toFixed(1)}%)`)

  const slmHits = records.filter((r) => r.result.tier === 6).length
  console.log(`  SLM fallback fired: ${slmHits} time(s)`)

  // Assertion check on expectedTier
  let mismatches = 0
  for (let i = 0; i < records.length; i++) {
    const tc = CASES[i]!
    if (tc.expectedTier !== undefined && records[i]!.result.tier !== tc.expectedTier) {
      console.log(`  WARN: expected tier ${tc.expectedTier} for "${tc.desc}", got ${records[i]!.result.tier}`)
      mismatches++
    }
  }
  if (mismatches === 0) console.log(`  All expectedTier assertions passed.`)

  app.close()
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
