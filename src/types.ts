import { z } from 'zod';

export type UserRole = 'manager' | 'admin';

export const EvaluationResultSchema = z.object({
  total_score: z.number().min(0).max(100),
  level: z.enum(['Junior', 'Middle', 'Senior']),
  overall: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
  steps: z.array(
    z.object({
      step_order: z.number(),
      step_score: z.number().min(0).max(100),
      criteria: z.record(z.string(), z.number().min(0).max(5)),
      feedback: z.string(),
      better_example: z.string(),
    })
  ),
  suspicion_flags: z.array(z.string()),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export type AttemptStatus = 'in_progress' | 'completed';

export interface TestStepData {
  order: number;
  customerMessage: string;
  stepGoal: string;
  scoringFocus: string[];
}
