import * as os from 'node:os'
import { verifyModelHash } from './security/modelVerifier.js'

export type Quantisation = 'Q4_K_M' | 'Q8'

export function selectQuantisation(availableRamGb: number): Quantisation {
  return availableRamGb < 8 ? 'Q4_K_M' : 'Q8'
}

export interface BootstrapModelOptions {
  modelDir: string
  hashes: Record<Quantisation, string>
  quantisation?: Quantisation
  /**
   * Optional NLLB-200 GGUF configuration. When provided, the bootstrap
   * verifies the NLLB hash alongside Gemma so that any tampering on either
   * model fails before any session starts. Reqs 7.3, 10.3.
   */
  nllb?: {
    fileName: string
    hash: string
  }
  logger?: Pick<Console, 'log'>
}

export function parseQuantisationOverride(raw: string | undefined): Quantisation | undefined {
  if (raw === 'Q4_K_M' || raw === 'Q8') {
    return raw
  }
  return undefined
}

export interface BootstrapResult {
  modelPath: string
  quantisation: Quantisation
  availableRamGb: number
  nllbModelPath?: string
}

export async function bootstrapModel(options: BootstrapModelOptions): Promise<BootstrapResult> {
  const availableRamGb = os.totalmem() / 1024 / 1024 / 1024
  const quantisation = options.quantisation ?? selectQuantisation(availableRamGb)
  const modelPath = `${options.modelDir}/gemma4-e4b-${quantisation}.gguf`
  await verifyModelHash(modelPath, options.hashes[quantisation])

  let nllbModelPath: string | undefined
  if (options.nllb !== undefined) {
    nllbModelPath = `${options.modelDir}/${options.nllb.fileName}`
    await verifyModelHash(nllbModelPath, options.nllb.hash)
  }

  options.logger?.log(
    `[bootstrap] model=${modelPath} quantisation=${quantisation} ramGb=${availableRamGb.toFixed(1)}` +
    (nllbModelPath !== undefined ? ` nllb=${nllbModelPath}` : '')
  )
  return { modelPath, quantisation, availableRamGb, nllbModelPath }
}
