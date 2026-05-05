export type Quantisation = 'Q4_K_M' | 'Q8';
export declare function selectQuantisation(availableRamGb: number): Quantisation;
export interface BootstrapModelOptions {
    modelDir: string;
    hashes: Record<Quantisation, string>;
    quantisation?: Quantisation;
    /**
     * Optional NLLB-200 GGUF configuration. When provided, the bootstrap
     * verifies the NLLB hash alongside Gemma so that any tampering on either
     * model fails before any session starts. Reqs 7.3, 10.3.
     */
    nllb?: {
        fileName: string;
        hash: string;
    };
    logger?: Pick<Console, 'log'>;
}
export declare function parseQuantisationOverride(raw: string | undefined): Quantisation | undefined;
export interface BootstrapResult {
    modelPath: string;
    quantisation: Quantisation;
    availableRamGb: number;
    nllbModelPath?: string;
}
export declare function bootstrapModel(options: BootstrapModelOptions): Promise<BootstrapResult>;
