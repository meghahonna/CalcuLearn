/**
 * scripts/authoring/conceptSpecs.ts
 *
 * Hand-curated specs for the 5 starter concepts. The authoring pipeline
 * reads from here. Adding a concept = adding an entry here, then running
 * `npx tsx scripts/authoring/authorConcept.ts <concept_id>`.
 *
 * IDs match the existing CONCEPT_MAP in src/data/concepts.ts so that
 * authored content joins cleanly with the in-memory concept graph.
 */

import type { Tier } from './authoringPrompts.js'

type ApplicationContext = 'physics' | 'economics' | 'biology' | 'engineering' | 'everyday'

export interface ConceptSpec {
  /** Must match an id in src/data/concepts.ts */
  concept_id: string
  /** Human-readable name (matches CONCEPT_MAP entry) */
  name: string
  track: 'AB' | 'BC' | 'BOTH'
  one_liner: string
  /** Concept ids the student should already understand */
  prerequisites: string[]
  /** Optional per-tier framing hints; novice usually has 2 framings, others 1 */
  framingHints?: Partial<Record<Tier, string[]>>
  misconceptionCount?: number
  deepDiveAngles?: string[]
  applicationContexts?: ApplicationContext[]
}

export const CONCEPT_SPECS: Record<string, ConceptSpec> = {
  // -------------------------------------------------------------------
  'limits.definition': {
    concept_id: 'limits.definition',
    name: 'Limit Definition',
    track: 'BOTH',
    one_liner: 'What a function approaches as the input approaches a value.',
    prerequisites: [],
    framingHints: {
      novice: [
        'Use the "zoom in on a graph" mental model — what value does the curve get arbitrarily close to as you zoom in around x = a?',
        'Use a numerical-table approach — plug in values closer and closer to the target and watch the outputs settle.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why is a limit different from "the value of the function at that point"?',
      'The epsilon-delta definition for the curious — what does "arbitrarily close" really mean?',
    ],
    applicationContexts: ['physics', 'everyday'],
  },

  // -------------------------------------------------------------------
  'deriv.power-rule': {
    concept_id: 'deriv.power-rule',
    name: 'The Power Rule',
    track: 'BOTH',
    one_liner: 'A shortcut for differentiating any term of the form x^n without using the limit definition every time.',
    prerequisites: ['limits.definition'],
    framingHints: {
      novice: [
        'Frame as a recipe: "bring the exponent down, subtract 1 from it." Show it works on x^2, x^3, x^5 first.',
        'Build it from the limit definition for one or two cases (n=2, n=3) so the student sees the pattern emerge — but the rule itself is the takeaway.',
      ],
    },
    misconceptionCount: 6,
    deepDiveAngles: [
      'Why does the power rule work for any real exponent — not just positive integers?',
      'Where does the power rule come from? A binomial-expansion proof for integer n.',
    ],
    applicationContexts: ['physics', 'economics'],
  },

  // -------------------------------------------------------------------
  'deriv.chain-rule': {
    concept_id: 'deriv.chain-rule',
    name: 'The Chain Rule',
    track: 'BOTH',
    one_liner: 'How to differentiate a function nested inside another function.',
    prerequisites: ['deriv.power-rule', 'deriv.product-rule'],
    framingHints: {
      novice: [
        'Use the "outside function, inside function" recipe explicitly. Identify the outside, identify the inside, differentiate the outside leaving the inside alone, multiply by the derivative of the inside.',
        'Use the "machines feeding machines" / "gear ratio" analogy — if y depends on u, and u depends on x, the rate dy/dx is the product of the rates dy/du and du/dx.',
      ],
    },
    misconceptionCount: 6,
    deepDiveAngles: [
      'Why does the chain rule produce a product of two derivatives?',
      'Chain rule with three or more nested functions — what changes?',
    ],
    applicationContexts: ['physics', 'biology'],
  },

  // -------------------------------------------------------------------
  'integ.riemann': {
    concept_id: 'integ.riemann',
    name: 'Riemann Sums and the Definite Integral',
    track: 'BOTH',
    one_liner: 'Estimating area under a curve by adding up rectangles, then taking a limit to get the exact answer.',
    prerequisites: ['limits.definition'],
    framingHints: {
      novice: [
        'Build it visually: draw a curve, slice the region under it into thin rectangles, add up rectangle areas. Show that thinner rectangles give a better estimate.',
        'Frame as "accumulating tiny pieces" — total distance from a varying speed, total water from a varying flow rate. The integral is the running total.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does the limit of a Riemann sum exist for "nice" functions? What does it mean for a function to be Riemann-integrable?',
      'Left, right, and midpoint sums all converge to the same value — why?',
    ],
    applicationContexts: ['physics', 'engineering'],
  },

  // -------------------------------------------------------------------
  'integ.ftc': {
    concept_id: 'integ.ftc',
    name: 'The Fundamental Theorem of Calculus',
    track: 'BOTH',
    one_liner: 'The bridge between differentiation and integration: integrals can be evaluated using antiderivatives.',
    prerequisites: ['integ.riemann', 'deriv.power-rule'],
    framingHints: {
      novice: [
        'Walk through both parts (FTC1 and FTC2) with one concrete example carried through. State each part in plain English first, then symbolically.',
        'Use the "accumulation function" mental model — let A(x) be the area under the curve from a to x; show that A\'(x) is the original function.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why are differentiation and integration inverse operations?',
      'Geometric proof sketch using areas and slopes — how the rectangle of width h and height f(x) produces dA/dx = f(x).',
    ],
    applicationContexts: ['physics', 'engineering'],
  },
}
