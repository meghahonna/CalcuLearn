/**
 * Calculus concept graph for CalcuLearn.
 *
 * Defines all ConceptNode entries covering the full K-12 calculus curriculum:
 * limits, continuity, derivatives, integrals, and introductory ODEs.
 *
 * Prerequisite edges encode the Knowledge Space Theory DAG. The graph is
 * verified cycle-free at module load time via `assertConceptDAG`.
 *
 * Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import type { ConceptNode } from '../models/types.js'
import { assertConceptDAG } from '../models/validation.js'

// ---------------------------------------------------------------------------
// Limits (8.6)
// ---------------------------------------------------------------------------

const LIMITS: ConceptNode[] = [
  {
    id: 'limits.definition',
    name: 'Limit Definition',
    topic: 'limits',
    prerequisites: [],
    difficulty: 1,
    description: 'Informal and formal (ε-δ) definition of a limit; evaluating limits by substitution and simplification.',
    learningObjectives: [
      'State the informal definition of lim_{x→a} f(x) = L',
      'Evaluate limits by direct substitution',
      'Identify when direct substitution fails and apply algebraic simplification',
    ],
  },
  {
    id: 'limits.one-sided',
    name: 'One-Sided Limits',
    topic: 'limits',
    prerequisites: ['limits.definition'],
    difficulty: 1,
    description: 'Left-hand and right-hand limits; conditions for a two-sided limit to exist.',
    learningObjectives: [
      'Evaluate left-hand and right-hand limits from a graph or formula',
      'Determine whether a two-sided limit exists',
      'Identify jump discontinuities using one-sided limits',
    ],
  },
  {
    id: 'limits.infinity',
    name: 'Limits at Infinity',
    topic: 'limits',
    prerequisites: ['limits.definition'],
    difficulty: 2,
    description: 'Limits as x → ±∞; horizontal asymptotes; limits of rational functions at infinity.',
    learningObjectives: [
      'Evaluate limits as x approaches positive or negative infinity',
      'Identify horizontal asymptotes from limit behaviour',
      'Apply the dominant-term technique for rational functions',
    ],
  },
  {
    id: 'limits.lhopital',
    name: "L'Hôpital's Rule",
    topic: 'limits',
    prerequisites: ['limits.definition', 'deriv.power-rule'],
    difficulty: 3,
    description: "L'Hôpital's rule for 0/0 and ∞/∞ indeterminate forms; repeated application.",
    learningObjectives: [
      "State the conditions under which L'Hôpital's rule applies",
      'Apply the rule to evaluate 0/0 and ∞/∞ forms',
      'Recognise when to stop applying the rule',
    ],
  },
]

// ---------------------------------------------------------------------------
// Continuity (8.1)
// ---------------------------------------------------------------------------

const CONTINUITY: ConceptNode[] = [
  {
    id: 'continuity.definition',
    name: 'Continuity at a Point',
    topic: 'continuity',
    prerequisites: ['limits.definition', 'limits.one-sided'],
    difficulty: 2,
    description: 'Three-part definition of continuity; removable, jump, and infinite discontinuities.',
    learningObjectives: [
      'State the three conditions for continuity at a point',
      'Classify discontinuities as removable, jump, or infinite',
      'Determine continuity of piecewise functions',
    ],
  },
  {
    id: 'continuity.types',
    name: 'Types of Discontinuity and IVT',
    topic: 'continuity',
    prerequisites: ['continuity.definition'],
    difficulty: 2,
    description: 'Removable, jump, and infinite discontinuities in depth; Intermediate Value Theorem.',
    learningObjectives: [
      'Distinguish between types of discontinuity algebraically and graphically',
      'State and apply the Intermediate Value Theorem',
      'Use IVT to prove existence of roots',
    ],
  },
]

// ---------------------------------------------------------------------------
// Derivatives (8.4)
// ---------------------------------------------------------------------------

const DERIVATIVES: ConceptNode[] = [
  {
    id: 'deriv.power-rule',
    name: 'Power Rule',
    topic: 'derivatives',
    prerequisites: ['limits.definition'],
    difficulty: 1,
    description: 'Derivative as a limit; power rule d/dx[xⁿ] = nxⁿ⁻¹; constant and sum rules.',
    learningObjectives: [
      'Define the derivative as a limit of a difference quotient',
      'Apply the power rule to polynomial terms',
      'Use the constant multiple and sum/difference rules',
    ],
  },
  {
    id: 'deriv.product-rule',
    name: 'Product Rule',
    topic: 'derivatives',
    prerequisites: ['deriv.power-rule'],
    difficulty: 2,
    description: "Product rule (uv)' = u'v + uv'; differentiation of products of functions.",
    learningObjectives: [
      "State the product rule formula",
      'Apply the product rule to products of two functions',
      'Combine the product rule with the power rule',
    ],
  },
  {
    id: 'deriv.quotient-rule',
    name: 'Quotient Rule',
    topic: 'derivatives',
    prerequisites: ['deriv.product-rule'],
    difficulty: 2,
    description: "Quotient rule (u/v)' = (u'v − uv')/v²; differentiation of rational functions.",
    learningObjectives: [
      'State the quotient rule formula',
      'Apply the quotient rule to rational functions',
      'Simplify derivatives of quotients',
    ],
  },
  {
    id: 'deriv.chain-rule',
    name: 'Chain Rule',
    topic: 'derivatives',
    prerequisites: ['deriv.product-rule'],
    difficulty: 3,
    description: 'Chain rule d/dx[f(g(x))] = f\'(g(x))·g\'(x); composition of functions.',
    learningObjectives: [
      'Identify the inner and outer functions in a composition',
      'Apply the chain rule to composite functions',
      'Combine the chain rule with product and quotient rules',
    ],
  },
  {
    id: 'deriv.implicit',
    name: 'Implicit Differentiation',
    topic: 'derivatives',
    prerequisites: ['deriv.chain-rule'],
    difficulty: 3,
    description: 'Differentiating equations not solved for y; finding dy/dx implicitly.',
    learningObjectives: [
      'Differentiate both sides of an implicit equation with respect to x',
      'Solve for dy/dx after implicit differentiation',
      'Apply implicit differentiation to find slopes of curves',
    ],
  },
  {
    id: 'deriv.related-rates',
    name: 'Related Rates',
    topic: 'derivatives',
    prerequisites: ['deriv.implicit'],
    difficulty: 4,
    description: 'Using implicit differentiation with respect to time to relate rates of change.',
    learningObjectives: [
      'Set up a related-rates equation from a geometric or physical scenario',
      'Differentiate implicitly with respect to time',
      'Solve for an unknown rate given other rates and values',
    ],
  },
  {
    id: 'deriv.optimisation',
    name: 'Optimisation',
    topic: 'derivatives',
    prerequisites: ['deriv.chain-rule', 'continuity.definition'],
    difficulty: 4,
    description: 'Finding absolute and local extrema; first and second derivative tests; applied optimisation.',
    learningObjectives: [
      'Find critical points by setting f\'(x) = 0 or identifying where f\' is undefined',
      'Apply the first derivative test to classify extrema',
      'Solve applied optimisation problems with constraints',
    ],
  },
]

// ---------------------------------------------------------------------------
// Integrals (8.5)
// ---------------------------------------------------------------------------

const INTEGRALS: ConceptNode[] = [
  {
    id: 'integ.riemann',
    name: 'Riemann Sums',
    topic: 'integrals',
    prerequisites: ['limits.definition', 'deriv.power-rule'],
    difficulty: 2,
    description: 'Left, right, and midpoint Riemann sums; the definite integral as a limit of sums.',
    learningObjectives: [
      'Compute left, right, and midpoint Riemann sums for a given partition',
      'Express the definite integral as a limit of Riemann sums',
      'Interpret the definite integral as a signed area',
    ],
  },
  {
    id: 'integ.ftc',
    name: 'Fundamental Theorem of Calculus',
    topic: 'integrals',
    prerequisites: ['integ.riemann', 'deriv.power-rule'],
    difficulty: 3,
    description: 'FTC Parts 1 and 2; antiderivatives; evaluating definite integrals.',
    learningObjectives: [
      'State both parts of the Fundamental Theorem of Calculus',
      'Use FTC Part 2 to evaluate definite integrals via antiderivatives',
      'Differentiate integral functions using FTC Part 1',
    ],
  },
  {
    id: 'integ.substitution',
    name: 'Integration by Substitution',
    topic: 'integrals',
    prerequisites: ['integ.ftc', 'deriv.chain-rule'],
    difficulty: 3,
    description: 'u-substitution for indefinite and definite integrals; reversing the chain rule.',
    learningObjectives: [
      'Identify an appropriate substitution u = g(x)',
      'Transform the integral in terms of u and du',
      'Apply substitution to definite integrals by changing limits',
    ],
  },
  {
    id: 'integ.by-parts',
    name: 'Integration by Parts',
    topic: 'integrals',
    prerequisites: ['integ.ftc', 'deriv.product-rule'],
    difficulty: 4,
    description: '∫u dv = uv − ∫v du; LIATE heuristic; repeated integration by parts.',
    learningObjectives: [
      'State the integration by parts formula',
      'Select u and dv using the LIATE heuristic',
      'Apply integration by parts, including repeated application',
    ],
  },
  {
    id: 'integ.definite-apps',
    name: 'Applications of Definite Integrals',
    topic: 'integrals',
    prerequisites: ['integ.substitution'],
    difficulty: 4,
    description: 'Area between curves; average value of a function; net displacement vs. total distance.',
    learningObjectives: [
      'Set up and evaluate integrals for area between two curves',
      'Compute the average value of a function over an interval',
      'Distinguish net displacement from total distance using integrals',
    ],
  },
]

// ---------------------------------------------------------------------------
// ODEs (8.7)
// ---------------------------------------------------------------------------

const ODES: ConceptNode[] = [
  {
    id: 'ode.separable',
    name: 'Separable Differential Equations',
    topic: 'ode',
    prerequisites: ['integ.substitution'],
    difficulty: 4,
    description: 'Separating variables; solving dy/dx = f(x)g(y) by integration.',
    learningObjectives: [
      'Identify a separable ODE',
      'Separate variables and integrate both sides',
      'Apply initial conditions to find particular solutions',
    ],
  },
  {
    id: 'ode.first-order-linear',
    name: 'First-Order Linear ODEs',
    topic: 'ode',
    prerequisites: ['ode.separable', 'integ.by-parts'],
    difficulty: 5,
    description: 'Integrating factor method for dy/dx + P(x)y = Q(x).',
    learningObjectives: [
      'Write a first-order linear ODE in standard form',
      'Compute the integrating factor μ(x) = e^{∫P(x)dx}',
      'Solve the ODE using the integrating factor method',
    ],
  },
]

// ---------------------------------------------------------------------------
// Full concept list and DAG validation
// ---------------------------------------------------------------------------

/**
 * All CalcuLearn concept nodes, ordered roughly by curriculum sequence.
 * The prerequisite DAG is verified cycle-free at module load time.
 */
export const CONCEPTS: readonly ConceptNode[] = [
  ...LIMITS,
  ...CONTINUITY,
  ...DERIVATIVES,
  ...INTEGRALS,
  ...ODES,
]

// Verify the DAG is acyclic at import time. Throws TypeError if a cycle exists.
assertConceptDAG(CONCEPTS as ConceptNode[])

/**
 * Map from conceptId to ConceptNode for O(1) lookup.
 */
export const CONCEPT_MAP: ReadonlyMap<string, ConceptNode> = new Map(
  CONCEPTS.map((c) => [c.id, c])
)

// Verify every prerequisite ID resolves to a known concept.
// assertConceptDAG silently ignores unknown prereq IDs (by design — external
// concepts are allowed). Here we enforce that all prereqs within this
// curriculum are self-consistent.
for (const concept of CONCEPTS) {
  for (const prereqId of concept.prerequisites) {
    if (!CONCEPT_MAP.has(prereqId)) {
      throw new TypeError(
        `Concept "${concept.id}" has unknown prerequisite "${prereqId}"`
      )
    }
  }
}
