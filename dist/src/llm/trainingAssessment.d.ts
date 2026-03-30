export interface TrainingAssessmentInput {
    dialogHistory: Array<{
        role: 'client' | 'manager';
        content: string;
    }>;
    userName?: string;
}
export interface AssessmentStep {
    step_order: number;
    step_score: number;
    feedback?: string;
    better_example?: string;
}
export interface AssessmentResult {
    score: number;
    quality: string;
    improvements: string[];
    mistakes: string[];
    steps?: AssessmentStep[];
}
export interface TrainingAssessmentOutput {
    formattedText: string;
    data: AssessmentResult;
}
/**
 * Generate a simplified personal assessment for the manager after training.
 * Returns formatted text and parsed data for storage.
 */
export declare function generateTrainingAssessment(input: TrainingAssessmentInput): Promise<TrainingAssessmentOutput>;
//# sourceMappingURL=trainingAssessment.d.ts.map