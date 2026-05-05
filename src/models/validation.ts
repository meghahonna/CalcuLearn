/**
 * Runtime validation helpers for CalcuLearn core data models.
 *
 * These functions throw typed errors when invariants are violated, providing
 * a single enforcement point for the constraints described in Requirements 2.3
 * and 8.3.
 */

import type { ConceptNode, Problem } from './types.js'

// ---------------------------------------------------------------------------
// assertMasteryProbability
// ---------------------------------------------------------------------------

/**
 * Asserts that `v` is a valid MasteryProbability value — a finite number in
 * the closed interval [0.0, 1.0].
 *
 * Throws a `RangeError` if the value is outside the valid range or is NaN.
 *
 * @param v - The mastery probability value to validate.
 * @throws {RangeError} When `v` is NaN, less than 0, or greater than 1.
 *
 * Validates: Requirements 2.3
 */
export function assertMasteryProbability(v: number): void {
  if (isNaN(v) || v < 0 || v > 1) {
    throw new RangeError(`masteryProbability must be in [0.0, 1.0], got: ${v}`)
  }
}

// ---------------------------------------------------------------------------
// assertConceptDAG
// ---------------------------------------------------------------------------

/**
 * Asserts that the prerequisite relationships encoded in `nodes` form a
 * directed acyclic graph (DAG) — i.e. contain no cycles.
 *
 * Uses iterative DFS with a three-colour marking scheme:
 *   - white (0): not yet visited
 *   - grey  (1): currently on the DFS stack (in-progress)
 *   - black (2): fully processed
 *
 * Prerequisite IDs that do not correspond to any node in `nodes` are treated
 * as external / already-mastered concepts and are silently ignored.
 *
 * @param nodes - Array of ConceptNode objects whose prerequisite edges are checked.
 * @throws {TypeError} When a cycle is detected, naming one of the concepts involved.
 *
 * Validates: Requirements 8.3
 */
export function assertConceptDAG(nodes: ConceptNode[]): void {
  // Build a set of known IDs for fast membership testing.
  const knownIds = new Set(nodes.map((n) => n.id))

  // Build adjacency list: conceptId -> prerequisite IDs (filtered to known nodes only).
  const adj = new Map<string, string[]>()
  for (const node of nodes) {
    adj.set(
      node.id,
      node.prerequisites.filter((prereqId) => knownIds.has(prereqId))
    )
  }

  // Three-colour DFS cycle detection.
  // 0 = white (unvisited), 1 = grey (on stack), 2 = black (done)
  const colour = new Map<string, 0 | 1 | 2>()
  for (const id of knownIds) {
    colour.set(id, 0)
  }

  for (const startId of knownIds) {
    if (colour.get(startId) !== 0) continue

    // Iterative DFS using an explicit stack.
    // Each entry is [nodeId, iteratorIndex] so we can resume after visiting children.
    const stack: Array<{ id: string; childIndex: number }> = [{ id: startId, childIndex: 0 }]
    colour.set(startId, 1)

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const children = adj.get(frame.id) ?? []

      if (frame.childIndex < children.length) {
        const childId = children[frame.childIndex]
        frame.childIndex++

        const childColour = colour.get(childId)
        if (childColour === 1) {
          // Back-edge found — cycle detected.
          throw new TypeError(
            `Concept prerequisite graph contains a cycle involving: ${childId}`
          )
        }
        if (childColour === 0) {
          colour.set(childId, 1)
          stack.push({ id: childId, childIndex: 0 })
        }
        // childColour === 2 means already fully processed — safe to skip.
      } else {
        // All children processed; mark this node black and pop.
        colour.set(frame.id, 2)
        stack.pop()
      }
    }
  }
}

// ---------------------------------------------------------------------------
// assertProblemMatchesConcept
// ---------------------------------------------------------------------------

/**
 * Asserts that `problem.conceptId` matches the expected `conceptId`.
 *
 * @param problem   - The Problem to validate.
 * @param conceptId - The concept ID the problem is expected to belong to.
 * @throws {TypeError} When `problem.conceptId !== conceptId`.
 */
export function assertProblemMatchesConcept(problem: Problem, conceptId: string): void {
  if (problem.conceptId !== conceptId) {
    throw new TypeError(
      `Problem ${problem.id} belongs to concept ${problem.conceptId}, not ${conceptId}`
    )
  }
}
