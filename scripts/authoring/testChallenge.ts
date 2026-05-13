/**
 * scripts/authoring/testChallenge.ts
 *
 * End-to-end smoke test for Phase E Challenge Mode.
 * Boots the full app (Gemma + DB) and exercises:
 *   1. listChallengeableConcepts
 *   2. getChallengeBundle on a known concept
 *   3. feedbackOnApplication with a real student answer
 *   4. probeAfterDeepDive with a reflection
 */

import { createApp } from '../../src/main.js'
import { parseQuantisationOverride } from '../../src/bootstrap.js'

async function main(): Promise<void> {
  const app = await createApp({
    dbPath: process.env['DB_PATH'] ?? './data/calculearn.sqlite',
    modelDir: process.env['MODEL_DIR'] ?? './models',
    gemmaHashes: {
      Q4_K_M: process.env['GEMMA_Q4_SHA256'] ?? '',
      Q8: process.env['GEMMA_Q8_SHA256'] ?? '',
    },
    quantisation: parseQuantisationOverride(process.env['GEMMA_QUANTISATION']),
  })

  const studentId = `e2e_challenge_${Date.now()}`
  const conceptId = 'deriv.chain-rule'

  console.log('\n========================================')
  console.log(`Challenge Mode E2E test`)
  console.log(`studentId: ${studentId}`)
  console.log(`conceptId: ${conceptId}`)
  console.log('========================================\n')

  console.log('--- 1. listChallengeableConcepts ---')
  const list = app.challengeService.listChallengeableConcepts(studentId)
  console.log(`  ${list.length} challengeable concepts:`)
  for (const c of list) {
    console.log(
      `    ${c.conceptId.padEnd(28)} apps=${c.applicationCount} dives=${c.deepDiveCount} stretch=${c.stretchProblemCount} unlocked=${c.unlocked}`
    )
  }

  console.log('\n--- 2. getChallengeBundle ---')
  const bundle = app.challengeService.getChallengeBundle(studentId, conceptId)
  console.log(`  name:      ${bundle.conceptName}`)
  console.log(`  unlocked:  ${bundle.unlocked}`)
  console.log(`  hasContent: ${bundle.hasContent}`)
  console.log(`  applications: ${bundle.applications.length}`)
  console.log(`  deepDives:    ${bundle.deepDives.length}`)
  console.log(`  stretch:      ${bundle.stretchProblems.length}`)

  if (bundle.applications.length > 0) {
    const firstApp = bundle.applications[0]
    console.log(`\n  First application (id=${firstApp.id}, context=${firstApp.context}):`)
    console.log(`    problem: ${firstApp.problem_md.slice(0, 250)}...`)

    console.log('\n--- 3. feedbackOnApplication (vague answer) ---')
    let t0 = Date.now()
    const fb1 = await app.challengeService.feedbackOnApplication({
      applicationId: firstApp.id,
      studentAnswer: 'I would use the chain rule somewhere',
    })
    console.log(`  [${Date.now() - t0}ms]`)
    console.log(`  message: ${fb1.message}`)

    console.log('\n--- 4. feedbackOnApplication (more detailed) ---')
    t0 = Date.now()
    const fb2 = await app.challengeService.feedbackOnApplication({
      applicationId: firstApp.id,
      studentAnswer:
        'I would set up the chain rule by identifying the inner and outer functions, ' +
        'then multiply the derivative of the outer by the derivative of the inner.',
    })
    console.log(`  [${Date.now() - t0}ms]`)
    console.log(`  message: ${fb2.message}`)
  }

  if (bundle.deepDives.length > 0) {
    const firstDD = bundle.deepDives[0]
    console.log(`\n--- 5. probeAfterDeepDive (id=${firstDD.id}) ---`)
    console.log(`  title: ${firstDD.title}`)
    const t0 = Date.now()
    const fb3 = await app.challengeService.probeAfterDeepDive({
      deepDiveId: firstDD.id,
      studentReflection:
        'I think the chain rule works because of how the rate of change propagates ' +
        'through nested functions like a gear ratio.',
    })
    console.log(`  [${Date.now() - t0}ms]`)
    console.log(`  message: ${fb3.message}`)
  }

  app.close()
  console.log('\n[done]')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
