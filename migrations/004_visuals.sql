-- =============================================================
-- Migration 004: Visual layer
-- Adds the concept_visuals table for inline interactive diagrams
-- (function plots, secant-to-tangent, Riemann sums, etc).
--
-- spec_json holds a Visual spec object — see src/visuals/types.ts
-- =============================================================

CREATE TABLE IF NOT EXISTS concept_visuals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,                 -- 'explanation' | 'example' | 'deep_dive' | 'application' | 'hero'
  tier TEXT,                          -- optional: 'novice' | 'on_pace' | 'advanced' (null = all tiers)
  title TEXT,
  caption_md TEXT,
  spec_json TEXT NOT NULL,            -- the Visual spec
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visuals_concept_slot
  ON concept_visuals(concept_id, slot);

CREATE INDEX IF NOT EXISTS idx_visuals_concept_tier
  ON concept_visuals(concept_id, tier);
