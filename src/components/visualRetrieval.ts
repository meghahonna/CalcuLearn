/**
 * src/components/visualRetrieval.ts
 *
 * Read-only DAO for concept_visuals. Mirrors ContentRetrieval's shape so
 * we can pass it the same way through createApp.
 */

import type Database from 'better-sqlite3'
import type { ConceptVisual, Visual } from '../visuals/types.js'

interface VisualRow {
  id: number
  concept_id: string
  slot: string
  tier: string | null
  title: string | null
  caption_md: string | null
  spec_json: string
  display_order: number
}

function rowToVisual(row: VisualRow): ConceptVisual {
  return {
    id: row.id,
    conceptId: row.concept_id,
    slot: row.slot as ConceptVisual['slot'],
    tier: row.tier as ConceptVisual['tier'],
    title: row.title,
    captionMd: row.caption_md,
    spec: JSON.parse(row.spec_json) as Visual,
    displayOrder: row.display_order,
  }
}

export class VisualRetrieval {
  private readonly stmts: {
    listByConcept: Database.Statement
    listByConceptAndSlot: Database.Statement
    listByConceptAndTier: Database.Statement
    count: Database.Statement
    countByConcept: Database.Statement
  }

  constructor(private readonly db: Database.Database) {
    this.stmts = {
      listByConcept: db.prepare(
        `SELECT id, concept_id, slot, tier, title, caption_md, spec_json, display_order
         FROM concept_visuals
         WHERE concept_id = ?
         ORDER BY display_order ASC, id ASC`
      ),
      listByConceptAndSlot: db.prepare(
        `SELECT id, concept_id, slot, tier, title, caption_md, spec_json, display_order
         FROM concept_visuals
         WHERE concept_id = ? AND slot = ?
         ORDER BY display_order ASC, id ASC`
      ),
      listByConceptAndTier: db.prepare(
        `SELECT id, concept_id, slot, tier, title, caption_md, spec_json, display_order
         FROM concept_visuals
         WHERE concept_id = ?
           AND (tier IS NULL OR tier = ?)
         ORDER BY display_order ASC, id ASC`
      ),
      count: db.prepare(`SELECT COUNT(*) as c FROM concept_visuals`),
      countByConcept: db.prepare(`SELECT COUNT(*) as c FROM concept_visuals WHERE concept_id = ?`),
    }
  }

  listForConcept(conceptId: string): ConceptVisual[] {
    return (this.stmts.listByConcept.all(conceptId) as VisualRow[]).map(rowToVisual)
  }

  listForConceptAndSlot(conceptId: string, slot: string): ConceptVisual[] {
    return (this.stmts.listByConceptAndSlot.all(conceptId, slot) as VisualRow[]).map(rowToVisual)
  }

  /** Returns visuals applicable to the given tier (tier-specific OR tier-agnostic). */
  listForConceptAndTier(conceptId: string, tier: string): ConceptVisual[] {
    return (this.stmts.listByConceptAndTier.all(conceptId, tier) as VisualRow[]).map(rowToVisual)
  }

  countTotal(): number {
    return (this.stmts.count.get() as { c: number }).c
  }

  countForConcept(conceptId: string): number {
    return (this.stmts.countByConcept.get(conceptId) as { c: number }).c
  }
}
