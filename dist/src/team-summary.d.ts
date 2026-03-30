export interface TeamSummaryData {
    totalAttempts: number;
    avgScore: number;
    levelCounts: {
        Junior: number;
        Middle: number;
        Senior: number;
    };
    topWeaknesses: Array<{
        weakness: string;
        count: number;
    }>;
    topStrengths: Array<{
        strength: string;
        count: number;
    }>;
    attempts: Array<{
        userName: string;
        score: number;
        level: string;
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
    }>;
}
export declare function generateExpertTeamSummary(data: TeamSummaryData): Promise<{
    executiveSummary: string;
    detailedAnalysis: string;
    keyFindings: Array<{
        title: string;
        description: string;
        examples?: string[];
    }>;
    actionPlan: Array<{
        priority: string;
        action: string;
        target: string;
        timeline: string;
    }>;
    recommendations: string[];
}>;
//# sourceMappingURL=team-summary.d.ts.map