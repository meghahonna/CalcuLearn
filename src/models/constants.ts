/**
 * Shared domain constants for CalcuLearn.
 *
 * Keep thresholds that cross component boundaries here so the KSM, Problem
 * Engine, Session Engine, and tests agree on what "ready" and "default" mean.
 */

/** Default BKT prior for concepts with no recorded mastery row. */
export const DEFAULT_MASTERY_PRIOR = 0.1

/** Minimum prerequisite mastery required before a concept can be selected. */
export const PREREQUISITE_MASTERY_THRESHOLD = 0.7

/** Mastery below this threshold flags a previously mastered concept for review. */
export const REVIEW_THRESHOLD = PREREQUISITE_MASTERY_THRESHOLD
