-- =============================================================
-- Migration 003: Adaptive Routing Signals (Phase D)
--
-- Tracks per-(student, concept) engagement signals that the
-- adaptive router uses to detect archetype and recommend a mode.
-- Signals are accumulated by SessionEngine (Practice) and
-- LearnModeService (Learn).
-- =============================================================

CREATE TABLE IF NOT EXISTS student_concept_signals (
  student_id              TEXT    NOT NULL,
  concept_id              TEXT    NOT NULL,

  -- Rolling window of the last N attempts. JSON array of
  -- { ts, source: 'practice'|'learn', correct, hints, confidence?, durationMs }
  recent_attempts_json    TEXT    NOT NULL DEFAULT '[]',

  -- Cumulative counters
  practice_attempts       INTEGER NOT NULL DEFAULT 0,
  practice_correct        INTEGER NOT NULL DEFAULT 0,
  practice_hints_used     INTEGER NOT NULL DEFAULT 0,
  dont_know_count         INTEGER NOT NULL DEFAULT 0,
  learn_engagements       INTEGER NOT NULL DEFAULT 0,
  learn_completions       INTEGER NOT NULL DEFAULT 0,
  consecutive_failures    INTEGER NOT NULL DEFAULT 0,
  consecutive_aces        INTEGER NOT NULL DEFAULT 0,

  -- Archetype: 'struggling' | 'on_pace' | 'advanced' | 'unknown'
  archetype               TEXT    NOT NULL DEFAULT 'unknown'
                          CHECK(archetype IN ('struggling','on_pace','advanced','unknown')),
  archetype_updated_at    INTEGER,

  -- Last self-reported confidence: 'got_it' | 'guessed' | 'shaky'
  last_confidence         TEXT
                          CHECK(last_confidence IN ('got_it','guessed','shaky')),
  last_confidence_at      INTEGER,

  -- Whether Challenge Mode is unlocked for this (student, concept)
  challenge_unlocked      INTEGER NOT NULL DEFAULT 0,

  updated_at              INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),

  PRIMARY KEY (student_id, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_signals_archetype
  ON student_concept_signals(archetype);
CREATE INDEX IF NOT EXISTS idx_signals_challenge
  ON student_concept_signals(challenge_unlocked);
