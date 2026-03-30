import { z } from 'zod';
export type UserRole = 'manager' | 'admin';
export declare const EvaluationResultSchema: z.ZodObject<{
    total_score: z.ZodNumber;
    level: z.ZodEnum<["Junior", "Middle", "Senior"]>;
    overall: z.ZodObject<{
        strengths: z.ZodArray<z.ZodString, "many">;
        weaknesses: z.ZodArray<z.ZodString, "many">;
        recommendations: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
    }, {
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
    }>;
    steps: z.ZodArray<z.ZodObject<{
        step_order: z.ZodNumber;
        step_score: z.ZodNumber;
        criteria: z.ZodRecord<z.ZodString, z.ZodNumber>;
        feedback: z.ZodString;
        better_example: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        step_order: number;
        step_score: number;
        criteria: Record<string, number>;
        feedback: string;
        better_example: string;
    }, {
        step_order: number;
        step_score: number;
        criteria: Record<string, number>;
        feedback: string;
        better_example: string;
    }>, "many">;
    suspicion_flags: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    total_score: number;
    level: "Junior" | "Middle" | "Senior";
    overall: {
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
    };
    steps: {
        step_order: number;
        step_score: number;
        criteria: Record<string, number>;
        feedback: string;
        better_example: string;
    }[];
    suspicion_flags: string[];
}, {
    total_score: number;
    level: "Junior" | "Middle" | "Senior";
    overall: {
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
    };
    steps: {
        step_order: number;
        step_score: number;
        criteria: Record<string, number>;
        feedback: string;
        better_example: string;
    }[];
    suspicion_flags: string[];
}>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export type AttemptStatus = 'in_progress' | 'completed';
export interface TestStepData {
    order: number;
    customerMessage: string;
    stepGoal: string;
    scoringFocus: string[];
}
//# sourceMappingURL=types.d.ts.map