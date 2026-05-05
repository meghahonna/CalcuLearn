/**
 * Tests for src/components/answerEvaluator.ts
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  AnswerEvaluator,
  checkEquivalence,
  parseSymbolic,
  sanitiseInput,
} from '../src/components/answerEvaluator.js'
import type { MathExpression, Misconception, Problem } from '../src/models/types.js'

function math(raw: string, type: MathExpression['type'] = 'symbolic'): MathExpression {
  return { raw, latex: raw, type }
}

function makeProblem(answer: MathExpression, extras: Partial<Problem> = {}): Problem {
  return {
    id: extras.id ?? 'test-problem',
    conceptId: extras.conceptId ?? 'limits.definition',
    difficulty: extras.difficulty ?? 'procedural',
    type: extras.type ?? 'free-response',
    stem: extras.stem ?? 'Evaluate.',
    answer,
    solutionSteps: extras.solutionSteps ?? [
      { stepNumber: 1, description: 'Solve', expression: answer.raw, hint: 'Try simplifying.' },
    ],
    commonMisconceptions: extras.commonMisconceptions ?? [],
    isGenerated: extras.isGenerated ?? false,
  }
}

describe('sanitiseInput', () => {
  it('strips forbidden executable patterns and shell metacharacters', () => {
    const raw = '__import__("os"); eval(2+2) | exec("x") & `whoami` $(rm -rf /) 2*x'

    const sanitized = sanitiseInput(raw)

    expect(sanitized).not.toContain('__import__')
    expect(sanitized).not.toMatch(/\beval\b/)
    expect(sanitized).not.toMatch(/\bexec\b/)
    expect(sanitized).not.toMatch(/[;|&`]/)
    expect(sanitized).not.toContain('$(')
    expect(sanitized).toContain('2*x')
  })
})

describe('parseSymbolic', () => {
  it('parses valid symbolic math', () => {
    const parsed = parseSymbolic('x^2 + 2*x + 1')

    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('symbolic')
  })

  it('returns null for natural language', () => {
    expect(parseSymbolic('the answer is probably one')).toBeNull()
  })

  // Locks the SAFE_SYMBOLS fix: math function names (sin, cos, etc.) must NOT
  // be rejected as "unsafe free variables" — they're FunctionNode names, not
  // free variables. Regression guard against the prior bug where every trig /
  // exp / log answer parsed to null and got marked incorrect.
  it.each([
    ['sin(x)'],
    ['cos(x)'],
    ['tan(x)'],
    ['exp(x)'],
    ['sqrt(x)'],
    ['log(x)'],
    ['ln(x)'],
    ['sin(x)^2 + cos(x)^2'],
    ['e^(sin(x))'],
    ['cos(x) * e^(sin(x))'],
    ['ln(x)^2 / 2'],
    ['2*x*cos(x^2)'],
  ])('parses calculus answer involving math functions: %s', (raw) => {
    expect(parseSymbolic(raw), raw).not.toBeNull()
  })

  it('rejects free variables not in SAFE_SYMBOLS', () => {
    // 'foo' isn't a known variable; sanity check that the safety list is still enforced.
    expect(parseSymbolic('foo + 1')).toBeNull()
  })
})

describe('checkEquivalence', () => {
  it('uses symbolic simplification for equivalent expressions', () => {
    expect(checkEquivalence(math('x^2 + 2*x + 1'), math('(x + 1)^2'))).toBe(true)
  })

  it('returns false for non-equivalent expressions', () => {
    expect(checkEquivalence(math('x^2 + 1'), math('x^2 + 2'))).toBe(false)
  })

  it('recognises trig identity sin²x + cos²x = 1', () => {
    expect(checkEquivalence(math('sin(x)^2 + cos(x)^2'), math('1'))).toBe(true)
  })

  it('recognises commutativity in chain-rule answers', () => {
    expect(checkEquivalence(math('cos(x) * e^(sin(x))'), math('e^(sin(x)) * cos(x)'))).toBe(true)
  })

  it('marks structurally different trig expressions as not equivalent', () => {
    expect(checkEquivalence(math('sin(x)'), math('cos(x)'))).toBe(false)
  })
})

describe('AnswerEvaluator.evaluate', () => {
  it('uses the symbolic path for correct calculus answers', async () => {
    const evaluator = new AnswerEvaluator()
    const problem = makeProblem(math('2*x'))

    const result = await evaluator.evaluate(problem, 'x + x')

    expect(result.evaluationMethod).toBe('symbolic')
    expect(result.isCorrect).toBe(true)
    expect(result.partialCredit).toBe(1)
    expect(result.parsedAnswer).not.toBeNull()
  })

  it('uses the symbolic path for incorrect calculus answers', async () => {
    const evaluator = new AnswerEvaluator()
    const problem = makeProblem(math('2*x'))

    const result = await evaluator.evaluate(problem, 'x^2')

    expect(result.evaluationMethod).toBe('symbolic')
    expect(result.isCorrect).toBe(false)
    expect(result.partialCredit).toBe(0)
  })

  it('falls back to numeric checking when symbolic parsing fails', async () => {
    const evaluator = new AnswerEvaluator()
    const problem = makeProblem(math('1/3', 'numeric'))

    const result = await evaluator.evaluate(problem, 'approximately 0.3333333333')

    expect(result.evaluationMethod).toBe('numeric')
    expect(result.isCorrect).toBe(true)
  })

  it('invokes semantic fallback when numeric checking is inconclusive', async () => {
    const evaluator = new AnswerEvaluator({
      semanticEvaluator: {
        async evaluateSemanticAnswer(problem, rawAnswer) {
          expect(problem.id).toBe('conceptual-problem')
          expect(rawAnswer).toBe('it approaches the same value from both sides')
          return {
            isCorrect: true,
            partialCredit: 0.75,
            feedbackHints: ['Good conceptual direction.'],
          }
        },
      },
    })
    const problem = makeProblem(math('left and right limits match', 'text'), {
      id: 'conceptual-problem',
      type: 'explain-concept',
    })

    const result = await evaluator.evaluate(problem, 'it approaches the same value from both sides')

    expect(result.evaluationMethod).toBe('llm')
    expect(result.isCorrect).toBe(true)
    expect(result.partialCredit).toBe(0.75)
    expect(result.feedbackHints).toEqual(['Good conceptual direction.'])
  })

  it('identifies misconceptions by matching incorrectPattern against the sanitized answer', async () => {
    const misconception: Misconception = {
      id: 'mc-div-zero',
      description: 'Treats 0/0 as an answer',
      incorrectPattern: '0/0',
      remediationConceptId: 'limits.definition',
    }
    const evaluator = new AnswerEvaluator()
    const problem = makeProblem(math('2', 'numeric'), { commonMisconceptions: [misconception] })

    const result = await evaluator.evaluate(problem, '0/0; exec("bad")')

    expect(result.misconceptions).toEqual([misconception])
    expect(result.rawAnswer).not.toContain('exec')
  })

  it('matches incorrectPattern as a literal substring by default (Req 5.8)', async () => {
    // 'f(3) = 7' contains regex metacharacters — under the old regex-default
    // behaviour, '(3)' was interpreted as a capture group and matched 'f3 = 7',
    // not the literal substring. The new default is substring, so it matches
    // the literal text and not the regex-permuted version.
    const literalMisconception: Misconception = {
      id: 'mc-confuses-limit-with-value',
      description: 'Treats f(a) as the limit',
      incorrectPattern: 'f(3) = 7',
      remediationConceptId: 'limits.definition',
    }
    const evaluator = new AnswerEvaluator()
    const problem = makeProblem(math('7', 'numeric'), { commonMisconceptions: [literalMisconception] })

    // The student's answer contains the literal pattern → match.
    const literalResult = await evaluator.evaluate(problem, 'students often write f(3) = 7 instead')
    expect(literalResult.misconceptions).toEqual([literalMisconception])

    // The student's answer satisfies the regex interpretation but NOT the
    // literal substring → must NOT match.
    const regexLikeResult = await evaluator.evaluate(problem, 'f3 = 7')
    expect(regexLikeResult.misconceptions).toEqual([])
  })

  it('honours matchType: "regex" when the author opts in', async () => {
    const regexMisconception: Misconception = {
      id: 'mc-zero-over-zero',
      description: 'Indeterminate form treated as 0',
      incorrectPattern: '^0\\/0$',
      matchType: 'regex',
      remediationConceptId: 'limits.definition',
    }
    const evaluator = new AnswerEvaluator()
    const problem = makeProblem(math('2', 'numeric'), { commonMisconceptions: [regexMisconception] })

    // Anchored regex matches only when the entire (sanitized) string is "0/0".
    const exactResult = await evaluator.evaluate(problem, '0/0')
    expect(exactResult.misconceptions).toEqual([regexMisconception])

    // Same substring inside a longer string — anchored regex must NOT match,
    // proving that opt-in regex semantics are honoured.
    const substringResult = await evaluator.evaluate(problem, 'I got 0/0 here')
    expect(substringResult.misconceptions).toEqual([])
  })

  it('clamps semantic partial credit into [0, 1]', async () => {
    const evaluator = new AnswerEvaluator({
      semanticEvaluator: {
        async evaluateSemanticAnswer() {
          return { isCorrect: false, partialCredit: 2 }
        },
      },
    })
    const problem = makeProblem(math('explain continuity', 'text'), { type: 'explain-concept' })

    const result = await evaluator.evaluate(problem, 'a prose answer')

    expect(result.evaluationMethod).toBe('llm')
    expect(result.partialCredit).toBe(1)
  })
})

describe('Property 4: Evaluation Consistency', () => {
  // Equivalence pairs covering linear, polynomial, trig, exponential, and
  // product/factor forms. Each `[answer, equivSubmission, nonEquivSubmission]`
  // triple lets fc.boolean() pick whether the test runs the equivalent or
  // non-equivalent variant.
  const equivalencePairs: ReadonlyArray<[string, string, string]> = [
    ['2*x', 'x + x', 'x'],
    ['x^2 + 2*x + 1', '(x + 1)^2', 'x^2 + 2*x'],
    ['sin(x)^2 + cos(x)^2', '1', 'sin(x)'],
    ['cos(x) * e^(sin(x))', 'e^(sin(x)) * cos(x)', 'sin(x) * e^(cos(x))'],
    ['x^2 - 1', '(x - 1) * (x + 1)', 'x^2 + 1'],
    ['ln(x) / 2', '(1/2) * ln(x)', 'ln(x/2)'],
    ['e^x * e^x', 'e^(2*x)', 'e^x + e^x'],
  ]

  it('isCorrect matches checkEquivalence whenever symbolic parsing succeeds', async () => {
    const evaluator = new AnswerEvaluator()

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...equivalencePairs),
        fc.boolean(),
        async ([answer, equiv, nonEquiv], pickEquivalent) => {
          const submitted = pickEquivalent ? equiv : nonEquiv
          const parsed = parseSymbolic(submitted)
          expect(parsed, submitted).not.toBeNull()

          const problem = makeProblem(math(answer))
          const result = await evaluator.evaluate(problem, submitted)

          expect(result.isCorrect).toBe(checkEquivalence(parsed!, problem.answer))
        }
      ),
      { numRuns: 100 }
    )
  })
})
