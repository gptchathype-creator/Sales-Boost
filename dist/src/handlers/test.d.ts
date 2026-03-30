import { Context } from 'telegraf';
export declare function handleStartTest(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function handleContinueTest(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function handleRestartTest(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function sendStep(ctx: Context, attemptId: number, stepNumber: number): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function handleAnswer(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function completeVirtualCustomerAttempt(ctx: Context, attemptId: number, options?: {
    skipInitialReply?: boolean;
}): Promise<void>;
//# sourceMappingURL=test.d.ts.map