/**
 * scripts/authoring/testTeachBack.ts
 *
 * E2E smoke test for the A2 Teach-It-Back service. Boots the full
 * CalcuLearn app (Gemma + DB), runs a teach-back conversation against
 * deriv.chain-rule, and prints each turn.
 *
 * Run: npx tsx scripts/authoring/testTeachBack.ts [conceptId]
 */

import { createApp } from '../../src/main.js'
import { parseQuantisationOverride } from '../../src/bootstrap.js'

async function main(): Promise<void> {
  const conceptId = process.argv[2] || 'deriv.chain-rule'

  const app = await createApp({
    dbPath: process.env['DB_PATH'] ?? './data/calculearn.sqlite',
    modelDir: process.env['MODEL_DIR'] ?? './models',
    gemmaHashes: {
      Q4_K_M: process.env['GEMMA_Q4_SHA256'] ?? '',
      Q8: process.env['GEMMA_Q8_SHA256'] ?? '',
    },
    quantisation: parseQuantisationOverride(process.env['GEMMA_QUANTISATION']),
  })

  const studentId = `e2e_tb_${Date.now()}`

  console.log('\n========================================')
  console.log(`Teach-It-Back E2E test`)
  console.log(`studentId: ${studentId}`)
  console.log(`conceptId: ${conceptId}`)
  console.log('========================================\n')

  // ---- 1. Start ----
  console.log('--- 1. start ---')
  let t0 = Date.now()
  const r1 = await app.teachBackService.start({
    studentId,
    conceptId,
    tier: 'on_pace',
  })
  console.log(`  [${Date.now() - t0}ms]`)
  console.log(`  stage:  ${r1.stage}`)
  console.log(`  agent:  ${r1.agentMessage}`)
  console.log(`  scaffolds:`)
  for (const s of r1.scaffolding) console.log(`    - ${s}`)

  const sid = r1.sessionId

  // ---- 2. Student gives a shallow explanation ----
  const shallow = `The chain rule lets you take the derivative of one function inside another. You use it when there's a function inside a function.`
  console.log(`\n--- 2. respond (shallow) ---`)
  console.log(`  student: ${shallow}`)
  t0 = Date.now()
  const r2 = await app.teachBackService.respond({
    sessionId: sid,
    studentExplanation: shallow,
  })
  console.log(`  [${Date.now() - t0}ms]`)
  console.log(`  stage:  ${r2.stage}`)
  console.log(`  agent:  ${r2.agentMessage}`)
  console.log(`  probesRemaining: ${r2.probesRemaining}`)
  if (r2.contentBlock) {
    console.log(`  block.type:  ${r2.contentBlock.type}`)
    console.log(`  block.title: ${r2.contentBlock.title}`)
  }

  // ---- 3. Student deepens with the formula ----
  const deeper =
    `OK so more concretely: if you have y = f(g(x)), then dy/dx is f'(g(x)) times g'(x). ` +
    `You differentiate the outside function leaving the inside alone, then multiply by the derivative of the inside. ` +
    `For example, with y = sin(3x), the outside is sin(u), the inside is u = 3x, so dy/dx = cos(3x) * 3.`
  console.log(`\n--- 3. respond (deeper, with formula and example) ---`)
  console.log(`  student: ${deeper.slice(0, 120)}...`)
  t0 = Date.now()
  const r3 = await app.teachBackService.respond({
    sessionId: sid,
    studentExplanation: deeper,
  })
  console.log(`  [${Date.now() - t0}ms]`)
  console.log(`  stage:  ${r3.stage}`)
  console.log(`  agent:  ${r3.agentMessage}`)
  console.log(`  probesRemaining: ${r3.probesRemaining}`)

  // ---- 4. Trigger assessment ----
  console.log(`\n--- 4. assess ---`)
  t0 = Date.now()
  const a = await app.teachBackService.assess(sid)
  console.log(`  [${Date.now() - t0}ms]`)
  console.log(`  stage:  ${a.stage}`)
  console.log(`  strongSummary:`)
  console.log(`    ${a.strongSummary.replace(/\n/g, '\n    ')}`)
  console.log(`  weakSummary:`)
  console.log(`    ${a.weakSummary.replace(/\n/g, '\n    ')}`)
  console.log(`  closingMessage: ${a.closingMessage}`)
  console.log(`  recommendations:`)
  for (const r of a.recommendations) {
    console.log(`    - ${r.kind}: ${r.label} (target=${r.target})`)
  }

  // ---- 5. Inspect session state ----
  const sess = app.teachBackService.getSession(sid)
  console.log(`\n--- final session state ---`)
  console.log(`  facets: ${sess?.facets.length}`)
  console.log(`  strongIds: ${[...(sess?.strongIds ?? [])].join(', ') || '(none)'}`)
  console.log(`  weakIds:   ${[...(sess?.weakIds ?? [])].join(', ') || '(none)'}`)
  console.log(`  probeCount: ${sess?.probeCount}`)
  console.log(`  turns: ${sess?.turns.length}`)

  app.close()
  console.log('\n[done]')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
