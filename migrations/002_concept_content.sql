-- =============================================================
-- Migration 002: Concept Content Layer
--
-- Adds the substantive math content tables that Claude Opus
-- authors offline and the on-device SLM retrieves at runtime.
--
-- Architecture: Frontier-authored content + on-device SLM for
-- Socratic dialogue. The SLM never invents calculus; it only
-- paraphrases, probes, and transitions between pre-authored
-- content blocks.
--
-- IMPORTANT: This migration is idempotent. All ALTER TABLE
-- statements check for column existence first via a helper
-- (executed by scripts/authoring/runMigration.ts). Raw SQL
-- below is the canonical schema.
-- =============================================================

-- ---------- Concepts table (NEW) ----------
-- The existing app holds CONCEPT_MAP in memory only (src/data/concepts.ts).
-- We add a real table so the new content tables can foreign-key into it.
-- The seed step copies CONCEPT_MAP into this table.
CREATE TABLE IF NOT EXISTS concepts (
  id                 TEXT    PRIMARY KEY,
  name               TEXT    NOT NULL,
  topic              TEXT,
  difficulty         INTEGER,
  description        TEXT,
  -- Phase A additions:
  track              TEXT    CHECK(track IN ('AB','BC','BOTH')) DEFAULT 'BOTH',
  prerequisites_json TEXT,
  one_liner          TEXT,
  authoring_status   TEXT    CHECK(authoring_status IN ('not_started','draft','reviewed','published'))
                             DEFAULT 'not_started',
  created_at         TEXT    DEFAULT (datetime('now'))
);

-- ---------- concept_explanations ----------
-- One concept has multiple explanations: 3 tiers x N framings.
CREATE TABLE IF NOT EXISTS concept_explanations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id    TEXT    NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  tier          TEXT    NOT NULL CHECK(tier IN ('novice','on_pace','advanced')),
  framing_index INTEGER NOT NULL DEFAULT 0,
  body_md       TEXT    NOT NULL,
  intuition_md  TEXT,
  created_at    TEXT    DEFAULT (datetime('now')),
  UNIQUE(concept_id, tier, framing_index)
);
CREATE INDEX IF NOT EXISTS idx_explanations_concept_tier
  ON concept_explanations(concept_id, tier);

-- ---------- concept_examples ----------
-- Worked examples with step-by-step narration. steps_json is
-- a JSON array of {step_md, why_md} objects.
CREATE TABLE IF NOT EXISTS concept_examples (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id  TEXT    NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  tier        TEXT    NOT NULL CHECK(tier IN ('novice','on_pace','advanced')),
  problem_md  TEXT    NOT NULL,
  steps_json  TEXT    NOT NULL,
  created_at  TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_examples_concept_tier
  ON concept_examples(concept_id, tier);

-- ---------- concept_misconceptions ----------
-- Catalog of common student errors with Socratic responses.
CREATE TABLE IF NOT EXISTS concept_misconceptions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id            TEXT    NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  short_name            TEXT    NOT NULL,
  description_md        TEXT    NOT NULL,
  why_wrong_md          TEXT    NOT NULL,
  socratic_response_md  TEXT    NOT NULL,
  created_at            TEXT    DEFAULT (datetime('now')),
  UNIQUE(concept_id, short_name)
);
CREATE INDEX IF NOT EXISTS idx_misconceptions_concept
  ON concept_misconceptions(concept_id);

-- ---------- concept_checks ----------
-- Check-for-understanding probes used during Learn Mode walkthroughs.
CREATE TABLE IF NOT EXISTS concept_checks (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id                  TEXT    NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  tier                        TEXT    NOT NULL CHECK(tier IN ('novice','on_pace','advanced')),
  question_md                 TEXT    NOT NULL,
  expected_answer_md          TEXT    NOT NULL,
  expected_pattern            TEXT,
  misconception_id_if_wrong   INTEGER REFERENCES concept_misconceptions(id),
  created_at                  TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_checks_concept_tier
  ON concept_checks(concept_id, tier);

-- ---------- concept_deep_dives ----------
-- "Why does this work?" derivations, mostly for advanced students.
CREATE TABLE IF NOT EXISTS concept_deep_dives (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id  TEXT    NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  body_md     TEXT    NOT NULL,
  created_at  TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deep_dives_concept
  ON concept_deep_dives(concept_id);

-- ---------- concept_applications ----------
-- Real-world application problems for advanced/challenge mode.
CREATE TABLE IF NOT EXISTS concept_applications (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id           TEXT    NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  context              TEXT,
  problem_md           TEXT    NOT NULL,
  solution_outline_md  TEXT    NOT NULL,
  created_at           TEXT    DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_applications_concept
  ON concept_applications(concept_id);

-- ---------- problems table additions ----------
-- The existing problems table already has solution_steps_json and
-- misconceptions_json. We add hint_progression_json (3-level hints
-- for the Socratic shell) plus challenge / application metadata.
-- These ALTERs are conditionally applied by runMigration.ts.
-- (Listed here for documentation:)
--   ALTER TABLE problems ADD COLUMN hint_progression_json TEXT;
--   ALTER TABLE problems ADD COLUMN is_challenge INTEGER DEFAULT 0;
--   ALTER TABLE problems ADD COLUMN application_context TEXT;
