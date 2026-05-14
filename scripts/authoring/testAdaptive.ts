/**
 * scripts/authoring/testAdaptive.ts
 *
 * End-to-end smoke test for Phase D adaptive routing.
 * Doesn't load Gemma — exercises only the AdaptiveRouter against
 * a real SQLite DB so we can verify signal accumulation and
 * archetype classification without paying for inference.
 */

import BetterSqlite3 from 'better-sqlite3'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AdaptiveRouter } from '../../src/components/adaptiveRouter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = process.env['DB_PATH'] ?? path.resolve(__dirname, '../../data/calculearn.sqlite')

function header(s: string): void {
  console.log(`\n${'═'.repeat(64)}`)
  console.log(`  ${s}`)
  console.log('═'.repeat(64))
}

function dump(label: string, sig: ReturnType<AdaptiveRouter['getSignals']>): void {
  console.log(`  [${label}] archetype=${sig.archetype} ` +
    `attempts=${sig.practiceAttempts}/${sig.practiceCorrect} ` +
    `streak_aces=${sig.consecutiveAces} streak_fail=${sig.consecutiveFailures} ` +
    `dontKnow=${sig.dontKnowCount} learn=${sig.learnEngagements}/${sig.learnCompletions} ` +
    `unlocked=${sig.challengeUnlocked} conf=${sig.lastConfidence ?? 'null'}`)
}

function main(): void {
  const db = new BetterSqlite3(DB_PATH)
  db.pragma('foreign_keys = ON')

  // Use a unique student id so re-runs don't pollute previous data.
  const studentId = `test_d_${Date.now()}`
  const conceptA = 'deriv.chain-rule'
  const conceptB = 'deriv.power-rule'

  const router = new AdaptiveRouter({ db })

  // ─────────────────────────────────────────────────────────────
  header(`Scenario 1: STRUGGLING student on ${conceptA}`)
  // 2 wrong attempts in a row -> should suggest Learn Mode
  let s1 = router.recordPracticeAttempt({
    studentId, conceptId: conceptA, correct: false, hintsUsed: 1,
  })
  dump('after wrong 1', s1)
  let s2 = router.recordPracticeAttempt({
    studentId, conceptId: conceptA, correct: false, hintsUsed: 2,
  })
  dump('after wrong 2', s2)
  router.recordDontKnow({ studentId, conceptId: conceptA })
  router.recordDontKnow({ studentId, conceptId: conceptA })
  const sug1 = router.suggest(studentId, conceptA)
  console.log('\n  Suggestion:', JSON.stringify(sug1, null, 2))

  // ─────────────────────────────────────────────────────────────
  header(`Scenario 2: ADVANCED student on ${conceptB}`)
  // 4 right in a row, no hints, with confidence "got_it"
  for (let i = 0; i < 4; i++) {
    const s = router.recordPracticeAttempt({
      studentId, conceptId: conceptB, correct: true, hintsUsed: 0,
    })
    router.recordConfidence({ studentId, conceptId: conceptB, confidence: 'got_it' })
    dump(`after ace ${i+1}`, s)
  }
  const sug2 = router.suggest(studentId, conceptB)
  console.log('\n  Suggestion:', JSON.stringify(sug2, null, 2))

  // ─────────────────────────────────────────────────────────────
  header(`Scenario 3: SHAKY student — correct but unsure on ${conceptA}`)
  const studentB = `test_d2_${Date.now()}`
  router.recordPracticeAttempt({ studentId: studentB, conceptId: conceptA, correct: true, hintsUsed: 0 })
  router.recordPracticeAttempt({ studentId: studentB, conceptId: conceptA, correct: true, hintsUsed: 1 })
  const after = router.recordConfidence({
    studentId: studentB, conceptId: conceptA, confidence: 'shaky',
  })
  dump('after shaky chip', after)
  const sug3 = router.suggest(studentB, conceptA)
  console.log('\n  Suggestion:', JSON.stringify(sug3, null, 2))

  // ─────────────────────────────────────────────────────────────
  header(`Scenario 4: profile listing`)
  const profile = router.listSignalsForStudent(studentId)
  console.log(`  ${profile.length} concept rows for ${studentId}:`)
  for (const sig of profile) {
    dump(`  ${sig.conceptId.padEnd(25)}`, sig)
  }

  db.close()
  console.log('\n[done]')
}

main()
