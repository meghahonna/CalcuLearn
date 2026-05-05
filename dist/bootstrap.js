import * as os from 'node:os';
import { verifyModelHash } from './security/modelVerifier.js';
export function selectQuantisation(availableRamGb) {
    return availableRamGb < 8 ? 'Q4_K_M' : 'Q8';
}
export function parseQuantisationOverride(raw) {
    if (raw === 'Q4_K_M' || raw === 'Q8') {
        return raw;
    }
    return undefined;
}
export async function bootstrapModel(options) {
    const availableRamGb = os.totalmem() / 1024 / 1024 / 1024;
    const quantisation = options.quantisation ?? selectQuantisation(availableRamGb);
    const modelPath = `${options.modelDir}/gemma4-e4b-${quantisation}.gguf`;
    await verifyModelHash(modelPath, options.hashes[quantisation]);
    let nllbModelPath;
    if (options.nllb !== undefined) {
        nllbModelPath = `${options.modelDir}/${options.nllb.fileName}`;
        await verifyModelHash(nllbModelPath, options.nllb.hash);
    }
    options.logger?.log(`[bootstrap] model=${modelPath} quantisation=${quantisation} ramGb=${availableRamGb.toFixed(1)}` +
        (nllbModelPath !== undefined ? ` nllb=${nllbModelPath}` : ''));
    return { modelPath, quantisation, availableRamGb, nllbModelPath };
}
//# sourceMappingURL=bootstrap.js.map