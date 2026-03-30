export type ChecklistStatus = 'YES' | 'PARTIAL' | 'NO' | 'NA';
export declare const CHECKLIST_CODE: readonly ["INTRODUCTION", "SALON_NAME", "CAR_IDENTIFICATION", "NEEDS_DISCOVERY", "INITIATIVE", "PRODUCT_PRESENTATION", "CREDIT_EXPLANATION", "TRADEIN_OFFER", "OBJECTION_HANDLING", "NEXT_STEP_PROPOSAL", "DATE_FIXATION", "FOLLOW_UP_AGREEMENT", "COMMUNICATION_TONE"];
export type ChecklistCode = (typeof CHECKLIST_CODE)[number];
export declare const CHECKLIST_WEIGHTS: Record<ChecklistCode, number>;
export interface ChecklistItem {
    code: ChecklistCode;
    weight: number;
    status: ChecklistStatus;
    evidence: string[];
    comment: string;
}
export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export declare const ISSUE_TYPES: readonly ["NO_INTRO", "NO_SALON_NAME", "NO_NEEDS_DISCOVERY", "WEAK_PRESENTATION", "NO_NEXT_STEP", "NO_DATE_FIX", "WEAK_TRADEIN", "WEAK_CREDIT", "BAD_TONE", "PASSIVE_STYLE", "MISINFORMATION", "REDIRECT_TO_WEBSITE", "LOW_ENGAGEMENT", "PROFANITY"];
export type IssueType = (typeof ISSUE_TYPES)[number];
export interface EvaluationIssue {
    issue_type: IssueType;
    severity: IssueSeverity;
    evidence: string;
    recommendation: string;
}
export interface DimensionScores {
    first_contact: number;
    product_and_sales: number;
    closing_commitment: number;
    communication: number;
}
export interface EvaluationResult {
    overall_score_0_100: number;
    dimension_scores: DimensionScores;
    checklist: ChecklistItem[];
    issues: EvaluationIssue[];
    recommendations: string[];
}
export interface ScoringOptions {
    earlyFail: boolean;
    misinformationDetected: boolean;
    noNextStep: boolean;
    passiveStyle: boolean;
    passiveSeverity: 'mild' | 'strong';
}
export declare function computeDeterministicScore(checklist: ChecklistItem[], options: ScoringOptions): {
    score: number;
    dimensions: DimensionScores;
};
export declare function buildChecklistFromLLMClassification(classification: Array<{
    code: string;
    status: string;
    evidence: string[];
    comment: string;
}>): ChecklistItem[];
export declare function detectIssuesFromChecklist(checklist: ChecklistItem[], extraSignals: {
    profanity: boolean;
    misinformation: boolean;
    passiveStyle: boolean;
    lowEngagement: boolean;
    redirectToWebsite: boolean;
    badTone: boolean;
}): EvaluationIssue[];
//# sourceMappingURL=diagnosticScoring.d.ts.map