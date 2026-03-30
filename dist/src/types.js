"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluationResultSchema = void 0;
const zod_1 = require("zod");
exports.EvaluationResultSchema = zod_1.z.object({
    total_score: zod_1.z.number().min(0).max(100),
    level: zod_1.z.enum(['Junior', 'Middle', 'Senior']),
    overall: zod_1.z.object({
        strengths: zod_1.z.array(zod_1.z.string()),
        weaknesses: zod_1.z.array(zod_1.z.string()),
        recommendations: zod_1.z.array(zod_1.z.string()),
    }),
    steps: zod_1.z.array(zod_1.z.object({
        step_order: zod_1.z.number(),
        step_score: zod_1.z.number().min(0).max(100),
        criteria: zod_1.z.record(zod_1.z.string(), zod_1.z.number().min(0).max(5)),
        feedback: zod_1.z.string(),
        better_example: zod_1.z.string(),
    })),
    suspicion_flags: zod_1.z.array(zod_1.z.string()),
});
//# sourceMappingURL=types.js.map