/**
 * Curated problem bank seed data for CalcuLearn.
 *
 * Provides at minimum 4 problems per concept × 4 difficulty tiers
 * (conceptual / procedural / application / proof-sketch) for all 20 concepts
 * in the K-12 calculus curriculum.
 *
 * Each problem includes:
 *   - stem: LaTeX-formatted problem statement
 *   - answer: canonical MathExpression
 *   - solutionSteps: ordered steps with Socratic hints
 *   - commonMisconceptions: known incorrect patterns
 *
 * Requirements: 3.1, 3.2, 8.2
 */

import type { Problem, MathExpression } from '../models/types.js'
import { CONCEPT_MAP } from './concepts.js'

// ---------------------------------------------------------------------------
// Helper — build a problem with minimal boilerplate
// ---------------------------------------------------------------------------

/**
 * Stable semantic ID format: `<concept-slug>-<difficulty>-<stem-hash>`.
 *
 * The hash is derived from the problem stem, so inserting a new problem before
 * an existing one does not renumber stored IDs in session history.
 */
function stableProblemId(conceptId: string, difficulty: string, stem: string): string {
  const slug = conceptId
    .replace('limits.', 'lim-')
    .replace('continuity.', 'cont-')
    .replace('deriv.', 'deriv-')
    .replace('integ.', 'integ-')
    .replace('ode.', 'ode-')
    .replace(/\./g, '-')
  return `${slug}-${difficulty}-${hashStem(stem)}`
}

function hashStem(stem: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < stem.length; i++) {
    hash ^= stem.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Infer MathExpression.type from the answer raw string.
 * - 'explain-concept' problems and answers containing natural-language words → 'text'
 * - Pure numeric strings (integers, decimals, simple fractions) → 'numeric'
 * - Everything else → 'symbolic'
 */
function inferAnswerType(
  problemType: Problem['type'],
  answerRaw: string
): MathExpression['type'] {
  if (problemType === 'explain-concept') return 'text'
  // Contains letters that aren't math variable names (words like "and", "No", "m/s")
  if (/\b(and|or|No|Yes|text|m\/s|m\/min|kg\/min|removable|jump|infinite|mastered|square)\b/i.test(answerRaw)) return 'text'
  // Pure number or simple fraction
  if (/^-?\d+(\.\d+)?(\/\d+)?$/.test(answerRaw.trim())) return 'numeric'
  return 'symbolic'
}

function p(
  conceptId: string,
  difficulty: Problem['difficulty'],
  type: Problem['type'],
  stem: string,
  answerRaw: string,
  answerLatex: string,
  steps: Array<{ description: string; expression: string; hint: string }>,
  misconceptions: Array<{ id: string; description: string; incorrectPattern: string; remediationConceptId: string }> = []
): Problem {
  return {
    id: stableProblemId(conceptId, difficulty, stem),
    conceptId,
    difficulty,
    type,
    stem,
    answer: { raw: answerRaw, latex: answerLatex, type: inferAnswerType(type, answerRaw) },
    solutionSteps: steps.map((s, i) => ({ stepNumber: i + 1, ...s })),
    commonMisconceptions: misconceptions.map((m) => ({ ...m })),
    isGenerated: false,
  }
}

// ===========================================================================
// limits.definition
// ===========================================================================

const LIMITS_DEFINITION: Problem[] = [
  p('limits.definition', 'conceptual', 'explain-concept',
    'In your own words, what does $\\lim_{x \\to 3} f(x) = 7$ mean?',
    'As x approaches 3, f(x) approaches 7',
    '\\text{As } x \\to 3,\\; f(x) \\to 7',
    [
      { description: 'Recall the informal definition of a limit', expression: '\\lim_{x \\to a} f(x) = L', hint: 'What does it mean for f(x) to get arbitrarily close to a number?' },
      { description: 'Apply to the specific values a = 3, L = 7', expression: 'x \\to 3 \\Rightarrow f(x) \\to 7', hint: 'What are the specific values of a and L here?' },
    ],
    [{ id: 'mc-lim-def-1', description: 'Confuses limit with function value', incorrectPattern: 'f(3) = 7', remediationConceptId: 'limits.definition' }]
  ),
  p('limits.definition', 'procedural', 'free-response',
    'Evaluate $\\lim_{x \\to 2} (3x^2 - x + 1)$.',
    '11',
    '11',
    [
      { description: 'Check if direct substitution applies (polynomial — always continuous)', expression: '3(2)^2 - 2 + 1', hint: 'Can you substitute x = 2 directly into a polynomial?' },
      { description: 'Compute', expression: '12 - 2 + 1 = 11', hint: 'What is 3 × 4?' },
    ]
  ),
  p('limits.definition', 'procedural', 'free-response',
    'Evaluate $\\lim_{x \\to 1} \\dfrac{x^2 - 1}{x - 1}$.',
    '2',
    '2',
    [
      { description: 'Direct substitution gives 0/0 — factor the numerator', expression: 'x^2 - 1 = (x-1)(x+1)', hint: 'What is the factored form of x² − 1?' },
      { description: 'Cancel the common factor (x ≠ 1)', expression: '\\frac{(x-1)(x+1)}{x-1} = x+1', hint: 'What cancels?' },
      { description: 'Substitute x = 1', expression: '1 + 1 = 2', hint: 'Now substitute x = 1.' },
    ],
    [{ id: 'mc-lim-def-2', description: 'Divides by zero without factoring', incorrectPattern: '0/0', remediationConceptId: 'limits.definition' }]
  ),
  p('limits.definition', 'application', 'free-response',
    'Find $\\lim_{x \\to 0} \\dfrac{\\sin x}{x}$. (You may use the known result.)',
    '1',
    '1',
    [
      { description: 'Recognise the standard limit', expression: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1', hint: 'This is a fundamental trigonometric limit — do you recall its value?' },
    ],
    [{ id: 'mc-lim-def-3', description: 'Substitutes x = 0 to get 0/0', incorrectPattern: 'sin(0)/0 = 0/0', remediationConceptId: 'limits.definition' }]
  ),
]

// ===========================================================================
// limits.one-sided
// ===========================================================================

const LIMITS_ONE_SIDED: Problem[] = [
  p('limits.one-sided', 'conceptual', 'explain-concept',
    'What is the difference between $\\lim_{x \\to 2^-} f(x)$ and $\\lim_{x \\to 2^+} f(x)$?',
    'Left-hand limit approaches from below; right-hand limit approaches from above',
    '\\text{Left: } x \\to 2^-\\text{; Right: } x \\to 2^+',
    [
      { description: 'Define left-hand limit', expression: '\\lim_{x \\to a^-} f(x)', hint: 'Which side of a does x approach from?' },
      { description: 'Define right-hand limit', expression: '\\lim_{x \\to a^+} f(x)', hint: 'And the other side?' },
    ]
  ),
  p('limits.one-sided', 'procedural', 'free-response',
    'Let $f(x) = \\begin{cases} x+1 & x < 2 \\\\ 3x-2 & x \\geq 2 \\end{cases}$. Find $\\lim_{x \\to 2^-} f(x)$ and $\\lim_{x \\to 2^+} f(x)$.',
    '3 and 4',
    '3 \\text{ and } 4',
    [
      { description: 'Left-hand limit: use x + 1 branch', expression: '\\lim_{x \\to 2^-}(x+1) = 3', hint: 'Which branch applies when x < 2?' },
      { description: 'Right-hand limit: use 3x − 2 branch', expression: '\\lim_{x \\to 2^+}(3x-2) = 4', hint: 'Which branch applies when x ≥ 2?' },
    ]
  ),
  p('limits.one-sided', 'procedural', 'free-response',
    'Does $\\lim_{x \\to 2} f(x)$ exist for the piecewise function above?',
    'No',
    '\\text{No — one-sided limits differ}',
    [
      { description: 'Compare one-sided limits', expression: '3 \\neq 4', hint: 'What must be true for a two-sided limit to exist?' },
      { description: 'Conclude', expression: '\\lim_{x \\to 2} f(x) \\text{ does not exist}', hint: 'If the one-sided limits differ, what can you say?' },
    ]
  ),
  p('limits.one-sided', 'application', 'free-response',
    'For $f(x) = \\dfrac{|x-3|}{x-3}$, find $\\lim_{x \\to 3^-} f(x)$ and $\\lim_{x \\to 3^+} f(x)$.',
    '-1 and 1',
    '-1 \\text{ and } 1',
    [
      { description: 'For x < 3: |x−3| = −(x−3)', expression: '\\frac{-(x-3)}{x-3} = -1', hint: 'What is |x−3| when x < 3?' },
      { description: 'For x > 3: |x−3| = x−3', expression: '\\frac{x-3}{x-3} = 1', hint: 'What is |x−3| when x > 3?' },
    ]
  ),
]

// ===========================================================================
// limits.infinity
// ===========================================================================

const LIMITS_INFINITY: Problem[] = [
  p('limits.infinity', 'conceptual', 'explain-concept',
    'What does $\\lim_{x \\to \\infty} f(x) = 5$ tell you about the graph of f?',
    'The graph has a horizontal asymptote at y = 5',
    'y = 5 \\text{ is a horizontal asymptote}',
    [
      { description: 'Interpret the limit at infinity', expression: 'f(x) \\to 5 \\text{ as } x \\to \\infty', hint: 'What does the graph do as x grows without bound?' },
    ]
  ),
  p('limits.infinity', 'procedural', 'free-response',
    'Evaluate $\\lim_{x \\to \\infty} \\dfrac{3x^2 + 2x}{5x^2 - 1}$.',
    '3/5',
    '\\dfrac{3}{5}',
    [
      { description: 'Divide numerator and denominator by x²', expression: '\\frac{3 + 2/x}{5 - 1/x^2}', hint: 'What is the highest power of x in the denominator?' },
      { description: 'Take the limit (terms with 1/x → 0)', expression: '\\frac{3 + 0}{5 - 0} = \\frac{3}{5}', hint: 'What happens to 2/x and 1/x² as x → ∞?' },
    ]
  ),
  p('limits.infinity', 'procedural', 'free-response',
    'Evaluate $\\lim_{x \\to \\infty} \\dfrac{4x^3 - x}{2x^2 + 7}$.',
    'infinity',
    '\\infty',
    [
      { description: 'Degree of numerator (3) > degree of denominator (2)', expression: '\\text{degree}(4x^3) > \\text{degree}(2x^2)', hint: 'Compare the degrees of numerator and denominator.' },
      { description: 'Limit is ±∞', expression: '\\lim_{x \\to \\infty} \\frac{4x^3}{2x^2} = \\lim_{x \\to \\infty} 2x = \\infty', hint: 'What happens when the numerator grows faster?' },
    ]
  ),
  p('limits.infinity', 'application', 'free-response',
    'Find all horizontal asymptotes of $f(x) = \\dfrac{2x}{\\sqrt{x^2+1}}$.',
    'y = 2 and y = -2',
    'y = 2 \\text{ and } y = -2',
    [
      { description: 'Limit as x → +∞: divide by x (positive)', expression: '\\frac{2}{\\sqrt{1+1/x^2}} \\to 2', hint: 'For x > 0, √(x²) = x.' },
      { description: 'Limit as x → −∞: divide by |x| = −x', expression: '\\frac{2}{-\\sqrt{1+1/x^2}} \\to -2', hint: 'For x < 0, √(x²) = −x.' },
    ]
  ),
]

// ===========================================================================
// limits.lhopital
// ===========================================================================

const LIMITS_LHOPITAL: Problem[] = [
  p('limits.lhopital', 'conceptual', 'explain-concept',
    "When can you apply L'Hôpital's rule?",
    "When the limit gives 0/0 or ∞/∞",
    '\\text{Indeterminate forms } 0/0 \\text{ or } \\infty/\\infty',
    [
      { description: "State the conditions", expression: '\\lim \\frac{f}{g} = \\frac{0}{0} \\text{ or } \\frac{\\infty}{\\infty}', hint: "What forms must the limit take before you can apply the rule?" },
    ]
  ),
  p('limits.lhopital', 'procedural', 'free-response',
    "Use L'Hôpital's rule to evaluate $\\lim_{x \\to 0} \\dfrac{e^x - 1}{x}$.",
    '1',
    '1',
    [
      { description: 'Verify 0/0 form', expression: 'e^0 - 1 = 0,\\; x = 0', hint: 'What does the numerator equal at x = 0?' },
      { description: "Differentiate numerator and denominator", expression: "\\frac{d}{dx}(e^x-1) = e^x,\\quad \\frac{d}{dx}(x) = 1", hint: "What are the derivatives of eˣ − 1 and x?" },
      { description: 'Evaluate the new limit', expression: '\\lim_{x \\to 0} \\frac{e^x}{1} = 1', hint: 'Now substitute x = 0.' },
    ]
  ),
  p('limits.lhopital', 'procedural', 'free-response',
    "Evaluate $\\lim_{x \\to \\infty} \\dfrac{\\ln x}{x}$.",
    '0',
    '0',
    [
      { description: 'Verify ∞/∞ form', expression: '\\ln x \\to \\infty,\\; x \\to \\infty', hint: 'What do numerator and denominator approach?' },
      { description: "Apply L'Hôpital", expression: "\\frac{1/x}{1} = \\frac{1}{x}", hint: "Differentiate top and bottom." },
      { description: 'Evaluate', expression: '\\lim_{x \\to \\infty} \\frac{1}{x} = 0', hint: 'What does 1/x approach as x → ∞?' },
    ]
  ),
  p('limits.lhopital', 'application', 'free-response',
    "Evaluate $\\lim_{x \\to 0} \\dfrac{x - \\sin x}{x^3}$.",
    '1/6',
    '\\dfrac{1}{6}',
    [
      { description: 'Verify 0/0 form', expression: '0 - \\sin 0 = 0', hint: 'Check the form at x = 0.' },
      { description: "Apply L'Hôpital once: 1 − cos x over 3x²", expression: '\\frac{1 - \\cos x}{3x^2}', hint: 'Differentiate numerator and denominator.' },
      { description: "Apply L'Hôpital again: sin x over 6x", expression: '\\frac{\\sin x}{6x}', hint: 'Still 0/0 — apply the rule again.' },
      { description: "Apply L'Hôpital a third time", expression: '\\frac{\\cos x}{6} \\to \\frac{1}{6}', hint: 'One more application.' },
    ]
  ),
]

// ===========================================================================
// continuity.definition
// ===========================================================================

const CONTINUITY_DEFINITION: Problem[] = [
  p('continuity.definition', 'conceptual', 'explain-concept',
    'State the three conditions required for $f$ to be continuous at $x = a$.',
    'f(a) defined, limit exists, limit equals f(a)',
    'f(a)\\text{ defined};\\;\\lim_{x\\to a}f(x)\\text{ exists};\\;\\lim_{x\\to a}f(x)=f(a)',
    [
      { description: 'Condition 1: f(a) must be defined', expression: 'f(a) \\text{ exists}', hint: 'What must be true about the function value at a?' },
      { description: 'Condition 2: the limit must exist', expression: '\\lim_{x \\to a} f(x) \\text{ exists}', hint: 'What must the one-sided limits satisfy?' },
      { description: 'Condition 3: limit equals function value', expression: '\\lim_{x \\to a} f(x) = f(a)', hint: 'How must the limit and function value relate?' },
    ]
  ),
  p('continuity.definition', 'procedural', 'free-response',
    'Is $f(x) = \\dfrac{x^2-4}{x-2}$ continuous at $x = 2$? Explain.',
    'No — f(2) is undefined',
    '\\text{No — } f(2) \\text{ undefined}',
    [
      { description: 'Check condition 1: f(2) = 0/0 — undefined', expression: 'f(2) = \\frac{0}{0} \\text{ undefined}', hint: 'Can you substitute x = 2?' },
      { description: 'Condition 1 fails — not continuous', expression: '\\text{Discontinuity at } x = 2', hint: 'If f(a) is undefined, what can you conclude?' },
    ]
  ),
  p('continuity.definition', 'procedural', 'free-response',
    'Find the value of $c$ that makes $f(x) = \\begin{cases} cx + 1 & x \\leq 2 \\\\ x^2 - 1 & x > 2 \\end{cases}$ continuous at $x = 2$.',
    'c = 1',
    'c = 1',
    [
      { description: 'Left-hand limit: c(2) + 1 = 2c + 1', expression: '\\lim_{x \\to 2^-} f(x) = 2c + 1', hint: 'Evaluate the top branch at x = 2.' },
      { description: 'Right-hand limit: 4 − 1 = 3', expression: '\\lim_{x \\to 2^+} f(x) = 3', hint: 'Evaluate the bottom branch at x = 2.' },
      { description: 'Set equal for continuity: 2c + 1 = 3', expression: 'c = 1', hint: 'What value of c makes the one-sided limits equal?' },
    ]
  ),
  p('continuity.definition', 'application', 'free-response',
    'Use the Intermediate Value Theorem to show that $x^3 - x - 1 = 0$ has a root in $(1, 2)$.',
    'f(1) = -1 < 0 and f(2) = 5 > 0, so by IVT a root exists',
    'f(1)<0,\\;f(2)>0 \\Rightarrow \\exists\\,c\\in(1,2): f(c)=0',
    [
      { description: 'Evaluate f(1) = 1 − 1 − 1 = −1 < 0', expression: 'f(1) = -1', hint: 'What is f(1)?' },
      { description: 'Evaluate f(2) = 8 − 2 − 1 = 5 > 0', expression: 'f(2) = 5', hint: 'What is f(2)?' },
      { description: 'Apply IVT: f is continuous, sign changes', expression: '\\exists\\,c \\in (1,2): f(c) = 0', hint: 'What does the IVT guarantee when a continuous function changes sign?' },
    ]
  ),
]

// ===========================================================================
// continuity.types
// ===========================================================================

const CONTINUITY_TYPES: Problem[] = [
  p('continuity.types', 'conceptual', 'explain-concept',
    'Describe the difference between a removable discontinuity and a jump discontinuity.',
    'Removable: limit exists but ≠ f(a); Jump: one-sided limits exist but differ',
    '\\text{Removable: }\\lim f\\text{ exists}\\neq f(a);\\;\\text{Jump: }L^-\\neq L^+',
    [
      { description: 'Removable: limit exists, but equals wrong value or f(a) undefined', expression: '\\lim_{x\\to a}f(x)\\text{ exists, }\\neq f(a)', hint: 'Can the discontinuity be "filled in" with a single point?' },
      { description: 'Jump: one-sided limits exist but differ', expression: 'L^- \\neq L^+', hint: 'What happens to the one-sided limits at a jump?' },
    ]
  ),
  p('continuity.types', 'procedural', 'free-response',
    'Classify the discontinuity of $f(x) = \\dfrac{x^2-9}{x-3}$ at $x = 3$.',
    'Removable discontinuity',
    '\\text{Removable discontinuity}',
    [
      { description: 'Factor: (x−3)(x+3)/(x−3) → x+3 for x ≠ 3', expression: '\\lim_{x\\to 3}(x+3) = 6', hint: 'What does the limit equal?' },
      { description: 'f(3) is undefined, but limit exists', expression: '\\text{Removable — redefine } f(3)=6', hint: 'Can you remove the discontinuity by defining f(3)?' },
    ]
  ),
  p('continuity.types', 'procedural', 'free-response',
    'Classify the discontinuity of $f(x) = \\begin{cases} 2x & x < 1 \\\\ x+3 & x \\geq 1 \\end{cases}$ at $x = 1$.',
    'Jump discontinuity',
    '\\text{Jump discontinuity}',
    [
      { description: 'Left limit: 2(1) = 2', expression: 'L^- = 2', hint: 'Evaluate the left branch at x = 1.' },
      { description: 'Right limit: 1 + 3 = 4', expression: 'L^+ = 4', hint: 'Evaluate the right branch at x = 1.' },
      { description: 'L⁻ ≠ L⁺ → jump discontinuity', expression: '2 \\neq 4 \\Rightarrow \\text{jump}', hint: 'What type of discontinuity occurs when one-sided limits differ?' },
    ]
  ),
  p('continuity.types', 'application', 'free-response',
    'Use the IVT to prove that $\\cos x = x$ has at least one solution in $(0, \\pi/2)$.',
    'Let g(x) = cos x − x; g(0) = 1 > 0, g(π/2) = −π/2 < 0; by IVT a root exists',
    'g(0)>0,\\;g(\\pi/2)<0\\Rightarrow\\exists\\,c\\in(0,\\pi/2):g(c)=0',
    [
      { description: 'Define g(x) = cos x − x', expression: 'g(x) = \\cos x - x', hint: 'Rewrite the equation as g(x) = 0.' },
      { description: 'g(0) = 1 > 0', expression: 'g(0) = 1', hint: 'Evaluate g at the left endpoint.' },
      { description: 'g(π/2) = 0 − π/2 < 0', expression: 'g(\\pi/2) = -\\pi/2', hint: 'Evaluate g at the right endpoint.' },
      { description: 'Apply IVT', expression: '\\exists\\,c: g(c) = 0 \\Rightarrow \\cos c = c', hint: 'What does the sign change guarantee?' },
    ]
  ),
]

// ===========================================================================
// deriv.power-rule
// ===========================================================================

const DERIV_POWER_RULE: Problem[] = [
  p('deriv.power-rule', 'conceptual', 'explain-concept',
    'State the power rule for differentiation.',
    'd/dx[x^n] = n*x^(n-1)',
    '\\dfrac{d}{dx}[x^n] = nx^{n-1}',
    [
      { description: 'State the rule', expression: '\\frac{d}{dx}[x^n] = nx^{n-1}', hint: 'What happens to the exponent and coefficient?' },
    ]
  ),
  p('deriv.power-rule', 'procedural', 'free-response',
    'Find $f\'(x)$ if $f(x) = 4x^3 - 2x^2 + 5x - 7$.',
    '12x^2 - 4x + 5',
    '12x^2 - 4x + 5',
    [
      { description: 'Differentiate term by term', expression: '\\frac{d}{dx}[4x^3] = 12x^2', hint: 'Apply the power rule to each term.' },
      { description: 'Continue', expression: '\\frac{d}{dx}[-2x^2] = -4x', hint: 'What is the derivative of −2x²?' },
      { description: 'Constant term vanishes', expression: "f'(x) = 12x^2 - 4x + 5", hint: 'What is the derivative of a constant?' },
    ]
  ),
  p('deriv.power-rule', 'procedural', 'free-response',
    'Find $\\dfrac{dy}{dx}$ if $y = \\sqrt{x} + \\dfrac{1}{x^2}$.',
    '1/(2*sqrt(x)) - 2/x^3',
    '\\dfrac{1}{2\\sqrt{x}} - \\dfrac{2}{x^3}',
    [
      { description: 'Rewrite as powers: x^(1/2) + x^(−2)', expression: 'x^{1/2} + x^{-2}', hint: 'How do you write √x and 1/x² using exponents?' },
      { description: 'Apply power rule', expression: '\\frac{1}{2}x^{-1/2} - 2x^{-3}', hint: 'Apply d/dx[xⁿ] = nxⁿ⁻¹ to each term.' },
      { description: 'Rewrite', expression: '\\frac{1}{2\\sqrt{x}} - \\frac{2}{x^3}', hint: 'Convert back to radical/fraction form.' },
    ]
  ),
  p('deriv.power-rule', 'application', 'free-response',
    'Find the equation of the tangent line to $y = x^3 - 2x$ at $x = 1$.',
    'y = x - 2',
    'y = x - 2',
    [
      { description: 'Find the slope: y\' = 3x² − 2; at x = 1: m = 1', expression: "y'(1) = 3(1)^2 - 2 = 1", hint: 'Differentiate and evaluate at x = 1.' },
      { description: 'Find the point: y(1) = 1 − 2 = −1', expression: '(1, -1)', hint: 'What is y when x = 1?' },
      { description: 'Point-slope form', expression: 'y - (-1) = 1(x - 1) \\Rightarrow y = x - 2', hint: 'Use y − y₁ = m(x − x₁).' },
    ]
  ),
]

// ===========================================================================
// deriv.product-rule
// ===========================================================================

const DERIV_PRODUCT_RULE: Problem[] = [
  p('deriv.product-rule', 'conceptual', 'explain-concept',
    'State the product rule.',
    "(uv)' = u'v + uv'",
    "(uv)' = u'v + uv'",
    [
      { description: 'State the formula', expression: "\\frac{d}{dx}[u \\cdot v] = u'v + uv'", hint: 'How do you differentiate a product of two functions?' },
    ]
  ),
  p('deriv.product-rule', 'procedural', 'free-response',
    'Differentiate $f(x) = x^2 \\sin x$.',
    '2x*sin(x) + x^2*cos(x)',
    '2x\\sin x + x^2\\cos x',
    [
      { description: 'Identify u = x², v = sin x', expression: "u = x^2,\\; v = \\sin x", hint: 'Which two functions are being multiplied?' },
      { description: "u' = 2x, v' = cos x", expression: "u' = 2x,\\; v' = \\cos x", hint: 'Differentiate each factor.' },
      { description: 'Apply product rule', expression: "2x\\sin x + x^2\\cos x", hint: "Now apply u'v + uv'." },
    ]
  ),
  p('deriv.product-rule', 'procedural', 'free-response',
    'Differentiate $g(x) = (3x^2 + 1)(x^3 - 2x)$.',
    '6x*(x^3-2x) + (3x^2+1)*(3x^2-2)',
    '6x(x^3-2x)+(3x^2+1)(3x^2-2)',
    [
      { description: 'u = 3x²+1, v = x³−2x', expression: "u' = 6x,\\; v' = 3x^2-2", hint: 'Differentiate each factor.' },
      { description: 'Apply product rule', expression: "6x(x^3-2x)+(3x^2+1)(3x^2-2)", hint: "Apply u'v + uv'." },
    ]
  ),
  p('deriv.product-rule', 'application', 'free-response',
    'Find all x where $h(x) = x^2 e^x$ has a horizontal tangent.',
    'x = 0 and x = -2',
    'x = 0 \\text{ and } x = -2',
    [
      { description: "h'(x) = 2xe^x + x^2 e^x = xe^x(2+x)", expression: "h'(x) = xe^x(2+x)", hint: 'Apply the product rule, then factor.' },
      { description: "Set h'(x) = 0: xe^x(2+x) = 0", expression: 'x = 0 \\text{ or } x = -2', hint: 'eˣ is never zero — what are the other factors?' },
    ]
  ),
]

// ===========================================================================
// deriv.quotient-rule
// ===========================================================================

const DERIV_QUOTIENT_RULE: Problem[] = [
  p('deriv.quotient-rule', 'conceptual', 'explain-concept',
    'State the quotient rule.',
    "(u/v)' = (u'v - uv') / v^2",
    "\\left(\\dfrac{u}{v}\\right)' = \\dfrac{u'v - uv'}{v^2}",
    [
      { description: 'State the formula', expression: "\\frac{d}{dx}\\left[\\frac{u}{v}\\right] = \\frac{u'v - uv'}{v^2}", hint: 'How do you differentiate a quotient?' },
    ]
  ),
  p('deriv.quotient-rule', 'procedural', 'free-response',
    'Differentiate $f(x) = \\dfrac{x^2 + 1}{x - 3}$.',
    '(x^2 - 6x - 1) / (x-3)^2',
    '\\dfrac{x^2 - 6x - 1}{(x-3)^2}',
    [
      { description: 'u = x²+1, v = x−3; u\' = 2x, v\' = 1', expression: "u'=2x,\\;v'=1", hint: 'Identify and differentiate u and v.' },
      { description: 'Apply quotient rule', expression: '\\frac{2x(x-3)-(x^2+1)(1)}{(x-3)^2}', hint: "Apply (u'v − uv')/v²." },
      { description: 'Simplify numerator', expression: '\\frac{2x^2-6x-x^2-1}{(x-3)^2} = \\frac{x^2-6x-1}{(x-3)^2}', hint: 'Expand and collect like terms.' },
    ]
  ),
  p('deriv.quotient-rule', 'procedural', 'free-response',
    'Differentiate $g(x) = \\dfrac{\\sin x}{x}$.',
    '(x*cos(x) - sin(x)) / x^2',
    '\\dfrac{x\\cos x - \\sin x}{x^2}',
    [
      { description: 'u = sin x, v = x', expression: "u'=\\cos x,\\;v'=1", hint: 'Identify u and v.' },
      { description: 'Apply quotient rule', expression: '\\frac{x\\cos x - \\sin x}{x^2}', hint: "Apply (u'v − uv')/v²." },
    ]
  ),
  p('deriv.quotient-rule', 'application', 'free-response',
    'Find the critical points of $f(x) = \\dfrac{x}{x^2+1}$.',
    'x = 1 and x = -1',
    'x = \\pm 1',
    [
      { description: "f'(x) = (x²+1 − 2x²)/(x²+1)² = (1−x²)/(x²+1)²", expression: "f'(x) = \\frac{1-x^2}{(x^2+1)^2}", hint: 'Apply the quotient rule and simplify.' },
      { description: "Set numerator = 0: 1 − x² = 0", expression: 'x = \\pm 1', hint: 'The denominator is never zero — set the numerator to zero.' },
    ]
  ),
]

// ===========================================================================
// deriv.chain-rule
// ===========================================================================

const DERIV_CHAIN_RULE: Problem[] = [
  p('deriv.chain-rule', 'conceptual', 'explain-concept',
    'State the chain rule for $\\dfrac{d}{dx}[f(g(x))]$.',
    "f'(g(x)) * g'(x)",
    "f'(g(x)) \\cdot g'(x)",
    [
      { description: 'Identify outer function f and inner function g', expression: 'f(g(x))', hint: 'Which function is applied last (outer)?' },
      { description: 'State the chain rule', expression: "\\frac{d}{dx}[f(g(x))] = f'(g(x)) \\cdot g'(x)", hint: 'Multiply the derivative of the outer (evaluated at the inner) by the derivative of the inner.' },
    ]
  ),
  p('deriv.chain-rule', 'procedural', 'free-response',
    'Differentiate $y = (3x^2 + 1)^5$.',
    '10x*(3x^2+1)^4 * 3 = 30x*(3x^2+1)^4',
    '30x(3x^2+1)^4',
    [
      { description: 'Outer: u⁵, inner: u = 3x²+1', expression: 'f(u) = u^5,\\; g(x) = 3x^2+1', hint: 'What is the outer function?' },
      { description: "f'(u) = 5u⁴, g'(x) = 6x", expression: "5(3x^2+1)^4 \\cdot 6x", hint: 'Differentiate outer and inner separately.' },
      { description: 'Simplify', expression: '30x(3x^2+1)^4', hint: 'Multiply the constants.' },
    ]
  ),
  p('deriv.chain-rule', 'procedural', 'free-response',
    'Differentiate $h(x) = \\sin(x^3)$.',
    '3x^2 * cos(x^3)',
    '3x^2\\cos(x^3)',
    [
      { description: 'Outer: sin(u), inner: u = x³', expression: "\\frac{d}{du}[\\sin u] = \\cos u", hint: 'What is the derivative of sin(u)?' },
      { description: "Inner derivative: 3x²", expression: "g'(x) = 3x^2", hint: 'Differentiate x³.' },
      { description: 'Chain rule', expression: '\\cos(x^3) \\cdot 3x^2', hint: "Multiply f'(g(x)) by g'(x)." },
    ]
  ),
  p('deriv.chain-rule', 'application', 'free-response',
    'Differentiate $f(x) = e^{\\sin x}$.',
    'cos(x) * e^(sin(x))',
    'e^{\\sin x}\\cos x',
    [
      { description: 'Outer: eᵘ, inner: u = sin x', expression: "\\frac{d}{du}[e^u] = e^u", hint: 'What is the derivative of eᵘ?' },
      { description: "Inner derivative: cos x", expression: "g'(x) = \\cos x", hint: 'Differentiate sin x.' },
      { description: 'Chain rule', expression: 'e^{\\sin x} \\cdot \\cos x', hint: "Multiply f'(g(x)) by g'(x)." },
    ]
  ),
]

// ===========================================================================
// deriv.implicit
// ===========================================================================

const DERIV_IMPLICIT: Problem[] = [
  p('deriv.implicit', 'conceptual', 'explain-concept',
    'Why do we use implicit differentiation for $x^2 + y^2 = 25$?',
    'Because y is not explicitly solved for as a function of x',
    '\\text{y is not isolated; differentiate both sides w.r.t. x}',
    [
      { description: 'y is defined implicitly', expression: 'x^2 + y^2 = 25', hint: 'Can you easily solve for y as a single function of x?' },
      { description: 'Differentiate both sides with respect to x, treating y as a function of x', expression: '2x + 2y\\frac{dy}{dx} = 0', hint: 'What rule applies when differentiating y²?' },
    ]
  ),
  p('deriv.implicit', 'procedural', 'free-response',
    'Find $\\dfrac{dy}{dx}$ for $x^2 + y^2 = 25$.',
    '-x/y',
    '-\\dfrac{x}{y}',
    [
      { description: 'Differentiate both sides', expression: '2x + 2y\\frac{dy}{dx} = 0', hint: 'Apply d/dx to both sides, using the chain rule on y².' },
      { description: 'Solve for dy/dx', expression: '\\frac{dy}{dx} = -\\frac{x}{y}', hint: 'Isolate dy/dx.' },
    ]
  ),
  p('deriv.implicit', 'procedural', 'free-response',
    'Find $\\dfrac{dy}{dx}$ for $x^3 + y^3 = 6xy$.',
    '(2y - x^2) / (y^2 - 2x)',
    '\\dfrac{2y - x^2}{y^2 - 2x}',
    [
      { description: 'Differentiate both sides', expression: '3x^2 + 3y^2\\frac{dy}{dx} = 6y + 6x\\frac{dy}{dx}', hint: 'Use the product rule on 6xy.' },
      { description: 'Collect dy/dx terms', expression: '(3y^2 - 6x)\\frac{dy}{dx} = 6y - 3x^2', hint: 'Move all dy/dx terms to one side.' },
      { description: 'Solve', expression: '\\frac{dy}{dx} = \\frac{6y-3x^2}{3y^2-6x} = \\frac{2y-x^2}{y^2-2x}', hint: 'Divide and simplify.' },
    ]
  ),
  p('deriv.implicit', 'application', 'free-response',
    'Find the slope of the tangent to $x^2 + y^2 = 25$ at the point $(3, 4)$.',
    '-3/4',
    '-\\dfrac{3}{4}',
    [
      { description: 'dy/dx = −x/y', expression: '\\frac{dy}{dx} = -\\frac{x}{y}', hint: 'Use the result from implicit differentiation.' },
      { description: 'Substitute (3, 4)', expression: '-\\frac{3}{4}', hint: 'Plug in x = 3, y = 4.' },
    ]
  ),
]

// ===========================================================================
// deriv.related-rates
// ===========================================================================

const DERIV_RELATED_RATES: Problem[] = [
  p('deriv.related-rates', 'conceptual', 'explain-concept',
    'What is the key strategy for solving a related-rates problem?',
    'Write an equation relating the quantities, then differentiate with respect to time',
    '\\text{Relate quantities, then differentiate w.r.t. } t',
    [
      { description: 'Identify all changing quantities and their rates', expression: 'x(t),\\; y(t),\\; \\frac{dx}{dt},\\; \\frac{dy}{dt}', hint: 'What quantities are changing with time?' },
      { description: 'Write a geometric or physical equation relating them', expression: 'f(x, y) = c', hint: 'What equation connects the quantities?' },
      { description: 'Differentiate both sides with respect to t', expression: '\\frac{d}{dt}[f(x,y)] = 0', hint: 'Use implicit differentiation with respect to t.' },
    ]
  ),
  p('deriv.related-rates', 'procedural', 'free-response',
    'A ladder 10 m long leans against a wall. The bottom slides away at 2 m/s. How fast is the top sliding down when the bottom is 6 m from the wall?',
    '-3/2 m/s',
    '-\\dfrac{3}{2}\\text{ m/s}',
    [
      { description: 'Pythagorean relation: x² + y² = 100', expression: 'x^2 + y^2 = 100', hint: 'Draw the right triangle. What equation relates x and y?' },
      { description: 'Differentiate: 2x(dx/dt) + 2y(dy/dt) = 0', expression: '2x\\frac{dx}{dt} + 2y\\frac{dy}{dt} = 0', hint: 'Differentiate both sides with respect to t.' },
      { description: 'At x = 6: y = 8; dx/dt = 2', expression: '2(6)(2) + 2(8)\\frac{dy}{dt} = 0', hint: 'Find y using the Pythagorean theorem, then substitute.' },
      { description: 'Solve: dy/dt = −3/2', expression: '\\frac{dy}{dt} = -\\frac{3}{2}', hint: 'Solve for dy/dt.' },
    ]
  ),
  p('deriv.related-rates', 'procedural', 'free-response',
    'A spherical balloon is inflated at 10 cm³/s. How fast is the radius increasing when r = 5 cm?',
    '1/(10π) cm/s',
    '\\dfrac{1}{10\\pi}\\text{ cm/s}',
    [
      { description: 'Volume: V = (4/3)πr³', expression: 'V = \\frac{4}{3}\\pi r^3', hint: 'What is the formula for the volume of a sphere?' },
      { description: 'Differentiate: dV/dt = 4πr²(dr/dt)', expression: '\\frac{dV}{dt} = 4\\pi r^2 \\frac{dr}{dt}', hint: 'Differentiate with respect to t.' },
      { description: 'Substitute dV/dt = 10, r = 5', expression: '10 = 4\\pi(25)\\frac{dr}{dt}', hint: 'Plug in the known values.' },
      { description: 'Solve', expression: '\\frac{dr}{dt} = \\frac{10}{100\\pi} = \\frac{1}{10\\pi}', hint: 'Isolate dr/dt.' },
    ]
  ),
  p('deriv.related-rates', 'application', 'free-response',
    'Water drains from a conical tank (radius 3 m, height 6 m, vertex down) at 2 m³/min. How fast is the water level falling when h = 3 m?',
    '-8/(9π) m/min',
    '-\\dfrac{8}{9\\pi}\\text{ m/min}',
    [
      { description: 'Similar triangles: r/h = 3/6 → r = h/2', expression: 'r = \\frac{h}{2}', hint: 'Use similar triangles to express r in terms of h.' },
      { description: 'V = (1/3)π(h/2)²h = πh³/12', expression: 'V = \\frac{\\pi h^3}{12}', hint: 'Substitute r = h/2 into V = (1/3)πr²h.' },
      { description: 'dV/dt = (π/4)h²(dh/dt)', expression: '\\frac{dV}{dt} = \\frac{\\pi h^2}{4}\\frac{dh}{dt}', hint: 'Differentiate with respect to t.' },
      { description: 'Substitute dV/dt = −2, h = 3', expression: '-2 = \\frac{9\\pi}{4}\\frac{dh}{dt} \\Rightarrow \\frac{dh}{dt} = -\\frac{8}{9\\pi}', hint: 'Plug in and solve.' },
    ]
  ),
]

// ===========================================================================
// deriv.optimisation
// ===========================================================================

const DERIV_OPTIMISATION: Problem[] = [
  p('deriv.optimisation', 'conceptual', 'explain-concept',
    'What is a critical point, and why are critical points important for optimisation?',
    'A point where f\'(x) = 0 or f\'(x) is undefined; extrema can only occur at critical points or endpoints',
    "f'(c)=0 \\text{ or undefined}; \\text{ extrema occur at critical points/endpoints}",
    [
      { description: "Define critical point: f'(c) = 0 or f'(c) undefined", expression: "f'(c) = 0 \\text{ or DNE}", hint: "What condition defines a critical point?" },
      { description: 'Extrema can only occur at critical points or endpoints', expression: '\\text{Extreme Value Theorem}', hint: 'Where can a continuous function on a closed interval attain its max/min?' },
    ]
  ),
  p('deriv.optimisation', 'procedural', 'free-response',
    'Find the absolute maximum and minimum of $f(x) = x^3 - 3x$ on $[-2, 2]$.',
    'Max: 2 at x = -1; Min: -2 at x = 1',
    '\\text{Max } 2 \\text{ at } x=-1;\\; \\text{Min } -2 \\text{ at } x=1',
    [
      { description: "f'(x) = 3x² − 3 = 0 → x = ±1", expression: 'x = \\pm 1', hint: "Set f'(x) = 0 and solve." },
      { description: 'Evaluate at critical points and endpoints', expression: 'f(-2)=-2,\\;f(-1)=2,\\;f(1)=-2,\\;f(2)=2', hint: 'Compute f at x = −2, −1, 1, 2.' },
      { description: 'Identify max and min', expression: '\\text{Max } 2,\\; \\text{Min } -2', hint: 'Which value is largest? Smallest?' },
    ]
  ),
  p('deriv.optimisation', 'application', 'free-response',
    'A farmer has 200 m of fencing to enclose a rectangular field against a barn wall (no fence needed on one side). What dimensions maximise the area?',
    'Width = 50 m, Length = 100 m',
    'w = 50\\text{ m},\\; l = 100\\text{ m}',
    [
      { description: 'Constraint: 2w + l = 200 → l = 200 − 2w', expression: 'l = 200 - 2w', hint: 'Write the fencing constraint.' },
      { description: 'Area: A = wl = w(200 − 2w) = 200w − 2w²', expression: 'A(w) = 200w - 2w^2', hint: 'Substitute l into A = wl.' },
      { description: "A'(w) = 200 − 4w = 0 → w = 50", expression: 'w = 50', hint: "Set A'(w) = 0 and solve." },
      { description: 'l = 200 − 100 = 100', expression: 'l = 100', hint: 'Find l from the constraint.' },
    ]
  ),
  p('deriv.optimisation', 'proof-sketch', 'free-response',
    'Prove that among all rectangles with a fixed perimeter P, the square has the maximum area.',
    'Let sides be x and P/2 - x; A = x(P/2 - x); A\' = 0 gives x = P/4; both sides equal P/4',
    'x = P/4 \\Rightarrow \\text{square maximises area}',
    [
      { description: 'Let one side be x; other side is P/2 − x', expression: 'A(x) = x\\left(\\frac{P}{2}-x\\right)', hint: 'Express area as a function of one variable.' },
      { description: "A'(x) = P/2 − 2x = 0 → x = P/4", expression: 'x = P/4', hint: "Set A'(x) = 0." },
      { description: 'Both sides equal P/4 — a square', expression: '\\text{Square: } x = \\frac{P}{2}-x = \\frac{P}{4}', hint: 'What shape has all sides equal?' },
      { description: "A''(x) = −2 < 0 confirms maximum", expression: "A''(x) = -2 < 0", hint: 'Use the second derivative test.' },
    ]
  ),
]

// ===========================================================================
// integ.riemann
// ===========================================================================

const INTEG_RIEMANN: Problem[] = [
  p('integ.riemann', 'conceptual', 'explain-concept',
    'What does a Riemann sum approximate?',
    'The area under a curve (the definite integral)',
    '\\int_a^b f(x)\\,dx \\approx \\sum_{i=1}^n f(x_i^*)\\Delta x',
    [
      { description: 'A Riemann sum partitions [a,b] into n subintervals', expression: '\\Delta x = \\frac{b-a}{n}', hint: 'How is the interval divided?' },
      { description: 'Sum of rectangle areas approximates the integral', expression: '\\sum_{i=1}^n f(x_i^*)\\Delta x', hint: 'What does each term represent geometrically?' },
    ]
  ),
  p('integ.riemann', 'procedural', 'free-response',
    'Compute the left Riemann sum for $f(x) = x^2$ on $[0, 2]$ with $n = 4$ subintervals.',
    '7/4',
    '\\dfrac{7}{4}',
    [
      { description: 'Δx = 2/4 = 0.5; left endpoints: 0, 0.5, 1, 1.5', expression: '\\Delta x = 0.5', hint: 'What is the width of each subinterval?' },
      { description: 'Sum: f(0)·0.5 + f(0.5)·0.5 + f(1)·0.5 + f(1.5)·0.5', expression: '0 + 0.125 + 0.5 + 1.125 = 1.75', hint: 'Evaluate f at each left endpoint and multiply by Δx.' },
    ]
  ),
  p('integ.riemann', 'procedural', 'free-response',
    'Write the definite integral $\\int_1^3 x^2\\,dx$ as a limit of right Riemann sums.',
    'lim_{n→∞} Σ (1 + i*2/n)^2 * (2/n)',
    '\\lim_{n\\to\\infty}\\sum_{i=1}^n\\left(1+\\frac{2i}{n}\\right)^2\\cdot\\frac{2}{n}',
    [
      { description: 'Δx = (3−1)/n = 2/n; right endpoint: xᵢ = 1 + i·(2/n)', expression: 'x_i = 1 + \\frac{2i}{n}', hint: 'What is the i-th right endpoint?' },
      { description: 'Write the limit of the sum', expression: '\\lim_{n\\to\\infty}\\sum_{i=1}^n f(x_i)\\Delta x', hint: 'Substitute into the Riemann sum formula.' },
    ]
  ),
  p('integ.riemann', 'application', 'free-response',
    'Explain why $\\int_0^1 x^2\\,dx = 1/3$ using the limit of right Riemann sums and the formula $\\sum_{i=1}^n i^2 = \\frac{n(n+1)(2n+1)}{6}$.',
    '1/3',
    '\\dfrac{1}{3}',
    [
      { description: 'Right sum: Σ(i/n)²·(1/n) = (1/n³)Σi²', expression: '\\frac{1}{n^3}\\cdot\\frac{n(n+1)(2n+1)}{6}', hint: 'Write the Riemann sum and factor out 1/n³.' },
      { description: 'Simplify and take limit', expression: '\\lim_{n\\to\\infty}\\frac{(n+1)(2n+1)}{6n^2} = \\frac{2}{6} = \\frac{1}{3}', hint: 'Divide numerator and denominator by n² and take n → ∞.' },
    ]
  ),
]

// ===========================================================================
// integ.ftc
// ===========================================================================

const INTEG_FTC: Problem[] = [
  p('integ.ftc', 'conceptual', 'explain-concept',
    'State both parts of the Fundamental Theorem of Calculus.',
    'Part 1: d/dx[∫_a^x f(t)dt] = f(x); Part 2: ∫_a^b f(x)dx = F(b) - F(a)',
    '\\text{FTC1: }\\frac{d}{dx}\\int_a^x f = f(x);\\;\\text{FTC2: }\\int_a^b f = F(b)-F(a)',
    [
      { description: 'FTC Part 1: differentiation undoes integration', expression: '\\frac{d}{dx}\\int_a^x f(t)\\,dt = f(x)', hint: 'What is the derivative of an integral with variable upper limit?' },
      { description: 'FTC Part 2: use antiderivative to evaluate definite integral', expression: '\\int_a^b f(x)\\,dx = F(b) - F(a)', hint: 'How do you evaluate a definite integral using an antiderivative?' },
    ]
  ),
  p('integ.ftc', 'procedural', 'free-response',
    'Evaluate $\\int_1^4 (2x + 3)\\,dx$.',
    '21',
    '21',
    [
      { description: 'Antiderivative: F(x) = x² + 3x', expression: 'F(x) = x^2 + 3x', hint: 'Find an antiderivative of 2x + 3.' },
      { description: 'Apply FTC Part 2', expression: 'F(4) - F(1) = (16+12) - (1+3) = 28 - 4 = 24', hint: 'Evaluate F(4) − F(1).' },
    ],
    [{ id: 'mc-ftc-1', description: 'Forgets to subtract F(a)', incorrectPattern: 'F(4) only', remediationConceptId: 'integ.ftc' }]
  ),
  p('integ.ftc', 'procedural', 'free-response',
    'Find $\\dfrac{d}{dx}\\int_0^{x^2} \\sin t\\,dt$.',
    '2x * sin(x^2)',
    '2x\\sin(x^2)',
    [
      { description: 'Upper limit is x², not x — use chain rule with FTC Part 1', expression: '\\sin(x^2) \\cdot \\frac{d}{dx}[x^2]', hint: 'The upper limit is a function of x — what rule applies?' },
      { description: 'Result', expression: '2x\\sin(x^2)', hint: 'Multiply by the derivative of the upper limit.' },
    ]
  ),
  p('integ.ftc', 'application', 'free-response',
    'Evaluate $\\int_0^{\\pi} \\sin x\\,dx$.',
    '2',
    '2',
    [
      { description: 'Antiderivative of sin x is −cos x', expression: 'F(x) = -\\cos x', hint: 'What function has derivative sin x?' },
      { description: 'Apply FTC Part 2', expression: '-\\cos\\pi - (-\\cos 0) = 1 + 1 = 2', hint: 'Evaluate −cos x at π and 0.' },
    ]
  ),
]

// ===========================================================================
// integ.substitution
// ===========================================================================

const INTEG_SUBSTITUTION: Problem[] = [
  p('integ.substitution', 'conceptual', 'explain-concept',
    'What is the key idea behind u-substitution?',
    'Reverse the chain rule by substituting u = g(x) to simplify the integrand',
    'u = g(x),\\; du = g\'(x)\\,dx \\text{ — reverses chain rule}',
    [
      { description: 'Identify an inner function u = g(x)', expression: 'u = g(x)', hint: 'Look for a function whose derivative also appears in the integrand.' },
      { description: 'Replace g\'(x)dx with du', expression: 'du = g\'(x)\\,dx', hint: 'How does the differential transform?' },
    ]
  ),
  p('integ.substitution', 'procedural', 'free-response',
    'Evaluate $\\int 2x(x^2+1)^4\\,dx$.',
    '(x^2+1)^5 / 5 + C',
    '\\dfrac{(x^2+1)^5}{5} + C',
    [
      { description: 'Let u = x²+1, du = 2x dx', expression: 'u = x^2+1,\\; du = 2x\\,dx', hint: 'What substitution simplifies the integrand?' },
      { description: 'Integral becomes ∫u⁴ du', expression: '\\int u^4\\,du = \\frac{u^5}{5}', hint: 'Rewrite in terms of u.' },
      { description: 'Back-substitute', expression: '\\frac{(x^2+1)^5}{5} + C', hint: 'Replace u with x²+1.' },
    ]
  ),
  p('integ.substitution', 'procedural', 'free-response',
    'Evaluate $\\int_0^1 x e^{x^2}\\,dx$.',
    '(e-1)/2',
    '\\dfrac{e-1}{2}',
    [
      { description: 'u = x², du = 2x dx; change limits: u(0)=0, u(1)=1', expression: 'u(0)=0,\\; u(1)=1', hint: 'Change the limits of integration when substituting.' },
      { description: 'Integral: (1/2)∫₀¹ eᵘ du', expression: '\\frac{1}{2}[e^u]_0^1', hint: 'Factor out 1/2 and integrate eᵘ.' },
      { description: 'Evaluate', expression: '\\frac{1}{2}(e-1)', hint: 'Apply FTC Part 2.' },
    ]
  ),
  p('integ.substitution', 'application', 'free-response',
    'Evaluate $\\int \\dfrac{\\ln x}{x}\\,dx$.',
    '(ln x)^2 / 2 + C',
    '\\dfrac{(\\ln x)^2}{2} + C',
    [
      { description: 'u = ln x, du = dx/x', expression: 'u = \\ln x,\\; du = \\frac{dx}{x}', hint: 'What substitution turns ln x / x into u?' },
      { description: '∫u du = u²/2', expression: '\\frac{u^2}{2} + C', hint: 'Integrate u.' },
      { description: 'Back-substitute', expression: '\\frac{(\\ln x)^2}{2} + C', hint: 'Replace u.' },
    ]
  ),
]

// ===========================================================================
// integ.by-parts
// ===========================================================================

const INTEG_BY_PARTS: Problem[] = [
  p('integ.by-parts', 'conceptual', 'explain-concept',
    'State the integration by parts formula.',
    '∫u dv = uv - ∫v du',
    '\\int u\\,dv = uv - \\int v\\,du',
    [
      { description: 'State the formula', expression: '\\int u\\,dv = uv - \\int v\\,du', hint: 'This reverses the product rule.' },
      { description: 'LIATE heuristic for choosing u', expression: '\\text{L-I-A-T-E: Log, Inverse trig, Algebraic, Trig, Exponential}', hint: 'Which type of function should be u?' },
    ]
  ),
  p('integ.by-parts', 'procedural', 'free-response',
    'Evaluate $\\int x e^x\\,dx$.',
    'x*e^x - e^x + C',
    'xe^x - e^x + C',
    [
      { description: 'u = x, dv = eˣ dx; du = dx, v = eˣ', expression: 'u=x,\\;dv=e^x\\,dx', hint: 'Choose u = x (algebraic) by LIATE.' },
      { description: 'Apply formula: xe^x − ∫eˣ dx', expression: 'xe^x - e^x + C', hint: 'Apply ∫u dv = uv − ∫v du.' },
    ]
  ),
  p('integ.by-parts', 'procedural', 'free-response',
    'Evaluate $\\int x \\ln x\\,dx$.',
    'x^2*ln(x)/2 - x^2/4 + C',
    '\\dfrac{x^2\\ln x}{2} - \\dfrac{x^2}{4} + C',
    [
      { description: 'u = ln x, dv = x dx; du = dx/x, v = x²/2', expression: 'u=\\ln x,\\;dv=x\\,dx', hint: 'Choose u = ln x (logarithm) by LIATE.' },
      { description: 'Apply formula', expression: '\\frac{x^2\\ln x}{2} - \\int\\frac{x^2}{2}\\cdot\\frac{1}{x}\\,dx = \\frac{x^2\\ln x}{2} - \\frac{x^2}{4} + C', hint: 'Simplify the remaining integral.' },
    ]
  ),
  p('integ.by-parts', 'application', 'free-response',
    'Evaluate $\\int e^x \\sin x\\,dx$.',
    '(e^x * sin(x) - e^x * cos(x)) / 2 + C',
    '\\dfrac{e^x(\\sin x - \\cos x)}{2} + C',
    [
      { description: 'Apply by parts twice; let I = ∫eˣ sin x dx', expression: 'I = e^x\\sin x - \\int e^x\\cos x\\,dx', hint: 'Apply by parts with u = sin x, dv = eˣ dx.' },
      { description: 'Apply by parts again to ∫eˣ cos x dx', expression: '\\int e^x\\cos x\\,dx = e^x\\cos x + \\int e^x\\sin x\\,dx', hint: 'Apply by parts again.' },
      { description: 'Substitute back: I = eˣ sin x − eˣ cos x − I', expression: '2I = e^x(\\sin x - \\cos x)', hint: 'Recognise I appears on both sides.' },
      { description: 'Solve for I', expression: 'I = \\frac{e^x(\\sin x - \\cos x)}{2} + C', hint: 'Divide by 2.' },
    ]
  ),
]

// ===========================================================================
// integ.definite-apps
// ===========================================================================

const INTEG_DEFINITE_APPS: Problem[] = [
  p('integ.definite-apps', 'conceptual', 'explain-concept',
    'How do you find the area between two curves $f(x)$ and $g(x)$ on $[a, b]$ where $f \\geq g$?',
    '∫_a^b [f(x) - g(x)] dx',
    '\\int_a^b [f(x) - g(x)]\\,dx',
    [
      { description: 'Identify the top and bottom curves', expression: 'f(x) \\geq g(x) \\text{ on } [a,b]', hint: 'Which curve is on top?' },
      { description: 'Integrate the difference', expression: '\\int_a^b [f(x)-g(x)]\\,dx', hint: 'What is the area of a thin vertical strip?' },
    ]
  ),
  p('integ.definite-apps', 'procedural', 'free-response',
    'Find the area between $y = x^2$ and $y = x$ on $[0, 1]$.',
    '1/6',
    '\\dfrac{1}{6}',
    [
      { description: 'On [0,1]: x ≥ x² (check at x = 0.5)', expression: 'x - x^2 \\geq 0', hint: 'Which curve is on top?' },
      { description: 'Integrate: ∫₀¹(x − x²)dx', expression: '\\left[\\frac{x^2}{2} - \\frac{x^3}{3}\\right]_0^1 = \\frac{1}{2} - \\frac{1}{3} = \\frac{1}{6}', hint: 'Evaluate the integral.' },
    ]
  ),
  p('integ.definite-apps', 'procedural', 'free-response',
    'Find the average value of $f(x) = x^2$ on $[0, 3]$.',
    '3',
    '3',
    [
      { description: 'Average value formula: (1/(b−a))∫_a^b f(x)dx', expression: '\\frac{1}{3}\\int_0^3 x^2\\,dx', hint: 'What is the formula for the average value of a function?' },
      { description: 'Evaluate: (1/3)[x³/3]₀³ = (1/3)(9) = 3', expression: '\\frac{1}{3}\\cdot 9 = 3', hint: 'Compute the integral and multiply by 1/(b−a).' },
    ]
  ),
  p('integ.definite-apps', 'application', 'free-response',
    'Find the area enclosed by $y = x^2 - 4$ and $y = -x^2 + 4$.',
    '64/3',
    '\\dfrac{64}{3}',
    [
      { description: 'Find intersections: x²−4 = −x²+4 → x = ±2', expression: 'x = \\pm 2', hint: 'Set the two expressions equal and solve.' },
      { description: 'Top curve: −x²+4 ≥ x²−4 on [−2,2]', expression: '(-x^2+4)-(x^2-4) = 8-2x^2', hint: 'Which curve is on top between the intersections?' },
      { description: 'Integrate: ∫₋₂²(8−2x²)dx', expression: '\\left[8x - \\frac{2x^3}{3}\\right]_{-2}^{2} = \\frac{64}{3}', hint: 'Evaluate the integral.' },
    ]
  ),
]

// ===========================================================================
// ode.separable
// ===========================================================================

const ODE_SEPARABLE: Problem[] = [
  p('ode.separable', 'conceptual', 'explain-concept',
    'What makes a differential equation "separable"?',
    'It can be written as dy/dx = f(x)g(y), separating x and y to opposite sides',
    '\\frac{dy}{dx} = f(x)g(y) \\Rightarrow \\frac{dy}{g(y)} = f(x)\\,dx',
    [
      { description: 'A separable ODE has the form dy/dx = f(x)g(y)', expression: '\\frac{dy}{dx} = f(x)g(y)', hint: 'Can you write the right side as a product of a function of x and a function of y?' },
      { description: 'Separate variables: dy/g(y) = f(x)dx', expression: '\\frac{dy}{g(y)} = f(x)\\,dx', hint: 'Move all y terms to one side and all x terms to the other.' },
    ]
  ),
  p('ode.separable', 'procedural', 'free-response',
    'Solve $\\dfrac{dy}{dx} = 2xy$ with $y(0) = 1$.',
    'y = e^(x^2)',
    'y = e^{x^2}',
    [
      { description: 'Separate: dy/y = 2x dx', expression: '\\frac{dy}{y} = 2x\\,dx', hint: 'Divide both sides by y and multiply by dx.' },
      { description: 'Integrate both sides: ln|y| = x²+C', expression: '\\ln|y| = x^2 + C', hint: 'Integrate each side.' },
      { description: 'Exponentiate: y = Ae^(x²)', expression: 'y = Ae^{x^2}', hint: 'Solve for y.' },
      { description: 'Apply y(0) = 1: A = 1', expression: 'y = e^{x^2}', hint: 'Use the initial condition to find A.' },
    ]
  ),
  p('ode.separable', 'procedural', 'free-response',
    'Solve $\\dfrac{dy}{dx} = \\dfrac{x}{y}$.',
    'y^2 = x^2 + C',
    'y^2 = x^2 + C',
    [
      { description: 'Separate: y dy = x dx', expression: 'y\\,dy = x\\,dx', hint: 'Multiply both sides by y and by dx.' },
      { description: 'Integrate: y²/2 = x²/2 + C₁', expression: '\\frac{y^2}{2} = \\frac{x^2}{2} + C_1', hint: 'Integrate both sides.' },
      { description: 'Simplify: y² = x² + C', expression: 'y^2 = x^2 + C', hint: 'Multiply through by 2 and absorb the constant.' },
    ]
  ),
  p('ode.separable', 'application', 'free-response',
    'A population grows at rate $\\dfrac{dP}{dt} = 0.03P$. If $P(0) = 500$, find $P(t)$.',
    'P(t) = 500*e^(0.03t)',
    'P(t) = 500e^{0.03t}',
    [
      { description: 'Separate: dP/P = 0.03 dt', expression: '\\frac{dP}{P} = 0.03\\,dt', hint: 'Separate variables.' },
      { description: 'Integrate: ln P = 0.03t + C', expression: '\\ln P = 0.03t + C', hint: 'Integrate both sides.' },
      { description: 'P = Ae^(0.03t); P(0) = 500 → A = 500', expression: 'P(t) = 500e^{0.03t}', hint: 'Apply the initial condition.' },
    ]
  ),
]

// ===========================================================================
// ode.first-order-linear
// ===========================================================================

const ODE_FIRST_ORDER_LINEAR: Problem[] = [
  p('ode.first-order-linear', 'conceptual', 'explain-concept',
    'What is the integrating factor for $\\dfrac{dy}{dx} + P(x)y = Q(x)$?',
    'μ(x) = e^(∫P(x)dx)',
    '\\mu(x) = e^{\\int P(x)\\,dx}',
    [
      { description: 'Standard form: dy/dx + P(x)y = Q(x)', expression: '\\frac{dy}{dx} + P(x)y = Q(x)', hint: 'What is the standard form of a first-order linear ODE?' },
      { description: 'Integrating factor: μ = e^(∫P dx)', expression: '\\mu(x) = e^{\\int P(x)\\,dx}', hint: 'What function, when multiplied through, makes the left side an exact derivative?' },
    ]
  ),
  p('ode.first-order-linear', 'procedural', 'free-response',
    'Solve $\\dfrac{dy}{dx} + 2y = 4$.',
    'y = 2 + Ce^(-2x)',
    'y = 2 + Ce^{-2x}',
    [
      { description: 'P(x) = 2; μ = e^(2x)', expression: '\\mu = e^{2x}', hint: 'What is the integrating factor?' },
      { description: 'Multiply through: d/dx[e^(2x)y] = 4e^(2x)', expression: '\\frac{d}{dx}[e^{2x}y] = 4e^{2x}', hint: 'Multiply both sides by μ.' },
      { description: 'Integrate: e^(2x)y = 2e^(2x) + C', expression: 'e^{2x}y = 2e^{2x} + C', hint: 'Integrate both sides.' },
      { description: 'Solve: y = 2 + Ce^(−2x)', expression: 'y = 2 + Ce^{-2x}', hint: 'Divide by e^(2x).' },
    ]
  ),
  p('ode.first-order-linear', 'procedural', 'free-response',
    'Solve $x\\dfrac{dy}{dx} + y = x^2$ for $x > 0$.',
    'y = x^2/3 + C/x',
    'y = \\dfrac{x^2}{3} + \\dfrac{C}{x}',
    [
      { description: 'Divide by x: dy/dx + y/x = x', expression: '\\frac{dy}{dx} + \\frac{1}{x}y = x', hint: 'Write in standard form.' },
      { description: 'μ = e^(∫1/x dx) = x', expression: '\\mu = x', hint: 'Compute the integrating factor.' },
      { description: 'Multiply: d/dx[xy] = x²', expression: '\\frac{d}{dx}[xy] = x^2', hint: 'Multiply through by μ = x.' },
      { description: 'Integrate and solve', expression: 'xy = \\frac{x^3}{3} + C \\Rightarrow y = \\frac{x^2}{3} + \\frac{C}{x}', hint: 'Integrate and divide by x.' },
    ]
  ),
  p('ode.first-order-linear', 'application', 'free-response',
    'A tank contains 100 L of pure water. Brine with 0.5 kg/L flows in at 2 L/min; the well-mixed solution drains at 2 L/min. Find the salt amount $A(t)$ with $A(0) = 0$.',
    'A(t) = 50(1 - e^(-t/50))',
    'A(t) = 50(1 - e^{-t/50})',
    [
      { description: 'Rate in = 0.5·2 = 1 kg/min; Rate out = (A/100)·2 = A/50 kg/min', expression: '\\frac{dA}{dt} = 1 - \\frac{A}{50}', hint: 'Write the ODE for salt: dA/dt = rate in − rate out.' },
      { description: 'Standard form: dA/dt + A/50 = 1; μ = e^(t/50)', expression: '\\mu = e^{t/50}', hint: 'Find the integrating factor.' },
      { description: 'Solve and apply A(0) = 0', expression: 'A(t) = 50(1 - e^{-t/50})', hint: 'Integrate and apply the initial condition.' },
    ]
  ),
]

// ===========================================================================
// proof-sketch problems — one per concept (Req 8.2)
// ===========================================================================
// Every concept must have at least one proof-sketch problem so that students
// who reach mastery ≥ 0.8 are served from the curated bank rather than
// falling through to LLM generation on every selection (Req 3.1, 3.3).

const PROOF_SKETCHES: Problem[] = [
  p('limits.definition', 'proof-sketch', 'free-response',
    'Using the ε-δ definition, prove that $\\lim_{x \\to 2}(3x - 1) = 5$.',
    'Given ε > 0, choose δ = ε/3; then |x-2| < δ implies |(3x-1)-5| = 3|x-2| < ε',
    '\\delta = \\varepsilon/3 \\Rightarrow |(3x-1)-5| < \\varepsilon',
    [
      { description: 'Write |f(x) − L| in terms of |x − a|', expression: '|(3x-1)-5| = |3x-6| = 3|x-2|', hint: 'Simplify |(3x−1) − 5|.' },
      { description: 'Choose δ = ε/3', expression: '\\delta = \\varepsilon/3', hint: 'What δ makes 3|x−2| < ε?' },
      { description: 'Verify: |x−2| < δ ⟹ 3|x−2| < 3·(ε/3) = ε', expression: '3|x-2| < 3\\delta = \\varepsilon', hint: 'Substitute δ and confirm the chain of inequalities.' },
    ]
  ),
  p('limits.one-sided', 'proof-sketch', 'free-response',
    'Prove that $\\lim_{x \\to 0} |x|/x$ does not exist by showing the one-sided limits differ.',
    'Left limit = -1, right limit = 1; since -1 ≠ 1 the two-sided limit does not exist',
    'L^- = -1 \\neq 1 = L^+ \\Rightarrow \\text{limit DNE}',
    [
      { description: 'For x < 0: |x|/x = −x/x = −1', expression: '\\lim_{x\\to 0^-}\\frac{|x|}{x} = -1', hint: 'What is |x| when x < 0?' },
      { description: 'For x > 0: |x|/x = x/x = 1', expression: '\\lim_{x\\to 0^+}\\frac{|x|}{x} = 1', hint: 'What is |x| when x > 0?' },
      { description: 'One-sided limits differ → limit DNE', expression: '-1 \\neq 1', hint: 'What must be true for a two-sided limit to exist?' },
    ]
  ),
  p('limits.infinity', 'proof-sketch', 'free-response',
    'Prove that $\\lim_{x \\to \\infty} \\dfrac{1}{x} = 0$ using the formal definition.',
    'Given ε > 0, choose N = 1/ε; then x > N implies |1/x - 0| = 1/x < ε',
    'N = 1/\\varepsilon \\Rightarrow x > N \\Rightarrow 1/x < \\varepsilon',
    [
      { description: 'Write |1/x − 0| = 1/x for x > 0', expression: '|1/x| = 1/x', hint: 'Simplify the expression.' },
      { description: 'Choose N = 1/ε', expression: 'N = 1/\\varepsilon', hint: 'What N makes 1/x < ε for all x > N?' },
      { description: 'Verify: x > N = 1/ε ⟹ 1/x < ε', expression: 'x > \\frac{1}{\\varepsilon} \\Rightarrow \\frac{1}{x} < \\varepsilon', hint: 'Take reciprocals (inequality flips).' },
    ]
  ),
  p('limits.lhopital', 'proof-sketch', 'free-response',
    "Explain why L'Hôpital's rule requires the 0/0 or ∞/∞ form, and give an example where applying it to a non-indeterminate form gives the wrong answer.",
    "The rule derives from Cauchy's MVT applied to f/g; without the indeterminate form the ratio is already determined. Example: lim_{x→0} x/1 = 0, but applying L'Hôpital gives 1/0 = undefined.",
    "\\text{Requires indeterminate form; misapplication: }\\lim_{x\\to 0}\\frac{x}{1}\\neq\\frac{1}{0}",
    [
      { description: "State the hypothesis: f(a) = g(a) = 0 (or both ∞)", expression: 'f(a) = g(a) = 0', hint: "What must be true about f and g at the limit point?" },
      { description: 'Without this, f(a)/g(a) is already defined — no rule needed', expression: '\\frac{f(a)}{g(a)} \\text{ defined} \\Rightarrow \\text{no rule needed}', hint: 'If the limit is not indeterminate, what happens?' },
      { description: 'Counterexample: lim x/1 = 0, but d/dx[x]/d/dx[1] = 1 ≠ 0', expression: '\\lim_{x\\to 0}\\frac{x}{1} = 0 \\neq 1', hint: 'Construct a simple example where misapplication gives the wrong answer.' },
    ]
  ),
  p('continuity.definition', 'proof-sketch', 'free-response',
    'Prove that $f(x) = x^2$ is continuous at every real number $a$.',
    'lim_{x→a} x² = a² = f(a) for all a, so all three continuity conditions hold',
    '\\lim_{x\\to a}x^2 = a^2 = f(a) \\;\\forall a\\in\\mathbb{R}',
    [
      { description: 'f(a) = a² is defined for all a', expression: 'f(a) = a^2 \\in \\mathbb{R}', hint: 'Is f(a) defined everywhere?' },
      { description: 'lim_{x→a} x² = a² (polynomial limit by substitution)', expression: '\\lim_{x\\to a}x^2 = a^2', hint: 'How do you evaluate the limit of a polynomial?' },
      { description: 'Limit equals function value — all three conditions hold', expression: 'a^2 = f(a) \\Rightarrow \\text{continuous}', hint: 'Check the third condition.' },
    ]
  ),
  p('continuity.types', 'proof-sketch', 'free-response',
    'Prove the Intermediate Value Theorem: if $f$ is continuous on $[a,b]$ and $f(a) < 0 < f(b)$, then there exists $c \\in (a,b)$ with $f(c) = 0$. (Sketch the key idea using the bisection argument.)',
    'Bisect [a,b]; the midpoint m satisfies f(m) < 0 or f(m) > 0; recurse on the half where sign changes; the nested intervals converge to c with f(c) = 0 by continuity',
    '\\text{Bisection: nested intervals }[a_n,b_n]\\to c,\\;f(c)=0',
    [
      { description: 'Let m = (a+b)/2; if f(m) = 0 done; else sign changes on [a,m] or [m,b]', expression: 'm = \\frac{a+b}{2}', hint: 'What are the cases for f(m)?' },
      { description: 'Recurse: produce nested intervals [aₙ,bₙ] with bₙ−aₙ → 0', expression: 'b_n - a_n = \\frac{b-a}{2^n} \\to 0', hint: 'How do the interval lengths shrink?' },
      { description: 'By completeness, aₙ → c; by continuity f(c) = lim f(aₙ) = 0', expression: 'f(c) = \\lim_{n\\to\\infty}f(a_n) = 0', hint: 'Use continuity to pass the limit through f.' },
    ]
  ),
  p('deriv.power-rule', 'proof-sketch', 'free-response',
    'Prove the power rule $\\dfrac{d}{dx}[x^n] = nx^{n-1}$ for positive integers $n$ using the limit definition.',
    'Use the binomial theorem: (x+h)^n = x^n + nx^(n-1)h + O(h²); subtract x^n, divide by h, take h→0',
    '\\lim_{h\\to 0}\\frac{(x+h)^n - x^n}{h} = nx^{n-1}',
    [
      { description: 'Write the difference quotient', expression: '\\frac{(x+h)^n - x^n}{h}', hint: 'Start from the definition of the derivative.' },
      { description: 'Expand (x+h)ⁿ by the binomial theorem', expression: '(x+h)^n = x^n + nx^{n-1}h + \\binom{n}{2}x^{n-2}h^2 + \\cdots', hint: 'Apply the binomial theorem.' },
      { description: 'Cancel x^n, divide by h, take h → 0', expression: '\\lim_{h\\to 0}\\left(nx^{n-1} + \\binom{n}{2}x^{n-2}h + \\cdots\\right) = nx^{n-1}', hint: 'All terms with h vanish.' },
    ]
  ),
  p('deriv.product-rule', 'proof-sketch', 'free-response',
    'Prove the product rule $(uv)\' = u\'v + uv\'$ from the limit definition.',
    'Add and subtract u(x+h)v(x) in the numerator; factor and take h→0',
    '\\lim_{h\\to 0}\\frac{u(x+h)v(x+h)-u(x)v(x)}{h} = u\'v + uv\'',
    [
      { description: 'Write the difference quotient for uv', expression: '\\frac{u(x+h)v(x+h)-u(x)v(x)}{h}', hint: 'Start from the definition.' },
      { description: 'Add and subtract u(x+h)v(x)', expression: '\\frac{u(x+h)v(x+h)-u(x+h)v(x)+u(x+h)v(x)-u(x)v(x)}{h}', hint: 'What term can you add and subtract to split the expression?' },
      { description: 'Factor and take h → 0', expression: 'u(x+h)\\cdot\\frac{v(x+h)-v(x)}{h} + v(x)\\cdot\\frac{u(x+h)-u(x)}{h} \\to u v\' + v u\'', hint: 'Recognise the derivative definitions.' },
    ]
  ),
  p('deriv.quotient-rule', 'proof-sketch', 'free-response',
    'Derive the quotient rule from the product rule.',
    'Write u = (u/v)·v; differentiate both sides using the product rule; solve for (u/v)\'',
    "\\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}",
    [
      { description: 'Write u = (u/v)·v and differentiate', expression: "u' = \\left(\\frac{u}{v}\\right)'v + \\frac{u}{v}v'", hint: 'Apply the product rule to (u/v)·v.' },
      { description: 'Solve for (u/v)\'', expression: "\\left(\\frac{u}{v}\\right)' = \\frac{u' - (u/v)v'}{v} = \\frac{u'v - uv'}{v^2}", hint: 'Isolate (u/v)\' and multiply through by 1/v.' },
    ]
  ),
  p('deriv.chain-rule', 'proof-sketch', 'free-response',
    'Sketch a proof of the chain rule $\\dfrac{d}{dx}[f(g(x))] = f\'(g(x))g\'(x)$ using the limit definition (informal version).',
    'Write Δy/Δx = (Δy/Δu)·(Δu/Δx); take Δx→0; note Δu→0 so Δy/Δu→f\'(u)',
    '\\frac{\\Delta y}{\\Delta x} = \\frac{\\Delta y}{\\Delta u}\\cdot\\frac{\\Delta u}{\\Delta x} \\to f\'(g(x))g\'(x)',
    [
      { description: 'Let u = g(x), y = f(u); write Δy/Δx = (Δy/Δu)·(Δu/Δx)', expression: '\\frac{\\Delta y}{\\Delta x} = \\frac{\\Delta y}{\\Delta u}\\cdot\\frac{\\Delta u}{\\Delta x}', hint: 'Multiply and divide by Δu.' },
      { description: 'As Δx → 0: Δu → 0 (g continuous), Δu/Δx → g\'(x)', expression: '\\frac{\\Delta u}{\\Delta x} \\to g\'(x)', hint: 'What does Δu/Δx approach?' },
      { description: 'Δy/Δu → f\'(u) = f\'(g(x))', expression: '\\frac{\\Delta y}{\\Delta u} \\to f\'(g(x))', hint: 'What does Δy/Δu approach as Δu → 0?' },
    ]
  ),
  p('deriv.implicit', 'proof-sketch', 'free-response',
    'Explain why implicit differentiation is valid: why can we differentiate both sides of $F(x, y) = 0$ with respect to $x$?',
    'By the implicit function theorem, y is locally a differentiable function of x near a point where F_y ≠ 0; differentiating both sides applies the chain rule to y(x)',
    'F_y \\neq 0 \\Rightarrow y = y(x) \\text{ locally; chain rule applies}',
    [
      { description: 'The implicit function theorem guarantees y = y(x) locally when F_y ≠ 0', expression: 'F_y(x_0, y_0) \\neq 0 \\Rightarrow \\exists y(x)', hint: 'What condition ensures y is a function of x?' },
      { description: 'Differentiating F(x, y(x)) = 0 applies the chain rule', expression: 'F_x + F_y \\frac{dy}{dx} = 0', hint: 'Apply d/dx to both sides using the chain rule on y.' },
      { description: 'Solve for dy/dx', expression: '\\frac{dy}{dx} = -\\frac{F_x}{F_y}', hint: 'Isolate dy/dx.' },
    ]
  ),
  p('deriv.related-rates', 'proof-sketch', 'free-response',
    'A point moves along the curve $y = x^2$. Show that the rate of change of the distance from the origin satisfies $\\dfrac{ds}{dt} = \\dfrac{x(1+2x^2)}{\\sqrt{x^2+x^4}}\\dfrac{dx}{dt}$.',
    'ds/dt = (x + 2x^3) / sqrt(x^2 + x^4) * dx/dt',
    '\\frac{ds}{dt} = \\frac{x(1+2x^2)}{\\sqrt{x^2+x^4}}\\frac{dx}{dt}',
    [
      { description: 's² = x² + y² = x² + x⁴', expression: 's^2 = x^2 + x^4', hint: 'Write the distance formula and substitute y = x².' },
      { description: 'Differentiate: 2s(ds/dt) = (2x + 4x³)(dx/dt)', expression: '2s\\frac{ds}{dt} = (2x+4x^3)\\frac{dx}{dt}', hint: 'Differentiate both sides with respect to t.' },
      { description: 'Divide by 2s = 2√(x²+x⁴)', expression: '\\frac{ds}{dt} = \\frac{x+2x^3}{\\sqrt{x^2+x^4}}\\frac{dx}{dt}', hint: 'Divide by 2s and simplify.' },
    ]
  ),
  p('integ.riemann', 'proof-sketch', 'free-response',
    'Prove that $\\int_0^1 x\\,dx = \\dfrac{1}{2}$ using the limit of right Riemann sums and the formula $\\sum_{i=1}^n i = \\dfrac{n(n+1)}{2}$.',
    '1/2',
    '\\dfrac{1}{2}',
    [
      { description: 'Right sum: Σ(i/n)·(1/n) = (1/n²)Σi', expression: '\\frac{1}{n^2}\\cdot\\frac{n(n+1)}{2}', hint: 'Write the Riemann sum and factor.' },
      { description: 'Simplify: (n+1)/(2n)', expression: '\\frac{n+1}{2n}', hint: 'Simplify the expression.' },
      { description: 'Take limit: (n+1)/(2n) → 1/2', expression: '\\lim_{n\\to\\infty}\\frac{n+1}{2n} = \\frac{1}{2}', hint: 'Divide numerator and denominator by n.' },
    ]
  ),
  p('integ.ftc', 'proof-sketch', 'free-response',
    'Prove FTC Part 1: if $F(x) = \\int_a^x f(t)\\,dt$ and $f$ is continuous, then $F\'(x) = f(x)$.',
    'F\'(x) = lim_{h→0} [F(x+h)-F(x)]/h = lim_{h→0} (1/h)∫_x^{x+h} f(t)dt = f(x) by MVT for integrals',
    "F'(x) = \\lim_{h\\to 0}\\frac{1}{h}\\int_x^{x+h}f(t)\\,dt = f(x)",
    [
      { description: 'Write the difference quotient for F', expression: '\\frac{F(x+h)-F(x)}{h} = \\frac{1}{h}\\int_x^{x+h}f(t)\\,dt', hint: 'Use the definition of F.' },
      { description: 'By MVT for integrals: ∫_x^{x+h} f = f(c)·h for some c ∈ (x, x+h)', expression: '\\frac{1}{h}\\cdot f(c)\\cdot h = f(c)', hint: 'Apply the Mean Value Theorem for integrals.' },
      { description: 'As h → 0: c → x, so f(c) → f(x) by continuity', expression: 'f(c) \\to f(x)', hint: 'Use continuity of f.' },
    ]
  ),
  p('integ.substitution', 'proof-sketch', 'free-response',
    'Prove the substitution rule: if $u = g(x)$ is differentiable and $f$ is continuous, then $\\int f(g(x))g\'(x)\\,dx = \\int f(u)\\,du$.',
    'Let F be an antiderivative of f; by the chain rule d/dx[F(g(x))] = f(g(x))g\'(x); integrating both sides gives the result',
    '\\frac{d}{dx}[F(g(x))] = f(g(x))g\'(x) \\Rightarrow \\int f(g(x))g\'(x)\\,dx = F(g(x))+C',
    [
      { description: 'Let F be an antiderivative of f: F\'= f', expression: "F'(u) = f(u)", hint: 'What is an antiderivative of f?' },
      { description: 'Chain rule: d/dx[F(g(x))] = F\'(g(x))g\'(x) = f(g(x))g\'(x)', expression: '\\frac{d}{dx}[F(g(x))] = f(g(x))g\'(x)', hint: 'Apply the chain rule to F(g(x)).' },
      { description: 'Integrate both sides', expression: '\\int f(g(x))g\'(x)\\,dx = F(g(x))+C = \\int f(u)\\,du', hint: 'Integrate and recognise F(g(x)) = ∫f(u)du.' },
    ]
  ),
  p('integ.by-parts', 'proof-sketch', 'free-response',
    'Derive the integration by parts formula from the product rule.',
    'Product rule: (uv)\' = u\'v + uv\'; integrate both sides; rearrange to get ∫u dv = uv - ∫v du',
    '\\int u\\,dv = uv - \\int v\\,du',
    [
      { description: 'Start from the product rule: (uv)\' = u\'v + uv\'', expression: '(uv)\' = u\'v + uv\'', hint: 'Write the product rule.' },
      { description: 'Integrate both sides', expression: 'uv = \\int u\'v\\,dx + \\int uv\'\\,dx', hint: 'Integrate both sides with respect to x.' },
      { description: 'Rearrange: ∫uv\'dx = uv − ∫u\'v dx, i.e. ∫u dv = uv − ∫v du', expression: '\\int u\\,dv = uv - \\int v\\,du', hint: 'Isolate one integral.' },
    ]
  ),
  p('integ.definite-apps', 'proof-sketch', 'free-response',
    'Prove that the average value of $f$ on $[a,b]$ equals $f(c)$ for some $c \\in [a,b]$ (Mean Value Theorem for Integrals).',
    'Let A = (1/(b-a))∫_a^b f; since f is continuous on [a,b], by IVT f attains every value between its min and max, including A',
    'A = \\frac{1}{b-a}\\int_a^b f \\in [m,M] \\Rightarrow \\exists c: f(c)=A',
    [
      { description: 'Let m = min f, M = max f on [a,b]; then m(b−a) ≤ ∫f ≤ M(b−a)', expression: 'm \\leq \\frac{1}{b-a}\\int_a^b f \\leq M', hint: 'Bound the integral using the min and max of f.' },
      { description: 'So A = (1/(b−a))∫f lies in [m, M]', expression: 'A \\in [m, M]', hint: 'What range does A fall in?' },
      { description: 'By IVT (f continuous), ∃c ∈ [a,b] with f(c) = A', expression: '\\exists c \\in [a,b]: f(c) = A', hint: 'Apply the Intermediate Value Theorem.' },
    ]
  ),
  p('ode.separable', 'proof-sketch', 'free-response',
    'Prove that $y = Ce^{kx}$ is the general solution to $\\dfrac{dy}{dx} = ky$.',
    'Separate: dy/y = k dx; integrate: ln|y| = kx + C₁; exponentiate: y = Ce^(kx) where C = ±e^(C₁)',
    'y = Ce^{kx}',
    [
      { description: 'Separate variables: dy/y = k dx', expression: '\\frac{dy}{y} = k\\,dx', hint: 'Divide both sides by y.' },
      { description: 'Integrate: ln|y| = kx + C₁', expression: '\\ln|y| = kx + C_1', hint: 'Integrate both sides.' },
      { description: 'Exponentiate: y = ±e^(C₁)e^(kx) = Ce^(kx)', expression: 'y = Ce^{kx}', hint: 'Solve for y, absorbing the sign into C.' },
      { description: 'Verify by substitution: dy/dx = kCe^(kx) = ky ✓', expression: "y' = kCe^{kx} = ky", hint: 'Check the solution satisfies the ODE.' },
    ]
  ),
  p('ode.first-order-linear', 'proof-sketch', 'free-response',
    'Derive the integrating factor method: show that multiplying $\\dfrac{dy}{dx} + P(x)y = Q(x)$ by $\\mu = e^{\\int P\\,dx}$ makes the left side an exact derivative.',
    'μy\' + μPy = (μy)\' because μ\' = μP; so d/dx[μy] = μQ; integrate both sides',
    '\\mu = e^{\\int P\\,dx} \\Rightarrow \\frac{d}{dx}[\\mu y] = \\mu Q',
    [
      { description: 'Multiply through by μ: μy\' + μPy = μQ', expression: '\\mu y\' + \\mu P y = \\mu Q', hint: 'Multiply both sides by μ.' },
      { description: 'Note μ\' = μP (since μ = e^(∫P dx))', expression: "\\mu' = \\mu P", hint: 'Differentiate μ = e^(∫P dx).' },
      { description: 'So μy\' + μ\'y = (μy)\' = μQ', expression: '\\frac{d}{dx}[\\mu y] = \\mu Q', hint: 'Recognise the product rule in reverse.' },
      { description: 'Integrate both sides to solve for y', expression: '\\mu y = \\int \\mu Q\\,dx + C', hint: 'Integrate and divide by μ.' },
    ]
  ),
]

// ===========================================================================
// Export
// ===========================================================================

/**
 * All seed problems, grouped by concept for easy inspection.
 * The seed script inserts these into SQLite via `INSERT OR IGNORE`.
 */
export const PROBLEMS: readonly Problem[] = [
  ...LIMITS_DEFINITION,
  ...LIMITS_ONE_SIDED,
  ...LIMITS_INFINITY,
  ...LIMITS_LHOPITAL,
  ...CONTINUITY_DEFINITION,
  ...CONTINUITY_TYPES,
  ...DERIV_POWER_RULE,
  ...DERIV_PRODUCT_RULE,
  ...DERIV_QUOTIENT_RULE,
  ...DERIV_CHAIN_RULE,
  ...DERIV_IMPLICIT,
  ...DERIV_RELATED_RATES,
  ...DERIV_OPTIMISATION,
  ...INTEG_RIEMANN,
  ...INTEG_FTC,
  ...INTEG_SUBSTITUTION,
  ...INTEG_BY_PARTS,
  ...INTEG_DEFINITE_APPS,
  ...ODE_SEPARABLE,
  ...ODE_FIRST_ORDER_LINEAR,
  ...PROOF_SKETCHES,
]

// ---------------------------------------------------------------------------
// Integrity check: every problem's conceptId must exist in the concept graph.
// Catches typos at module load time rather than at runtime.
// ---------------------------------------------------------------------------
for (const problem of PROBLEMS) {
  if (!CONCEPT_MAP.has(problem.conceptId)) {
    throw new TypeError(
      `Problem "${problem.id}" references unknown concept "${problem.conceptId}"`
    )
  }
}
