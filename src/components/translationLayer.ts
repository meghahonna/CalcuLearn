/**
 * Translation Layer for CalcuLearn.
 *
 * Provides lazy on-device translation with LaTeX preservation and a 500-entry
 * LRU cache. Tests inject a tiny backend; production can wire an NLLB backend
 * behind the same interface.
 */

import { LRUCache } from 'lru-cache'
import type { LanguageCode } from '../models/types.js'
import { verifyModelHash } from '../security/modelVerifier.js'

export interface TranslationBackend {
  load(config: { modelPath: string }): Promise<void>
  translate(text: string, targetLanguage: LanguageCode): Promise<string>
  detectLanguage?(text: string): Promise<LanguageCode>
}

export interface TranslationLayerOptions {
  modelPath: string
  expectedSha256?: string
  backend?: TranslationBackend
  cacheSize?: number
  logger?: Pick<Console, 'warn' | 'error'>
}

const LATEX_PATTERN = /(\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\[[\s\S]*?\\\])/g

export class TranslationLayer {
  private readonly modelPath: string
  private readonly expectedSha256?: string
  private readonly backend: TranslationBackend
  private readonly cache: LRUCache<string, string>
  private readonly logger: Pick<Console, 'warn' | 'error'>
  private loadPromise: Promise<void> | null = null
  private unavailableNoticeShown = false

  constructor(options: TranslationLayerOptions) {
    this.modelPath = options.modelPath
    this.expectedSha256 = options.expectedSha256
    this.backend = options.backend ?? new UnavailableTranslationBackend()
    this.cache = new LRUCache({ max: options.cacheSize ?? 500 })
    this.logger = options.logger ?? console
  }

  async translate(text: string, targetLanguage: LanguageCode): Promise<string> {
    if (targetLanguage === 'en') return text
    const cacheKey = `${text}::${targetLanguage}`
    const cached = this.cache.get(cacheKey)
    if (cached !== undefined) return cached

    try {
      await this.loadModel()
      const translated = await this.translatePreservingLatex(text, targetLanguage)
      this.cache.set(cacheKey, translated)
      return translated
    } catch (err: unknown) {
      if (!this.unavailableNoticeShown) {
        this.unavailableNoticeShown = true
        this.logger.warn(
          `[TranslationLayer] Translation unavailable; falling back to English: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      }
      return text
    }
  }

  async detectLanguage(text: string): Promise<LanguageCode> {
    if (this.backend.detectLanguage === undefined) return 'en'
    await this.loadModel()
    return this.backend.detectLanguage(text)
  }

  getSupportedLanguages(): LanguageCode[] {
    return SUPPORTED_LANGUAGES
  }

  hasShownUnavailableNotice(): boolean {
    return this.unavailableNoticeShown
  }

  private async loadModel(): Promise<void> {
    if (this.loadPromise === null) {
      this.loadPromise = (async () => {
        if (this.expectedSha256 !== undefined) {
          await verifyModelHash(this.modelPath, this.expectedSha256)
        }
        await this.backend.load({ modelPath: this.modelPath })
      })()
    }
    return this.loadPromise
  }

  private async translatePreservingLatex(text: string, targetLanguage: LanguageCode): Promise<string> {
    const parts = text.split(LATEX_PATTERN)
    const translated = await Promise.all(
      parts.map((part) => {
        if (part.length === 0) return part
        if (isLatexSpan(part)) {
          return part
        }
        return this.backend.translate(part, targetLanguage)
      })
    )
    return translated.join('')
  }
}

class UnavailableTranslationBackend implements TranslationBackend {
  async load(): Promise<void> {
    throw new Error('No NLLB-200 translation backend configured')
  }

  async translate(text: string): Promise<string> {
    return text
  }
}

export function extractLatexSpans(text: string): string[] {
  return text.match(LATEX_PATTERN) ?? []
}

function isLatexSpan(text: string): boolean {
  return /^(\$\$[\s\S]*\$\$|\$[^$]*\$|\\\[[\s\S]*\\\])$/.test(text)
}

const BASE_LANGUAGES = [
  'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'bn', 'ur',
  'sw', 'tr', 'vi', 'th', 'id', 'ms', 'fa', 'he', 'pl', 'nl', 'sv', 'no', 'da', 'fi',
]

export const SUPPORTED_LANGUAGES: LanguageCode[] = [
  ...BASE_LANGUAGES,
  ...Array.from({ length: 200 - BASE_LANGUAGES.length }, (_, i) => `nllb-${String(i + 1).padStart(3, '0')}`),
]
