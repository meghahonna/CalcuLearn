/**
 * scripts/authoring/testLearnMode.ts
 *
 * End-to-end smoke test for Phase B Learn Mode.
 * Exercises the state machine without going through the HTTP server,
 * so we can iterate quickly and see structured output.
 *
 * Run: npx tsx scripts/authoring/testLearnMode.ts [conceptId]
 */

import { createApp } from '../../src/main.js'
import { parseQuantisationOverride } from '../../src/bootstrap.js'

async function main(): Promise<void> {
  const conceptId = process.argv[2] || 'deriv.chain-rule'
  const tier = (process.argv[3] || 'novice') as 'novice' | 'on_pace' | 'advanced'

  const app = await createApp({
    dbPath: process.env['DB_PATH'] ?? './data/calculearn.sqlite',
    modelDir: process.env['MODEL_DIR'] ?? './models',
    gemmaHashes: {
      Q4_K_M: process.env['GEMMA_Q4_SHA256'] ?? '',
      Q8: process.env['GEMMA_Q8_SHA256'] ?? '',
    },
    quantisation: parseQuantisationOverride(process.env['GEMMA_QUANTISATION']),
  })

  console.log('\n========================================')
  console.log(`Learn Mode E2E test`)
  console.log(`Concept: ${conceptId}`)
  console.log(`Tier:    ${tier}`)
  console.log('========================================\n')

  let t0 = Date.now()
  const r1 = await app.learnModeService.start({
    studentId: 'e2e_test_student',
    conceptId,
    tier,
  })
  console.log(`--- Turn 1 (start) [${Date.now() - t0}ms] ---`)
  console.log(`stage:  ${r1.stage}`)
  console.log(`agent:  ${r1.agentMessage}`)
  if (r1.contentBlock) {
    console.log(`block.type: ${r1.contentBlock.type}`)
    console.log(`block.body: ${r1.contentBlock.body_md.slice(0, 200)}...`)
  }
  console.log(`actions: ${r1.suggestedActions?.join(' | ')}`)

  // Turn 2: "I don't know" — should trigger explanation delivery
  t0 = Date.now()
  const r2 = await app.learnModeService.respond({
    sessionId: r1.sessionId,
    studentInput: "I don't know anything about it",
  })
  console.log(`\n--- Turn 2 (student: I don't know) [${Date.now() - t0}ms] ---`)
  console.log(`stage:  ${r2.stage}`)
  console.log(`agent:  ${r2.agentMessage}`)
  if (r2.contentBlock) {
    console.log(`block.type: ${r2.contentBlock.type}`)
    console.log(`block.body (first 300): ${r2.contentBlock.body_md.slice(0, 300)}...`)
  }

  // Turn 3: "I read it"
  t0 = Date.now()
  const r3 = await app.learnModeService.respond({
    sessionId: r1.sessionId,
    studentInput: "OK, I read it. Ask me something.",
  })
  console.log(`\n--- Turn 3 (student: I read it) [${Date.now() - t0}ms] ---`)
  console.log(`stage:  ${r3.stage}`)
  console.log(`agent:  ${r3.agentMessage}`)
  if (r3.contentBlock) {
    console.log(`block.type: ${r3.contentBlock.type}`)
    console.log(`Q: ${r3.contentBlock.body_md.slice(0, 400)}...`)
  }

  // Turn 4: Try a wrong answer to test misconception detection
  t0 = Date.now()
  const r4 = await app.learnModeService.respond({
    sessionId: r1.sessionId,
    studentInput: "I think the derivative is just cos(3x), no factor needed",
  })
  console.log(`\n--- Turn 4 (student: wrong answer with chain-rule slip) [${Date.now() - t0}ms] ---`)
  console.log(`stage:  ${r4.stage}`)
  console.log(`agent:  ${r4.agentMessage}`)
  if (r4.contentBlock) {
    console.log(`block.type: ${r4.contentBlock.type}`)
    console.log(`block.title: ${r4.contentBlock.title || ''}`)
  }

  // Turn 5: Give the correct answer
  t0 = Date.now()
  const r5 = await app.learnModeService.respond({
    sessionId: r1.sessionId,
    studentInput: "3",
  })
  console.log(`\n--- Turn 5 (student: 3, the correct answer) [${Date.now() - t0}ms] ---`)
  console.log(`stage:  ${r5.stage}`)
  console.log(`agent:  ${r5.agentMessage}`)
  if (r5.contentBlock) {
    console.log(`block.type: ${r5.contentBlock.type}`)
    console.log(`block.body (first 300): ${r5.contentBlock.body_md.slice(0, 300)}...`)
  }

  // Inspect session state
  const sess = app.learnModeService.getSession(r1.sessionId)
  console.log(`\n--- Final session state ---`)
  console.log(`stage:               ${sess?.stage}`)
  console.log(`turns:               ${sess?.turns.length}`)
  console.log(`currentFramingIndex: ${sess?.currentFramingIndex}`)
  console.log(`checkIndex:          ${sess?.checkIndex}`)
  console.log(`framingsExhausted:   ${sess?.framingsExhausted}`)

  app.close()
  console.log('\n[done]')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
