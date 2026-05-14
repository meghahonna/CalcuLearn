/**
 * scripts/authoring/seedVisuals.ts
 *
 * Reads JSON visual files from content/visuals/<concept_id>.json (one
 * file per concept, value = array of ConceptVisualSeed entries) and
 * upserts them into the concept_visuals table.
 *
 * Idempotent — wipes a concept's existing visuals before re-inserting.
 *
 * Run: npx tsx scripts/authoring/seedVisuals.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = process.env['DB_PATH'] ?? './data/calculearn.sqlite'
const DIR = path.resolve(__dirname, '../../content/visuals')

interface VisualSeed {
  slot: 'explanation' | 'example' | 'deep_dive' | 'application' | 'hero'
  tier?: 'novice' | 'on_pace' | 'advanced' | null
  title?: string
  caption_md?: string
  display_order?: number
  spec: unknown
}

function main() {
  const db = new BetterSqlite3(DB_PATH)
  db.pragma('foreign_keys = ON')
  if (!fs.existsSync(DIR)) {
    console.error(`No visuals dir at ${DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  if (files.length === 0) {
    console.error('No visuals JSON files found.')
    process.exit(1)
  }

  const clear = db.prepare('DELETE FROM concept_visuals WHERE concept_id = ?')
  const insert = db.prepare(`
    INSERT INTO concept_visuals (concept_id, slot, tier, title, caption_md, spec_json, display_order)
    VALUES (@concept_id, @slot, @tier, @title, @caption_md, @spec_json, @display_order)
  `)

  console.log(`Seeding visuals from ${DIR} into ${DB_PATH}`)
  for (const f of files) {
    const conceptId = f.replace(/\.json$/, '')
    const arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as VisualSeed[]
    const tx = db.transaction(() => {
      clear.run(conceptId)
      arr.forEach((v, idx) => {
        insert.run({
          concept_id: conceptId,
          slot: v.slot,
          tier: v.tier ?? null,
          title: v.title ?? null,
          caption_md: v.caption_md ?? null,
          spec_json: JSON.stringify(v.spec),
          display_order: v.display_order ?? idx,
        })
      })
    })
    tx()
    console.log(`  - ${conceptId}: ${arr.length} visual(s)`)
  }

  const total = (db.prepare('SELECT COUNT(*) as c FROM concept_visuals').get() as { c: number }).c
  console.log(`Done. Total visuals in DB: ${total}`)
  db.close()
}

main()
