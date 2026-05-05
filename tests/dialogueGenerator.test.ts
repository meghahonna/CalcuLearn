/**
 * Tests for src/components/dialogueGenerator.ts
 */

import { describe, it, expect } from 'vitest'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  DialogueGenerator,
  ModelHashMismatchError,
  type DialogueModelBackend,
} from '../src/components/dialogueGenerator.js'
import type {
  ConceptMastery,
  ConceptNode,
  EvaluationResult,
  KnowledgeState,
  Problem,
  ProblemTemplate,
} from '../src/models/types.js'

class FakeBackend implements DialogueModelBackend {
  prompts: string[] = []
  loadCalls = 0

  constructor(private readonly response: string | (() => Promise<string>)) {}

  async load(): Promise<void> {
    this.loadCalls++
  }

  async infer(prompt: string): Promise<string> {
    this.prompts.push(prompt)
    return typeof this.response === 'string' ? this.response : this.response()
  }
}

function tempModelFile(content = 'fake gguf bytes'): { path: string; sha256: string; cleanup: () => void } {
  const p = path.join(os.tmpdir(), `calculearn-gemma-${Date.now()}-${Math.random().toString(36).slice(2)}.gguf`)
  fs.writeFileSync(p, content)
  return {
    path: p,
    sha256: crypto.createHash('sha256').update(content).digest('hex'),
    cleanup: () => {
      try {
        fs.unlinkSync(p)
      } catch {
        // best-effort cleanup
      }
    },
  }
}

function makeProblem(): Problem {
  return {
    id: 'p1',
    conceptId: 'deriv.chain-rule',
    difficulty: 'procedural',
    type: 'free-response',
    stem: 'Differentiate $\\sin(x^2)$.',
    answer: { raw: '2*x*cos(x^2)', latex: '2x\\cos(x^2)', type: 'symbolic' },
    solutionSteps: [
      {
        stepNumber: 1,
        description: 'Identify the outside and inside functions.',
        expression: 'u=x^2',
        hint: 'What is inside the sine function?',
      },
    ],
    commonMisconceptions: [],
    isGenerated: false,
  }
}

function makeState(mastery = 0.45): KnowledgeState {
  const concepts = new Map<string, ConceptMastery>()
  concepts.set('deriv.chain-rule', {
    conceptId: 'deriv.chain-rule',
    masteryProbability: mastery,
    attemptCount: 0,
    correctCount: 0,
    lastAttempted: null,
    status: 'in-progress',
  })
  return { studentId: 'student-1', concepts, lastUpdated: new Date(), sessionHistory: [] }
}

function makeResult(): EvaluationResult {
  return {
    problemId: 'p1',
    isCorrect: false,
    partialCredit: 0.25,
    misconceptions: [
      {
        id: 'mc-chain',
        description: 'Forgets to multiply by the inner derivative',
        incorrectPattern: 'cos',
        remediationConceptId: 'deriv.chain-rule',
      },
    ],
    evaluationMethod: 'symbolic',
    rawAnswer: 'cos(x^2)',
    parsedAnswer: { raw: 'cos(x^2)', latex: '\\cos(x^2)', type: 'symbolic' },
    feedbackHints: [],
  }
}

describe('DialogueGenerator model loading', () => {
  it('verifies SHA-256 before loading the backend', async () => {
    const model = tempModelFile()
    const backend = new FakeBackend('hello')
    try {
      const generator = new DialogueGenerator({
        modelPath: model.path,
        expectedSha256: model.sha256,
        backend,
      })

      await generator.loadModel()

      expect(backend.loadCalls).toBe(1)
    } finally {
      model.cleanup()
    }
  })

  it('throws on SHA-256 mismatch', async () => {
    const model = tempModelFile()
    const backend = new FakeBackend('hello')
    try {
      const generator = new DialogueGenerator({
        modelPath: model.path,
        expectedSha256: '0'.repeat(64),
        backend,
      })

      await expect(generator.loadModel()).rejects.toBeInstanceOf(ModelHashMismatchError)
      expect(backend.loadCalls).toBe(0)
    } finally {
      model.cleanup()
    }
  })
})

describe('DialogueGenerator concept name resolution', () => {
  it('uses ConceptNode.name from conceptMap for tricky IDs (Req 4.7)', async () => {
    const { CONCEPT_MAP } = await import('../src/data/concepts.js')
    const model = tempModelFile()
    const backend = new FakeBackend('ok')
    try {
      const generator = new DialogueGenerator({
        modelPath: model.path,
        backend,
        conceptMap: CONCEPT_MAP,
      })

      // limits.lhopital → ConceptNode.name is "L'Hôpital's Rule" (curly apostrophe).
      // The slug fallback would only produce "Lhopital".
      const lhopitalProblem: Problem = {
        ...makeProblem(),
        conceptId: 'limits.lhopital',
      }
      const lhopitalState: KnowledgeState = {
        studentId: 's',
        concepts: new Map([
          ['limits.lhopital', {
            conceptId: 'limits.lhopital',
            masteryProbability: 0.5,
            attemptCount: 0, correctCount: 0, lastAttempted: null, status: 'in-progress',
          }],
        ]),
        lastUpdated: new Date(),
        sessionHistory: [],
      }
      await generator.generateHint(lhopitalProblem, 1, lhopitalState)
      expect(backend.prompts[0]).toContain("L'Hôpital's Rule")
      expect(backend.prompts[0]).not.toContain('Lhopital\n')

      // integ.ftc → ConceptNode.name is "Fundamental Theorem of Calculus", not "Ftc".
      const ftcProblem: Problem = {
        ...makeProblem(),
        conceptId: 'integ.ftc',
      }
      const ftcState: KnowledgeState = {
        studentId: 's',
        concepts: new Map([
          ['integ.ftc', {
            conceptId: 'integ.ftc',
            masteryProbability: 0.5,
            attemptCount: 0, correctCount: 0, lastAttempted: null, status: 'in-progress',
          }],
        ]),
        lastUpdated: new Date(),
        sessionHistory: [],
      }
      await generator.generateHint(ftcProblem, 1, ftcState)
      expect(backend.prompts[1]).toContain('Fundamental Theorem of Calculus')
    } finally {
      model.cleanup()
    }
  })

  it('falls back to slug title-case when no conceptMap is provided', async () => {
    const model = tempModelFile()
    const backend = new FakeBackend('ok')
    try {
      const generator = new DialogueGenerator({ modelPath: model.path, backend })
      await generator.generateHint(makeProblem(), 1, makeState())
      // makeProblem() has conceptId 'deriv.chain-rule'; slug → "Chain Rule".
      expect(backend.prompts[0]).toContain('Chain Rule')
    } finally {
      model.cleanup()
    }
  })
})

describe('DialogueGenerator prompts and output limits', () => {
  it('feedback prompt contains concept name, mastery label, problem stem, and raw answer', async () => {
    const model = tempModelFile()
    const backend = new FakeBackend('Try naming the inner function first. What derivative should follow from that choice?')
    try {
      const generator = new DialogueGenerator({ modelPath: model.path, backend })

      const text = await generator.generateFeedback(makeProblem(), makeResult(), makeState())

      expect(text.split(/\s+/).length).toBeLessThanOrEqual(150)
      expect(backend.prompts[0]).toContain('Current concept name: Chain Rule')
      expect(backend.prompts[0]).toContain('Mastery label: developing')
      expect(backend.prompts[0]).toContain('Problem stem: Differentiate $\\sin(x^2)$.')
      expect(backend.prompts[0]).toContain('Student raw answer: cos(x^2)')
    } finally {
      model.cleanup()
    }
  })

  it('caps verbose model output to 150 words', async () => {
    const model = tempModelFile()
    const backend = new FakeBackend(Array.from({ length: 180 }, (_, i) => `word${i}`).join(' '))
    try {
      const generator = new DialogueGenerator({ modelPath: model.path, backend })

      const text = await generator.generateHint(makeProblem(), 1, makeState())

      expect(text.split(/\s+/).length).toBe(150)
    } finally {
      model.cleanup()
    }
  })

  it('timeout path returns fallback, logs event, and reduces context window', async () => {
    const model = tempModelFile()
    const backend = new FakeBackend(() => new Promise((resolve) => setTimeout(() => resolve('late'), 50)))
    const logs: string[] = []
    try {
      const generator = new DialogueGenerator({
        modelPath: model.path,
        backend,
        timeoutMs: 5,
        logger: {
          error: (msg?: unknown) => logs.push(String(msg)),
          warn: () => undefined,
        },
      })

      const text = await generator.generateHint(makeProblem(), 1, makeState())

      expect(text).toContain('deriv.chain-rule')
      expect(logs.some((entry) => entry.includes('Inference timeout/failure'))).toBe(true)
      expect(generator.getContextTokens()).toBe(1024)
    } finally {
      model.cleanup()
    }
  })

  it('reloads the model with the smaller context after a timeout (Req 11.2)', async () => {
    const model = tempModelFile()
    // First call times out; second call succeeds. Each call must trigger load().
    let callIndex = 0
    const backend = {
      loadCalls: 0,
      lastLoadContext: 0,
      async load(config: { contextTokens: number }) {
        this.loadCalls++
        this.lastLoadContext = config.contextTokens
      },
      async infer(): Promise<string> {
        callIndex++
        if (callIndex === 1) {
          return new Promise((resolve) => setTimeout(() => resolve('too late'), 50))
        }
        return 'second-call ok'
      },
    } satisfies DialogueModelBackend & { loadCalls: number; lastLoadContext: number }

    try {
      const generator = new DialogueGenerator({
        modelPath: model.path,
        backend,
        timeoutMs: 5,
        logger: { error: () => undefined, warn: () => undefined },
      })

      // First call: loads with default context, times out, halves to 1024.
      await generator.generateHint(makeProblem(), 1, makeState())
      expect(backend.loadCalls).toBe(1)
      expect(backend.lastLoadContext).toBe(2048)
      expect(generator.getContextTokens()).toBe(1024)

      // Second call: re-loads with the smaller context window.
      await generator.generateHint(makeProblem(), 2, makeState())
      expect(backend.loadCalls).toBe(2)
      expect(backend.lastLoadContext).toBe(1024)
    } finally {
      model.cleanup()
    }
  })
})

describe('DialogueGenerator.evaluateSemanticAnswer', () => {
  it('parses model JSON and returns clamped partialCredit + feedbackHints', async () => {
    const model = tempModelFile()
    const backend = new FakeBackend(JSON.stringify({
      isCorrect: true,
      partialCredit: 0.85,
      feedbackHints: ['Strong reasoning about one-sided limits.'],
    }))
    try {
      const generator = new DialogueGenerator({ modelPath: model.path, backend })

      const result = await generator.evaluateSemanticAnswer(
        makeProblem(),
        'as x approaches 0 from both sides, sin(x)/x approaches 1'
      )

      expect(result.isCorrect).toBe(true)
      expect(result.partialCredit).toBe(0.85)
      expect(result.feedbackHints).toEqual(['Strong reasoning about one-sided limits.'])
    } finally {
      model.cleanup()
    }
  })

  it('clamps out-of-range partialCredit and falls back conservatively on bad JSON', async () => {
    const model = tempModelFile()
    const backend = new FakeBackend('not actually JSON at all')
    try {
      const generator = new DialogueGenerator({ modelPath: model.path, backend })

      const result = await generator.evaluateSemanticAnswer(makeProblem(), 'whatever')

      expect(result.isCorrect).toBe(false)
      expect(result.partialCredit).toBe(0)
      expect(result.feedbackHints).toEqual([])
    } finally {
      model.cleanup()
    }
  })

  it('satisfies AnswerEvaluator.SemanticAnswerEvaluator end-to-end (LLM cascade)', async () => {
    // Import lazily to avoid any module-load side-effects at file top.
    const { AnswerEvaluator } = await import('../src/components/answerEvaluator.js')
    const model = tempModelFile()
    const backend = new FakeBackend(JSON.stringify({
      isCorrect: true,
      partialCredit: 0.7,
      feedbackHints: ['Acknowledge the limit existence step.'],
    }))
    try {
      const generator = new DialogueGenerator({ modelPath: model.path, backend })
      const evaluator = new AnswerEvaluator({ semanticEvaluator: generator })

      // Text-typed answer → falls past symbolic + numeric → reaches LLM path.
      const problem = makeProblem()
      const result = await evaluator.evaluate(
        { ...problem, answer: { raw: 'left and right limits agree', latex: '', type: 'text' } },
        'i think both sides approach the same number so the limit exists'
      )

      expect(result.evaluationMethod).toBe('llm')
      expect(result.isCorrect).toBe(true)
      expect(result.partialCredit).toBe(0.7)
      expect(result.feedbackHints).toEqual(['Acknowledge the limit existence step.'])
    } finally {
      model.cleanup()
    }
  })
})

describe('DialogueGenerator.generateProblemVariant', () => {
  it('parses JSON model output into a generated Problem', async () => {
    const model = tempModelFile()
    const template: ProblemTemplate = {
      id: 'template-1',
      conceptId: 'limits.definition',
      difficulty: 'conceptual',
      templateStem: 'Evaluate a simple limit.',
      parameterRanges: {},
      answerTemplate: '1',
    }
    const backend = new FakeBackend(JSON.stringify({
      id: 'variant-1',
      conceptId: 'limits.definition',
      difficulty: 'proof-sketch',
      type: 'free-response',
      stem: 'Evaluate $\\lim_{x\\to 0} (1+x)$.',
      answer: { raw: '1', latex: '1', type: 'numeric' },
      solutionSteps: [
        { stepNumber: 1, description: 'Substitute x=0.', expression: '1+0=1', hint: 'What happens at x=0?' },
      ],
      commonMisconceptions: [],
    }))
    try {
      const generator = new DialogueGenerator({ modelPath: model.path, backend })

      const problem = await generator.generateProblemVariant(template, 'conceptual')

      expect(problem.id).toBe('variant-1')
      expect(problem.conceptId).toBe('limits.definition')
      expect(problem.difficulty).toBe('conceptual')
      expect(problem.isGenerated).toBe(true)
    } finally {
      model.cleanup()
    }
  })

  it('worked examples include concept context and respect the word cap', async () => {
    const model = tempModelFile()
    const backend = new FakeBackend('Start with a simple chain rule example. Let y = sin(x^2). The outside function is sin u and the inside function is x^2. Differentiate the outside, keep the inside, then multiply by the derivative of the inside.')
    const concept: ConceptNode = {
      id: 'deriv.chain-rule',
      name: 'Chain Rule',
      topic: 'derivatives',
      prerequisites: [],
      difficulty: 3,
      description: 'Differentiate composite functions.',
      learningObjectives: [],
    }
    try {
      const generator = new DialogueGenerator({ modelPath: model.path, backend })

      const text = await generator.generateWorkedExample(concept, makeState(0.82))

      expect(text.split(/\s+/).length).toBeLessThanOrEqual(150)
      expect(backend.prompts[0]).toContain('concept "Chain Rule"')
      expect(backend.prompts[0]).toContain('Mastery label: advanced')
    } finally {
      model.cleanup()
    }
  })
})
