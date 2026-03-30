"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAnswerTimeout = setAnswerTimeout;
exports.clearAnswerTimeout = clearAnswerTimeout;
const db_1 = require("../db");
const ANSWER_TIMEOUT_MS = 60 * 1000; // 1 minute
const timeoutTimers = new Map();
function setAnswerTimeout(attemptId, ctx, stepNumber) {
    // Clear existing timeout for this attempt
    clearAnswerTimeout(attemptId);
    const timer = setTimeout(async () => {
        console.log(`Timeout reached for attempt ${attemptId}, step ${stepNumber}`);
        const attempt = await db_1.prisma.attempt.findUnique({
            where: { id: attemptId },
            include: {
                test: {
                    include: {
                        steps: { orderBy: { order: 'asc' } },
                    },
                },
                answers: true,
            },
        });
        if (!attempt || attempt.status !== 'in_progress') {
            timeoutTimers.delete(attemptId);
            return;
        }
        // Virtual customer: end conversation and run evaluation (no fixed steps)
        if (attempt.virtualCustomerStateJson != null) {
            timeoutTimers.delete(attemptId);
            const { completeVirtualCustomerAttempt } = await Promise.resolve().then(() => __importStar(require('../handlers/test')));
            await ctx.reply('⏱️ Время на ответ истекло. Диалог завершён. Обрабатываю результаты...');
            await completeVirtualCustomerAttempt(ctx, attempt.id, { skipInitialReply: true });
            return;
        }
        const currentStepNumber = attempt.answers.length + 1;
        const step = attempt.test.steps[currentStepNumber - 1];
        if (!step) {
            timeoutTimers.delete(attemptId);
            return;
        }
        const existingAnswer = attempt.answers.find((a) => a.stepId === step.id);
        if (existingAnswer) {
            timeoutTimers.delete(attemptId);
            return;
        }
        await db_1.prisma.attemptAnswer.create({
            data: {
                attemptId: attempt.id,
                stepId: step.id,
                answerText: '[Пропущено - превышено время ответа]',
            },
        });
        await ctx.reply(`⏱️ Время на ответ истекло. Вопрос пропущен.\n\n✅ Шаг ${currentStepNumber}/${attempt.test.steps.length} пропущен`);
        if (currentStepNumber >= attempt.test.steps.length) {
            const mod = await Promise.resolve().then(() => __importStar(require('../handlers/test')));
            await mod.completeAttempt(ctx, attempt.id);
            timeoutTimers.delete(attemptId);
        }
        else {
            await db_1.prisma.attempt.update({
                where: { id: attempt.id },
                data: {
                    currentStep: currentStepNumber + 1,
                    lastStepSentAt: new Date(),
                },
            });
            const mod = await Promise.resolve().then(() => __importStar(require('../handlers/test')));
            await mod.sendStep(ctx, attempt.id, currentStepNumber + 1);
            setAnswerTimeout(attemptId, ctx, currentStepNumber + 1);
        }
    }, ANSWER_TIMEOUT_MS);
    timeoutTimers.set(attemptId, timer);
}
function clearAnswerTimeout(attemptId) {
    const timer = timeoutTimers.get(attemptId);
    if (timer) {
        clearTimeout(timer);
        timeoutTimers.delete(attemptId);
    }
}
//# sourceMappingURL=timeout.js.map