import { EvaluationResult } from './types';
interface EvaluationInput {
    attemptId: number;
    steps: Array<{
        order: number;
        customerMessage: string;
        stepGoal: string;
        scoringFocus: string[];
        answer: string;
    }>;
}
export declare function evaluateAttempt(input: EvaluationInput): Promise<EvaluationResult>;
export {};
//# sourceMappingURL=evaluator.d.ts.map