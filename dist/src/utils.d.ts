import { Context } from 'telegraf';
export declare function isAdmin(ctx: Context | {
    from?: {
        id?: number;
        username?: string;
    };
}): boolean;
export declare function isAdminById(telegramId: string): boolean;
export declare function getUserOrCreate(telegramId: string, fullName?: string): Promise<{
    id: number;
    telegramId: string;
    fullName: string;
    role: string;
    preferencesJson: string | null;
    accountId: string | null;
    createdAt: Date;
}>;
export declare function validateAnswerText(text: string): {
    valid: boolean;
    error?: string;
};
export declare function getActiveTest(): Promise<({
    steps: {
        id: number;
        testId: number;
        order: number;
        customerMessage: string;
        stepGoal: string;
        scoringFocusJson: string;
    }[];
} & {
    id: number;
    createdAt: Date;
    title: string;
    isActive: boolean;
    useVirtualCustomer: boolean;
    virtualCustomerConfigJson: string | null;
}) | null>;
export declare function formatAttemptSummary(attempt: any): string;
export declare function formatStepBreakdown(answers: any[]): string;
export declare function sendCSV(ctx: Context): Promise<void>;
//# sourceMappingURL=utils.d.ts.map