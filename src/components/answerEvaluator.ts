/**
 * Answer Evaluator for CalcuLearn.
 *
 * Parses and scores student answers using a symbolic → numeric → semantic
 * fallback chain. The semantic hook is intentionally small so Task 10 can wire
 * in the real on-device Dialogue Generator without coupling this component to
 * the full generator surface.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 10.2
 */

import { parse, simplify } from 'mathjs'
import type { MathNode } from 'mathjs'
import type { EvaluationResult, MathExpression, Misconception, Problem } from '../models/types.js'

const NUMERIC_SAMPLE_POINTS = [-10, -7, -5, -3, -1, 1, 2, 4, 7, 10] as const
const NUMERIC_TOLERANCE = 1e-6
const SAFE_SYMBOLS = new Set([
  'x', 'y', 'z', 't', 'u', 'v', 'a', 'b', 'c', 'h', 'n', 'C',
  'pi', 'e', 'Infinity',
])

export interface SemanticAnswerEvaluator {
  evaluateSemanticAnswer(problem: Problem, rawAnswer: string): Promise<{
    isCorrect: boolean
    partialCredit?: number
    feedbackHints?: string[]
  }>
}

export interface AnswerEvaluatorOptions {
  semanticEvaluator?: SemanticAnswerEvaluator
}

export class AnswerEvaluator {
  private readonly semanticEvaluator?: SemanticAnswerEvaluator

  constructor(options: AnswerEvaluatorOptions = {}) {
    this.semanticEvaluator = options.semanticEvaluator
  }

  parseSymbolic(raw: string): MathExpression | null {
    return parseSymbolic(raw)
  }

  checkEquivalence(expr1: MathExpression, expr2: MathExpression): boolean {
    return checkEquivalence(expr1, expr2)
  }

  async evaluate(problem: Problem, rawAnswer: string): Promise<EvaluationResult> {
    const sanitized = sanitiseInput(rawAnswer)
    const misconceptions = identifyMisconceptions(problem, sanitized)
    const parsedAnswer = parseSymbolic(sanitized)

    if (parsedAnswer !== null) {
      const isCorrect = checkEquivalence(parsedAnswer, problem.answer)
      return {
        problemId: problem.id,
        isCorrect,
        partialCredit: isCorrect ? 1 : 0,
        misconceptions,
        evaluationMethod: 'symbolic',
        rawAnswer: sanitized,
        parsedAnswer,
        feedbackHints: [],
      }
    }

    const numericResult = checkNumericEquivalence(sanitized, problem.answer)
    if (numericResult !== null) {
      return {
        problemId: problem.id,
        isCorrect: numericResult,
        partialCredit: numericResult ? 1 : 0,
        misconceptions,
        evaluationMethod: 'numeric',
        rawAnswer: sanitized,
        parsedAnswer: null,
        feedbackHints: [],
      }
    }

    const semantic = await this.semanticEvaluator?.evaluateSemanticAnswer(problem, sanitized)
    return {
      problemId: problem.id,
      isCorrect: semantic?.isCorrect ?? false,
      partialCredit: clampPartialCredit(semantic?.partialCredit ?? 0),
      misconceptions,
      evaluationMethod: 'llm',
      rawAnswer: sanitized,
      parsedAnswer: null,
      feedbackHints: semantic?.feedbackHints ?? [],
    }
  }
}

/**
 * Removes executable patterns and shell metacharacters before parsing.
 */
export function sanitiseInput(raw: string): string {
  return raw
    .replace(/__import__/gi, '')
    .replace(/\beval\b/gi, '')
    .replace(/\bexec\b/gi, '')
    .replace(/\$\([^)]*\)/g, '')
    .replace(/[;|&`]/g, '')
    .trim()
}

export function parseSymbolic(raw: string): MathExpression | null {
  const sanitized = sanitiseInput(raw)
  if (sanitized.length === 0) return null
  if (looksLikeNaturalLanguage(sanitized)) return null

  try {
    const node = parseOne(sanitized)
    if (!hasOnlySafeSymbols(node)) return null
    return {
      raw: sanitized,
      latex: node.toTex(),
      type: isNumericLiteral(sanitized) ? 'numeric' : 'symbolic',
    }
  } catch {
    return null
  }
}

export function checkEquivalence(expr1: MathExpression, expr2: MathExpression): boolean {
  if (expr1.type === 'text' || expr2.type === 'text') {
    return normaliseText(expr1.raw) === normaliseText(expr2.raw)
  }

  try {
    const difference = simplify(`(${expr1.raw}) - (${expr2.raw})`) as MathNode
    const simplified = simplify(difference).toString()
    if (simplified === '0') return true
  } catch {
    // Fall through to numeric sampling below.
  }

  return checkNumericEquivalence(expr1.raw, expr2) === true
}

export function identifyMisconceptions(problem: Problem, rawAnswer: string): Misconception[] {
  const sanitized = sanitiseInput(rawAnswer)
  return problem.commonMisconceptions.filter((misconception) =>
    patternMatches(misconception, sanitized)
  )
}

function checkNumericEquivalence(rawAnswer: string, expected: MathExpression): boolean | null {
  if (expected.type === 'text') return null

  const answer = parseMath(rawAnswer) ?? parseNumericApproximation(rawAnswer)
  const expectedNode = parseMath(expected.raw)
  if (answer === null || expectedNode === null) return null

  const variables = new Set<string>([
    ...collectSymbols(answer),
    ...collectSymbols(expectedNode),
  ])
  const scopedVariables = [...variables].filter((symbol) => !['pi', 'e', 'Infinity'].includes(symbol))

  try {
    if (scopedVariables.length === 0) {
      const a = answer.evaluate()
      const b = expectedNode.evaluate()
      return typeof a === 'number' && typeof b === 'number'
        ? almostEqual(a, b)
        : normaliseText(String(a)) === normaliseText(String(b))
    }

    for (const x of NUMERIC_SAMPLE_POINTS) {
      const scope = Object.fromEntries(scopedVariables.map((name) => [name, x]))
      const a = answer.evaluate(scope)
      const b = expectedNode.evaluate(scope)
      if (typeof a !== 'number' || typeof b !== 'number') return null
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue
      if (!almostEqual(a, b)) return false
    }
    return true
  } catch {
    return null
  }
}

function parseMath(raw: string): MathNode | null {
  const symbolic = parseSymbolic(raw)
  if (symbolic === null) return null
  try {
    return parseOne(symbolic.raw)
  } catch {
    return null
  }
}

function parseNumericApproximation(raw: string): MathNode | null {
  const match = sanitiseInput(raw).match(/-?\d+(?:\.\d+)?(?:\/-?\d+(?:\.\d+)?)?/)
  if (match === null) return null
  try {
    return parseOne(match[0])
  } catch {
    return null
  }
}

function collectSymbols(node: MathNode): string[] {
  const symbols = new Set<string>()
  walkFreeVariables(node, (name) => symbols.add(name))
  return [...symbols].filter((symbol) => SAFE_SYMBOLS.has(symbol))
}

function hasOnlySafeSymbols(node: MathNode): boolean {
  let ok = true
  walkFreeVariables(node, (name) => {
    if (!SAFE_SYMBOLS.has(name)) ok = false
  })
  return ok
}

/**
 * Walks the AST and visits every SymbolNode that represents a free variable
 * — i.e. NOT the `fn` field of a FunctionNode (which is a function name like
 * `sin`, `cos`, `exp` and is mathjs's responsibility to validate).
 *
 * This intentionally does NOT use mathjs's `traverse`, which visits the `fn`
 * SymbolNode of a FunctionNode and would cause us to reject `sin(x)` because
 * `sin` isn't in SAFE_SYMBOLS.
 */
function walkFreeVariables(node: MathNode, visit: (name: string) => void): void {
  const stack: MathNode[] = [node]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.type === 'FunctionNode') {
      // Skip current.fn — it's a function name. Recurse into args only.
      const args = (current as unknown as { args: MathNode[] }).args
      for (const arg of args) stack.push(arg)
      continue
    }
    if (current.type === 'SymbolNode') {
      visit((current as unknown as { name: string }).name)
      continue
    }
    // For other nodes, push every direct child onto the stack.
    current.forEach((child: MathNode) => stack.push(child))
  }
}

function parseOne(raw: string): MathNode {
  return parse(raw) as MathNode
}

function looksLikeNaturalLanguage(raw: string): boolean {
  const words = raw.match(/[A-Za-z]{2,}/g) ?? []
  const mathWords = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'log', 'ln', 'sqrt', 'exp'])
  const proseWords = words.filter((word) => !mathWords.has(word.toLowerCase()) && !SAFE_SYMBOLS.has(word))
  return proseWords.length >= 1 && /[\s,.:]/.test(raw)
}

function isNumericLiteral(raw: string): boolean {
  return /^-?\d+(\.\d+)?(\/-?\d+(\.\d+)?)?$/.test(raw.trim())
}

function patternMatches(misconception: Misconception, raw: string): boolean {
  const pattern = misconception.incorrectPattern
  if (pattern.length === 0) return false
  // Substring is the default — most authored patterns contain regex
  // metacharacters that the author meant literally (e.g. 'f(3) = 7').
  // Authors who genuinely want a regex must opt in explicitly.
  if (misconception.matchType === 'regex') {
    try {
      return new RegExp(pattern, 'i').test(raw)
    } catch {
      // Invalid regex — fall back to substring rather than crashing.
      return raw.toLowerCase().includes(pattern.toLowerCase())
    }
  }
  return raw.toLowerCase().includes(pattern.toLowerCase())
}

function normaliseText(v: string): string {
  return v.toLowerCase().replace(/\s+/g, ' ').trim()
}

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= NUMERIC_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b))
}

function clampPartialCredit(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}
