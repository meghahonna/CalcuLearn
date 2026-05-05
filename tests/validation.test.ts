/**
 * Tests for src/models/validation.ts
 *
 * Covers:
 *   - assertMasteryProbability: valid and invalid values
 *   - assertConceptDAG: acyclic, cyclic, empty, single-node graphs
 *   - assertProblemMatchesConcept: matching and mismatching conceptId
 */

import { describe, it, expect } from 'vitest'
import {
  assertMasteryProbability,
  assertConceptDAG,
  assertProblemMatchesConcept,
} from '../src/models/validation.js'
import type { ConceptNode, Problem } from '../src/models/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, prerequisites: string[] = []): ConceptNode {
  return {
    id,
    name: id,
    topic: 'limits',
    prerequisites,
    difficulty: 1,
    description: '',
    learningObjectives: [],
  }
}

function makeProblem(id: string, conceptId: string): Problem {
  return {
    id,
    conceptId,
    difficulty: 'conceptual',
    type: 'free-response',
    stem: 'test stem',
    answer: { raw: '1', latex: '1', type: 'numeric' },
    solutionSteps: [],
    commonMisconceptions: [],
    isGenerated: false,
  }
}

// ---------------------------------------------------------------------------
// assertMasteryProbability
// ---------------------------------------------------------------------------

describe('assertMasteryProbability', () => {
  describe('valid values — should not throw', () => {
    it('accepts 0 (lower bound)', () => {
      expect(() => assertMasteryProbability(0)).not.toThrow()
    })

    it('accepts 0.5 (midpoint)', () => {
      expect(() => assertMasteryProbability(0.5)).not.toThrow()
    })

    it('accepts 1 (upper bound)', () => {
      expect(() => assertMasteryProbability(1)).not.toThrow()
    })
  })

  describe('invalid values — should throw RangeError', () => {
    it('rejects -0.1 (below lower bound)', () => {
      expect(() => assertMasteryProbability(-0.1)).toThrow(RangeError)
      expect(() => assertMasteryProbability(-0.1)).toThrow(
        'masteryProbability must be in [0.0, 1.0], got: -0.1'
      )
    })

    it('rejects 1.1 (above upper bound)', () => {
      expect(() => assertMasteryProbability(1.1)).toThrow(RangeError)
      expect(() => assertMasteryProbability(1.1)).toThrow(
        'masteryProbability must be in [0.0, 1.0], got: 1.1'
      )
    })

    it('rejects NaN', () => {
      expect(() => assertMasteryProbability(NaN)).toThrow(RangeError)
      expect(() => assertMasteryProbability(NaN)).toThrow(
        'masteryProbability must be in [0.0, 1.0], got: NaN'
      )
    })
  })
})

// ---------------------------------------------------------------------------
// assertConceptDAG
// ---------------------------------------------------------------------------

describe('assertConceptDAG', () => {
  it('does not throw for an empty array', () => {
    expect(() => assertConceptDAG([])).not.toThrow()
  })

  it('does not throw for a single node with no prerequisites', () => {
    const nodes = [makeNode('A')]
    expect(() => assertConceptDAG(nodes)).not.toThrow()
  })

  it('does not throw for a valid acyclic graph (A -> B -> C)', () => {
    // A has no prerequisites; B requires A; C requires B.
    const nodes = [makeNode('A'), makeNode('B', ['A']), makeNode('C', ['B'])]
    expect(() => assertConceptDAG(nodes)).not.toThrow()
  })

  it('does not throw for a diamond-shaped DAG', () => {
    // A -> B, A -> C, B -> D, C -> D
    const nodes = [
      makeNode('A'),
      makeNode('B', ['A']),
      makeNode('C', ['A']),
      makeNode('D', ['B', 'C']),
    ]
    expect(() => assertConceptDAG(nodes)).not.toThrow()
  })

  it('throws TypeError for a direct cycle (A -> B -> A)', () => {
    const nodes = [makeNode('A', ['B']), makeNode('B', ['A'])]
    expect(() => assertConceptDAG(nodes)).toThrow(TypeError)
    expect(() => assertConceptDAG(nodes)).toThrow(
      /Concept prerequisite graph contains a cycle involving:/
    )
  })

  it('throws TypeError for a self-loop (A -> A)', () => {
    const nodes = [makeNode('A', ['A'])]
    expect(() => assertConceptDAG(nodes)).toThrow(TypeError)
    expect(() => assertConceptDAG(nodes)).toThrow(
      /Concept prerequisite graph contains a cycle involving: A/
    )
  })

  it('throws TypeError for a longer cycle (A -> B -> C -> A)', () => {
    const nodes = [makeNode('A', ['C']), makeNode('B', ['A']), makeNode('C', ['B'])]
    expect(() => assertConceptDAG(nodes)).toThrow(TypeError)
    expect(() => assertConceptDAG(nodes)).toThrow(
      /Concept prerequisite graph contains a cycle involving:/
    )
  })

  it('does not throw when a prerequisite ID is not present in the nodes array (external node)', () => {
    // 'external-concept' is not in the nodes array — should be silently ignored.
    const nodes = [makeNode('A', ['external-concept'])]
    expect(() => assertConceptDAG(nodes)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// assertProblemMatchesConcept
// ---------------------------------------------------------------------------

describe('assertProblemMatchesConcept', () => {
  it('does not throw when problem.conceptId matches the given conceptId', () => {
    const problem = makeProblem('prob-1', 'deriv.chain-rule')
    expect(() => assertProblemMatchesConcept(problem, 'deriv.chain-rule')).not.toThrow()
  })

  it('throws TypeError when problem.conceptId does not match the given conceptId', () => {
    const problem = makeProblem('prob-1', 'deriv.chain-rule')
    expect(() => assertProblemMatchesConcept(problem, 'limits.definition')).toThrow(TypeError)
    expect(() => assertProblemMatchesConcept(problem, 'limits.definition')).toThrow(
      'Problem prob-1 belongs to concept deriv.chain-rule, not limits.definition'
    )
  })
})
