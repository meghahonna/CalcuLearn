/**
 * src/visuals/expr.ts
 *
 * Minimal, dependency-free math expression evaluator. NO eval, NO Function.
 *
 * Supported:
 *   - Variables: x (plus any identifiers passed in env)
 *   - Operators: + - * / ^   (^ is right-associative, like math, not JS)
 *   - Unary minus
 *   - Parentheses
 *   - Functions: sin cos tan exp log ln sqrt abs floor ceil round
 *                asin acos atan sinh cosh tanh
 *   - Constants: pi, e
 *
 * Uses a tiny recursive-descent parser. Compiles once to a closure of type
 * (env: Record<string, number>) => number so the renderer can call it
 * thousands of times per frame without re-parsing.
 *
 * Returns NaN for division-by-zero, log of non-positive, sqrt of negative,
 * etc. The renderer uses NaN to mean "no point here" (skip).
 */

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp,
  log: Math.log, ln: Math.log,
  sqrt: Math.sqrt,
  abs: Math.abs,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
}

const CONSTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
}

interface Token {
  type: 'num' | 'ident' | 'op' | 'lp' | 'rp' | 'comma'
  value: string
  pos: number
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (/\s/.test(c)) { i++; continue }
    if ((c >= '0' && c <= '9') || c === '.') {
      let j = i
      while (j < src.length && (/[0-9.]/.test(src[j]!) || src[j] === 'e' || (j > i && (src[j-1] === 'e') && (src[j] === '+' || src[j] === '-')))) j++
      tokens.push({ type: 'num', value: src.slice(i, j), pos: i })
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z_0-9]/.test(src[j]!)) j++
      tokens.push({ type: 'ident', value: src.slice(i, j), pos: i })
      i = j
      continue
    }
    if ('+-*/^'.includes(c)) {
      tokens.push({ type: 'op', value: c, pos: i })
      i++
      continue
    }
    if (c === '(') { tokens.push({ type: 'lp', value: '(', pos: i }); i++; continue }
    if (c === ')') { tokens.push({ type: 'rp', value: ')', pos: i }); i++; continue }
    if (c === ',') { tokens.push({ type: 'comma', value: ',', pos: i }); i++; continue }
    throw new Error(`Unexpected character '${c}' at position ${i}`)
  }
  return tokens
}

// AST node types
type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; n: string }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; l: Node; r: Node }
  | { t: 'neg'; x: Node }
  | { t: 'call'; fn: string; args: Node[] }

class Parser {
  private pos = 0
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const node = this.parseExpr()
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token '${this.tokens[this.pos]!.value}' at ${this.tokens[this.pos]!.pos}`)
    }
    return node
  }

  private peek(): Token | undefined { return this.tokens[this.pos] }
  private consume(): Token { return this.tokens[this.pos++]! }
  private match(type: Token['type'], value?: string): boolean {
    const t = this.peek()
    if (!t) return false
    if (t.type !== type) return false
    if (value !== undefined && t.value !== value) return false
    return true
  }

  // Expr := Term (('+'|'-') Term)*
  private parseExpr(): Node {
    let left = this.parseTerm()
    while (this.match('op', '+') || this.match('op', '-')) {
      const op = this.consume().value as '+' | '-'
      const right = this.parseTerm()
      left = { t: 'bin', op, l: left, r: right }
    }
    return left
  }

  // Term := Factor (('*'|'/') Factor)*
  private parseTerm(): Node {
    let left = this.parseFactor()
    while (this.match('op', '*') || this.match('op', '/')) {
      const op = this.consume().value as '*' | '/'
      const right = this.parseFactor()
      left = { t: 'bin', op, l: left, r: right }
    }
    return left
  }

  // Factor := ('-')? Power         (unary minus binds looser than ^)
  private parseFactor(): Node {
    if (this.match('op', '-')) {
      this.consume()
      return { t: 'neg', x: this.parseFactor() }
    }
    if (this.match('op', '+')) {
      this.consume()
      return this.parseFactor()
    }
    return this.parsePower()
  }

  // Power := Primary ('^' Factor)?   (right-assoc; allows -x^2 = -(x^2))
  private parsePower(): Node {
    const base = this.parsePrimary()
    if (this.match('op', '^')) {
      this.consume()
      const right = this.parseFactor()
      return { t: 'bin', op: '^', l: base, r: right }
    }
    return base
  }

  // Primary := number | ident | ident '(' args ')' | '(' Expr ')'
  private parsePrimary(): Node {
    const t = this.peek()
    if (!t) throw new Error('Unexpected end of expression')
    if (t.type === 'num') {
      this.consume()
      return { t: 'num', v: Number(t.value) }
    }
    if (t.type === 'ident') {
      this.consume()
      if (this.match('lp')) {
        this.consume()
        const args: Node[] = []
        if (!this.match('rp')) {
          args.push(this.parseExpr())
          while (this.match('comma')) {
            this.consume()
            args.push(this.parseExpr())
          }
        }
        if (!this.match('rp')) throw new Error(`Expected ')' at ${this.peek()?.pos}`)
        this.consume()
        return { t: 'call', fn: t.value, args }
      }
      return { t: 'var', n: t.value }
    }
    if (t.type === 'lp') {
      this.consume()
      const e = this.parseExpr()
      if (!this.match('rp')) throw new Error(`Expected ')' at ${this.peek()?.pos}`)
      this.consume()
      return e
    }
    throw new Error(`Unexpected token '${t.value}' at ${t.pos}`)
  }
}

function compile(node: Node): (env: Record<string, number>) => number {
  switch (node.t) {
    case 'num': {
      const v = node.v
      return () => v
    }
    case 'var': {
      const n = node.n
      if (n in CONSTS) {
        const c = CONSTS[n]!
        return () => c
      }
      return (env) => {
        if (n in env) return env[n]!
        return NaN
      }
    }
    case 'neg': {
      const x = compile(node.x)
      return (env) => -x(env)
    }
    case 'bin': {
      const l = compile(node.l)
      const r = compile(node.r)
      switch (node.op) {
        case '+': return (env) => l(env) + r(env)
        case '-': return (env) => l(env) - r(env)
        case '*': return (env) => l(env) * r(env)
        case '/': return (env) => {
          const d = r(env)
          if (d === 0) return NaN
          return l(env) / d
        }
        case '^': return (env) => Math.pow(l(env), r(env))
      }
      throw new Error(`Unknown op ${node.op}`)
    }
    case 'call': {
      const fn = FUNCS[node.fn]
      if (!fn) throw new Error(`Unknown function '${node.fn}'`)
      if (node.args.length !== 1) throw new Error(`Function '${node.fn}' takes 1 argument`)
      const arg = compile(node.args[0]!)
      return (env) => fn(arg(env))
    }
  }
}

/**
 * Public API: parse an expression once, get back a function you can call
 * with an env (variable bindings) to evaluate it. NaN means "undefined here".
 */
export function compileExpression(src: string): (env: Record<string, number>) => number {
  if (!src || !src.trim()) throw new Error('Empty expression')
  const tokens = tokenize(src)
  const ast = new Parser(tokens).parse()
  return compile(ast)
}
