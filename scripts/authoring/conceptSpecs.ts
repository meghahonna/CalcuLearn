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

  // -------------------------------------------------------------------
  // Phase E content expansion (15 more concepts)
  // -------------------------------------------------------------------

  'limits.one-sided': {
    concept_id: 'limits.one-sided',
    name: 'One-Sided Limits',
    track: 'BOTH',
    one_liner: 'Approaching a value from one side only — and when the two-sided limit exists.',
    prerequisites: ['limits.definition'],
    framingHints: {
      novice: [
        'Walk through a piecewise function with a jump — let the student see left-limit and right-limit disagree.',
        'Use the notation $\\lim_{x \\to a^-}$ vs $\\lim_{x \\to a^+}$ explicitly and show how both must match for the two-sided limit to exist.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does a two-sided limit require both one-sided limits to agree?',
      'One-sided limits at endpoints — what changes for functions defined on a closed interval?',
    ],
    applicationContexts: ['physics', 'everyday'],
  },

  'limits.infinity': {
    concept_id: 'limits.infinity',
    name: 'Limits at Infinity',
    track: 'BOTH',
    one_liner: 'What a function approaches as the input grows without bound — and the horizontal asymptotes that result.',
    prerequisites: ['limits.definition'],
    framingHints: {
      novice: [
        'Use a numerical table — plug in x = 10, 100, 1000, 1,000,000 and watch the output settle (or not).',
        'Use the dominant-term technique on rational functions: identify the highest power in numerator and denominator.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does the highest power dominate as $x \\to \\infty$?',
      'When does a limit at infinity not exist, even though it does not blow up?',
    ],
    applicationContexts: ['physics', 'economics'],
  },

  'limits.lhopital': {
    concept_id: 'limits.lhopital',
    name: "L'Hopital's Rule",
    track: 'BOTH',
    one_liner: 'A shortcut for 0/0 and infinity/infinity indeterminate forms using derivatives of the top and bottom.',
    prerequisites: ['limits.definition', 'deriv.power-rule'],
    framingHints: {
      novice: [
        'Start with a 0/0 form the student cannot factor away, then differentiate top and bottom separately to show how the rule resolves it.',
        'Use a side-by-side comparison: algebraic simplification vs L Hopital on the same problem.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does differentiating top and bottom give the original limit? A linear-approximation argument.',
      'When does L Hopital fail to apply, even when the form looks indeterminate?',
    ],
    applicationContexts: ['physics', 'economics'],
  },

  'continuity.definition': {
    concept_id: 'continuity.definition',
    name: 'Continuity at a Point',
    track: 'BOTH',
    one_liner: 'A function is continuous at a point when the limit exists, the value exists, and the two are equal.',
    prerequisites: ['limits.definition', 'limits.one-sided'],
    framingHints: {
      novice: [
        'Use the three-part checklist: f(a) exists, lim f(x) exists, lim f(x) = f(a). Walk through each.',
        'Use a piecewise function and probe which of the three parts fails to introduce removable, jump, and infinite discontinuities.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does the three-part definition matter? What does each part rule out?',
      'Pointwise vs uniform continuity for the curious advanced student.',
    ],
    applicationContexts: ['physics', 'everyday'],
  },

  'continuity.types': {
    concept_id: 'continuity.types',
    name: 'Types of Discontinuity and IVT',
    track: 'BOTH',
    one_liner: 'Classifying discontinuities — removable, jump, infinite — and using the Intermediate Value Theorem.',
    prerequisites: ['continuity.definition'],
    framingHints: {
      novice: [
        'Use one concrete example per type — show the graph, the formula, and which of the three continuity conditions fails.',
        'Walk through one IVT application end-to-end: show f is continuous, identify f(a) and f(b), pick a target between them, conclude a c exists.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does IVT require continuity, and what goes wrong without it?',
      'Geometric proof sketch of IVT using the completeness of the real numbers.',
    ],
    applicationContexts: ['physics', 'engineering'],
  },

  'deriv.product-rule': {
    concept_id: 'deriv.product-rule',
    name: 'Product Rule',
    track: 'BOTH',
    one_liner: 'How to differentiate a product of two functions — not just the product of their derivatives.',
    prerequisites: ['deriv.power-rule'],
    framingHints: {
      novice: [
        'Start with a counterexample showing $\\frac{d}{dx}[u \\cdot v] \\neq u\\prime v\\prime$. Then introduce the correct rule.',
        'Use the box-rectangle visual: area = width times height; how does the area change when width and height each grow?',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does the product rule give two terms? A geometric area-change derivation.',
      'Generalising the product rule to three or more factors.',
    ],
    applicationContexts: ['physics', 'biology'],
  },

  'deriv.quotient-rule': {
    concept_id: 'deriv.quotient-rule',
    name: 'Quotient Rule',
    track: 'BOTH',
    one_liner: 'How to differentiate a ratio of two functions, with a sign and denominator-squared you cannot skip.',
    prerequisites: ['deriv.product-rule'],
    framingHints: {
      novice: [
        'Use the mnemonic LO d-HI minus HI d-LO over LO squared, anchored on a worked example.',
        'Derive the quotient rule from the product rule on $f \\cdot (1/g)$ so the student sees where the minus sign comes from.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does the quotient rule have a minus sign and a denominator squared?',
      'When should you simplify into a product first instead of using the quotient rule?',
    ],
    applicationContexts: ['physics', 'economics'],
  },

  'deriv.implicit': {
    concept_id: 'deriv.implicit',
    name: 'Implicit Differentiation',
    track: 'BOTH',
    one_liner: 'Finding $dy/dx$ when $y$ is tangled up with $x$ in an equation you cannot solve for $y$.',
    prerequisites: ['deriv.chain-rule'],
    framingHints: {
      novice: [
        'Treat $y$ as a function of $x$ — every time you differentiate a $y$ term, append $\\frac{dy}{dx}$. Walk through a circle equation.',
        'Use the unit circle $x^2 + y^2 = 1$ — find the slope of the tangent at a given point implicitly, then verify by solving for $y$ explicitly.',
      ],
      advanced: [
        'Treat this as an application of the single-variable chain rule to an equation that defines $y$ implicitly as a function of $x$. STAY IN SINGLE-VARIABLE CALCULUS — do NOT use partial derivatives, gradients, the Implicit Function Theorem, multivariable chain rule, tangent planes, or level curves. AP Calculus AB/BC does NOT cover multivariable techniques.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does the chain rule force us to append $dy/dx$ when differentiating $y$ terms?',
      'When is implicit differentiation strictly necessary, and when is it just convenient?',
    ],
    applicationContexts: ['physics', 'engineering'],
  },

  'deriv.related-rates': {
    concept_id: 'deriv.related-rates',
    name: 'Related Rates',
    track: 'BOTH',
    one_liner: 'Two quantities changing together — find one rate given the other using a geometric or physical relationship.',
    prerequisites: ['deriv.implicit'],
    framingHints: {
      novice: [
        'Use a recipe: identify variables, write a relationship, differentiate with respect to time, substitute known values LAST.',
        'Walk through a sliding ladder problem step by step — emphasise that the ladder length is constant but $x$ and $y$ both depend on $t$.',
      ],
      advanced: [
        'Frame as an implicit-differentiation problem with respect to time, where every variable is a function of $t$. STAY IN SINGLE-VARIABLE CALCULUS — do NOT use partial derivatives $\\partial F/\\partial x$, gradient vectors, multivariable chain rule, constraint surfaces, or autonomous ODE theory. AP Calculus AB/BC does NOT cover multivariable techniques.',
      ],
    },
    misconceptionCount: 6,
    deepDiveAngles: [
      'Why must you substitute numerical values AFTER differentiating, not before?',
      'How do you choose the right geometric or physical relationship to write down?',
    ],
    applicationContexts: ['physics', 'engineering'],
  },

  'deriv.optimisation': {
    concept_id: 'deriv.optimisation',
    name: 'Optimisation',
    track: 'BOTH',
    one_liner: 'Finding the maximum or minimum of a quantity using critical points and the first or second derivative test.',
    prerequisites: ['deriv.chain-rule', 'continuity.definition'],
    framingHints: {
      novice: [
        'Walk through the box-volume problem — define the quantity to maximise, write it as a function of one variable, find critical points, classify.',
        'Use the first-derivative sign chart explicitly so the student sees how the sign changes around a max vs a min.',
      ],
    },
    misconceptionCount: 6,
    deepDiveAngles: [
      'Why does Fermat\'s theorem hold? The geometric reason critical points come from a flat tangent.',
      'When does the second-derivative test fail, and what do you do then?',
    ],
    applicationContexts: ['economics', 'engineering'],
  },

  'integ.substitution': {
    concept_id: 'integ.substitution',
    name: 'Integration by Substitution',
    track: 'BOTH',
    one_liner: 'Reversing the chain rule by spotting an inner function and its derivative inside an integral.',
    prerequisites: ['integ.ftc', 'deriv.chain-rule'],
    framingHints: {
      novice: [
        'Use a recipe: spot an inner function $u$, compute $du$, rewrite, integrate, substitute back.',
        'Frame as "the chain rule, run backwards". Show a forward chain rule derivative, then run the same problem in reverse.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does the $du$ swap work? A linear-approximation justification.',
      'Choosing $u$ when there are multiple candidates — what makes one choice better?',
    ],
    applicationContexts: ['physics', 'engineering'],
  },

  'integ.by-parts': {
    concept_id: 'integ.by-parts',
    name: 'Integration by Parts',
    track: 'BOTH',
    one_liner: 'Reversing the product rule: $\\int u \\, dv = uv - \\int v \\, du$.',
    prerequisites: ['integ.ftc', 'deriv.product-rule'],
    framingHints: {
      novice: [
        'Use the LIATE heuristic to pick $u$ — Log, Inverse trig, Algebraic, Trig, Exponential.',
        'Derive the formula from the product rule so the student sees it is just the product rule integrated.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does picking $u$ wrong make integration by parts harder, not impossible?',
      'When does integration by parts require itself recursively (the tabular trick)?',
    ],
    applicationContexts: ['physics', 'engineering'],
  },

  'integ.definite-apps': {
    concept_id: 'integ.definite-apps',
    name: 'Applications of Definite Integrals',
    track: 'BOTH',
    one_liner: 'Using integrals to compute area between curves, average value, and net displacement.',
    prerequisites: ['integ.substitution'],
    framingHints: {
      novice: [
        'Walk through area between two curves: identify upper and lower, set up the integral $\\int (f - g) \\, dx$, evaluate.',
        'Distinguish net displacement from total distance using $\\int v \\, dt$ vs $\\int |v| \\, dt$ with a sign-changing velocity.',
      ],
    },
    misconceptionCount: 6,
    deepDiveAngles: [
      'Why does average value of a function equal the integral divided by the interval length?',
      'When you compute area, why must you integrate the absolute difference and not just the signed difference?',
    ],
    applicationContexts: ['physics', 'engineering'],
  },

  'ode.separable': {
    concept_id: 'ode.separable',
    name: 'Separable Differential Equations',
    track: 'BC',
    one_liner: 'When $\\frac{dy}{dx}$ splits into a product of an $x$-only piece and a $y$-only piece, you can separate variables and integrate each side.',
    prerequisites: ['integ.substitution'],
    framingHints: {
      novice: [
        'Walk through Newton\'s law of cooling end-to-end: write the ODE, separate, integrate, solve for $y$, apply the initial condition.',
        'Show how the $dx$ and $dy$ are treated formally as differentials — emphasise this is short-hand for a substitution argument.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why is it legitimate to treat $dy$ and $dx$ as separable algebraic quantities?',
      'What does a particular solution look like vs a general solution, and where does the constant of integration go?',
    ],
    applicationContexts: ['physics', 'biology'],
  },

  'ode.first-order-linear': {
    concept_id: 'ode.first-order-linear',
    name: 'First-Order Linear ODEs',
    track: 'BC',
    one_liner: 'The integrating-factor recipe for $\\frac{dy}{dx} + P(x) y = Q(x)$.',
    prerequisites: ['ode.separable', 'integ.by-parts'],
    framingHints: {
      novice: [
        'Walk through the recipe — compute $\\mu(x) = e^{\\int P \\, dx}$, multiply through, recognise the left side as a derivative of a product, integrate.',
        'Use a tank-mixing problem so the student sees where $P$ and $Q$ come from physically.',
      ],
    },
    misconceptionCount: 5,
    deepDiveAngles: [
      'Why does the integrating factor turn the left side into a product derivative? Verify it via the product rule.',
      'When can a non-linear ODE be transformed into a first-order linear one?',
    ],
    applicationContexts: ['physics', 'engineering'],
  },
}
