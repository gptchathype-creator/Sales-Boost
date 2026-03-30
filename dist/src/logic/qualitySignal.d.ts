export interface QualitySignal {
    very_short: boolean;
    nonsense: boolean;
    profanity: boolean;
    filler_count: number;
    anglicism_count: number;
}
export declare function computeQualitySignal(message: string): QualitySignal;
//# sourceMappingURL=qualitySignal.d.ts.map