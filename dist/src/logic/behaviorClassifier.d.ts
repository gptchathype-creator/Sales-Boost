/**
 * BehaviorClassifier — deterministic, rule-based behavior analysis for every manager message.
 * LLM is NOT used here; all detection is regex/token-list based for speed and consistency.
 */
export type BehaviorSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export interface BehaviorSignal {
    toxic: boolean;
    low_effort: boolean;
    disengaging: boolean;
    low_quality: boolean;
    evasion: boolean;
    prohibited_phrase_hits: string[];
    severity: BehaviorSeverity;
    rationale: string;
}
export declare function classifyBehavior(managerMessage: string, context: {
    lastClientQuestion?: string;
    isClientWaitingAnswer: boolean;
}): BehaviorSignal;
//# sourceMappingURL=behaviorClassifier.d.ts.map