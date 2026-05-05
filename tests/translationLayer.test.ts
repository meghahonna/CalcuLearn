import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { TranslationLayer, extractLatexSpans, type TranslationBackend } from '../src/components/translationLayer.js'

class FakeTranslationBackend implements TranslationBackend {
  loadCalls = 0
  translateCalls = 0
  constructor(private readonly failLoad = false) {}
  async load(): Promise<void> {
    this.loadCalls++
    if (this.failLoad) throw new Error('load failed')
  }
  async translate(text: string, targetLanguage: string): Promise<string> {
    this.translateCalls++
    return `[${targetLanguage}]${text}`
  }
}

describe('TranslationLayer', () => {
  it('passes English through without loading the model', async () => {
    const backend = new FakeTranslationBackend()
    const layer = new TranslationLayer({ modelPath: 'nllb.gguf', backend })
    await expect(layer.translate('Hello $x^2$', 'en')).resolves.toBe('Hello $x^2$')
    expect(backend.loadCalls).toBe(0)
  })

  it('uses cache hits without additional backend translation calls', async () => {
    const backend = new FakeTranslationBackend()
    const layer = new TranslationLayer({ modelPath: 'nllb.gguf', backend })
    const first = await layer.translate('Hello world', 'fr')
    const second = await layer.translate('Hello world', 'fr')
    expect(first).toBe(second)
    expect(backend.translateCalls).toBe(1)
  })

  it('falls back to English and records one-time notice when model load fails', async () => {
    const backend = new FakeTranslationBackend(true)
    const layer = new TranslationLayer({ modelPath: 'nllb.gguf', backend, logger: { warn: () => undefined, error: () => undefined } })
    await expect(layer.translate('Bonjour?', 'fr')).resolves.toBe('Bonjour?')
    expect(layer.hasShownUnavailableNotice()).toBe(true)
  })

  it('reports at least 200 supported language codes', () => {
    const layer = new TranslationLayer({ modelPath: 'nllb.gguf', backend: new FakeTranslationBackend() })
    expect(layer.getSupportedLanguages().length).toBeGreaterThanOrEqual(200)
  })
})

describe('Property 7: LaTeX passthrough', () => {
  it('preserves every LaTeX span byte-for-byte', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => !/[$\\]/.test(s)),
        fc.string().filter((s) => !/[$\\]/.test(s)),
        async (before, after) => {
        const latex = '$\\frac{x^2}{2}$'
        const text = `${before} ${latex} ${after} \\[e^{x}\\]`
        const layer = new TranslationLayer({ modelPath: 'nllb.gguf', backend: new FakeTranslationBackend() })
        const translated = await layer.translate(text, 'fr')
        expect(extractLatexSpans(translated)).toEqual([latex, '\\[e^{x}\\]'])
      }),
      { numRuns: 100 }
    )
  })
})
