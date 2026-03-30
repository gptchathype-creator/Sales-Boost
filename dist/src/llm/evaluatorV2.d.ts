import type { Car } from '../data/carLoader';
import type { DialogState } from '../state/defaultState';
import { type EvaluationResult } from '../logic/diagnosticScoring';
import type { BehaviorSignal } from '../logic/behaviorClassifier';
export interface EvaluatorInput {
    dialogHistory: Array<{
        role: 'client' | 'manager';
        content: string;
    }>;
    car: Car;
    state: DialogState;
    earlyFail: boolean;
    failureReason?: string;
    behaviorSignals?: BehaviorSignal[];
}
export interface EvaluatorOutput {
    evaluation: EvaluationResult;
    formattedText: string;
}
export declare function evaluateSessionV2(input: EvaluatorInput): Promise<EvaluatorOutput>;
export declare function evaluationToLegacyAssessment(evaluation: EvaluationResult): {
    score: number;
    quality: string;
    improvements: string[];
    mistakes: string[];
    steps?: Array<{
        step_order: number;
        step_score: number;
        feedback?: string;
        better_example?: string;
    }>;
};
//# sourceMappingURL=evaluatorV2.d.ts.map