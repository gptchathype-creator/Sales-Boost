"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStartTest = handleStartTest;
exports.handleContinueTest = handleContinueTest;
exports.handleRestartTest = handleRestartTest;
exports.sendStep = sendStep;
exports.handleAnswer = handleAnswer;
exports.completeVirtualCustomerAttempt = completeVirtualCustomerAttempt;
const db_1 = require("../db");
const utils_1 = require("../utils");
const evaluator_1 = require("../evaluator");
const virtual_customer_1 = require("../virtual-customer");
const STAGE_TO_GOAL = {
    opening: 'Установить контакт, представиться, выяснить запрос',
    car_interest: 'Уточнить интерес к конкретному авто, представить выгоды',
    value_questions: 'Раскрыть ценность предложения, ответить на вопросы',
    objections: 'Отработать возражения, сохранить доверие',
    visit_scheduling: 'Записать на визит, согласовать дату/время',
    logistics: 'Объяснить адрес и как добраться',
    wrap_up: 'Подтвердить следующие шаги и контакт',
};
const DEFAULT_SCORING_FOCUS = ['STRUCTURE', 'EMPATHY_TONE', 'NEEDS_DISCOVERY', 'OBJECTION_HANDLING', 'NEXT_STEP_CTA'];
async function handleStartTest(ctx) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
        return ctx.reply('Ошибка: не удалось определить ваш ID.');
    }
    const user = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    if (!user || user.fullName === `User ${telegramId}`) {
        return ctx.reply('Сначала укажите ваше имя, отправив /start');
    }
    const existingAttempt = await db_1.prisma.attempt.findFirst({
        where: {
            userId: user.id,
            status: 'in_progress',
        },
    });
    if (existingAttempt) {
        const isVirtual = existingAttempt.virtualCustomerStateJson != null;
        const msg = isVirtual
            ? 'У вас уже есть незавершённый диалог. Используйте кнопки для продолжения.'
            : 'У вас уже есть незавершенный тест. Используйте кнопки для продолжения.';
        return ctx.reply(msg);
    }
    const test = await (0, utils_1.getActiveTest)();
    if (!test) {
        return ctx.reply('Нет активных тестов. Обратитесь к администратору.');
    }
    const useVirtualCustomer = test.useVirtualCustomer && test.virtualCustomerConfigJson;
    if (useVirtualCustomer) {
        const config = JSON.parse(test.virtualCustomerConfigJson);
        const car = config.car ?? config;
        const dealership = config.dealership ?? 'Автосалон. Осмотр в удобном месте.';
        const initialState = {
            stage: 'opening',
            checklist: { ...virtual_customer_1.INITIAL_CHECKLIST },
            notes: '',
        };
        const attempt = await db_1.prisma.attempt.create({
            data: {
                userId: user.id,
                testId: test.id,
                status: 'in_progress',
                currentStep: 1,
                conversationHistoryJson: JSON.stringify([]),
                virtualCustomerStateJson: JSON.stringify(initialState),
            },
        });
        try {
            const out = await (0, virtual_customer_1.getVirtualCustomerMessage)({
                car,
                dealership,
                state: initialState,
                manager_last_message: null,
                client_turn_count: 1,
            });
            const history = [{ role: 'client', text: out.client_message }];
            await db_1.prisma.attempt.update({
                where: { id: attempt.id },
                data: {
                    conversationHistoryJson: JSON.stringify(history),
                    virtualCustomerStateJson: JSON.stringify(out.update_state),
                },
            });
            await ctx.reply(out.client_message);
            await ctx.reply('✍️ Напишите, что бы вы ответили клиенту (как в реальном звонке).');
            return;
        }
        catch (err) {
            console.error('Virtual customer first message error:', err);
            await ctx.reply('Не удалось начать диалог с клиентом. Попробуйте позже или выберите другой тест.');
            await db_1.prisma.attempt.update({
                where: { id: attempt.id },
                data: { status: 'completed', finishedAt: new Date(), evaluationError: String(err) },
            });
            return;
        }
    }
    const attempt = await db_1.prisma.attempt.create({
        data: {
            userId: user.id,
            testId: test.id,
            status: 'in_progress',
            currentStep: 1,
        },
    });
    await sendStep(ctx, attempt.id, 1);
}
async function handleContinueTest(ctx) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
        return ctx.reply('Ошибка: не удалось определить ваш ID.');
    }
    const user = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    if (!user) {
        return ctx.reply('Пользователь не найден. Отправьте /start');
    }
    const attempt = await db_1.prisma.attempt.findFirst({
        where: {
            userId: user.id,
            status: 'in_progress',
        },
        include: {
            test: {
                include: {
                    steps: {
                        orderBy: { order: 'asc' },
                    },
                },
            },
            answers: true,
        },
    });
    if (!attempt) {
        return ctx.reply('Нет незавершенных тестов.');
    }
    // Продолжение диалога с виртуальным клиентом — показываем последнее сообщение клиента без счётчика шагов
    if (attempt.virtualCustomerStateJson != null && attempt.conversationHistoryJson) {
        const history = JSON.parse(attempt.conversationHistoryJson);
        const lastClient = [...history].reverse().find((m) => m.role === 'client');
        if (lastClient) {
            await ctx.reply(lastClient.text);
            await ctx.reply('✍️ Напишите, что бы вы ответили клиенту.');
            return;
        }
    }
    const nextStep = attempt.answers.length + 1;
    await sendStep(ctx, attempt.id, nextStep);
}
async function handleRestartTest(ctx) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
        return ctx.reply('Ошибка: не удалось определить ваш ID.');
    }
    const user = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    if (!user) {
        return ctx.reply('Пользователь не найден. Отправьте /start');
    }
    const existingAttempts = await db_1.prisma.attempt.findMany({
        where: {
            userId: user.id,
            status: 'in_progress',
        },
    });
    // Mark abandoned attempts as cancelled (not completed) — admin shows only properly evaluated attempts
    await db_1.prisma.attempt.updateMany({
        where: {
            userId: user.id,
            status: 'in_progress',
        },
        data: {
            status: 'cancelled',
            finishedAt: new Date(),
        },
    });
    await handleStartTest(ctx);
}
async function sendStep(ctx, attemptId, stepNumber) {
    const attempt = await db_1.prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            test: {
                include: {
                    steps: {
                        orderBy: { order: 'asc' },
                    },
                },
            },
        },
    });
    if (!attempt || attempt.status !== 'in_progress') {
        return ctx.reply('Попытка не найдена или уже завершена.');
    }
    const step = attempt.test.steps[stepNumber - 1];
    if (!step) {
        return ctx.reply('Шаг не найден.');
    }
    await db_1.prisma.attempt.update({
        where: { id: attemptId },
        data: { lastStepSentAt: new Date() },
    });
    await ctx.reply(step.customerMessage);
    await ctx.reply('✍️ Напишите, что бы вы ответили клиенту.');
}
async function handleAnswer(ctx) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
        return;
    }
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : null;
    if (!text) {
        await ctx.reply('Пожалуйста, отправьте текстовый ответ.');
        return;
    }
    const validation = (0, utils_1.validateAnswerText)(text);
    if (!validation.valid) {
        await ctx.reply(validation.error);
        return;
    }
    const user = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    if (!user) {
        return ctx.reply('Пользователь не найден. Отправьте /start');
    }
    const attempt = await db_1.prisma.attempt.findFirst({
        where: {
            userId: user.id,
            status: 'in_progress',
        },
        include: {
            test: {
                include: {
                    steps: {
                        orderBy: { order: 'asc' },
                    },
                },
            },
            answers: true,
        },
    });
    if (!attempt) {
        return ctx.reply('Нет активного теста. Начните новый тест.');
    }
    // Virtual customer flow
    if (attempt.virtualCustomerStateJson && attempt.test.virtualCustomerConfigJson) {
        const config = JSON.parse(attempt.test.virtualCustomerConfigJson);
        const car = config.car ?? config;
        const dealership = config.dealership ?? 'Автосалон. Осмотр в удобном месте.';
        const state = JSON.parse(attempt.virtualCustomerStateJson);
        const history = JSON.parse(attempt.conversationHistoryJson || '[]');
        history.push({ role: 'manager', text });
        const clientTurnCount = history.filter((t) => t.role === 'client').length;
        try {
            const out = await (0, virtual_customer_1.getVirtualCustomerMessage)({
                car,
                dealership,
                state,
                manager_last_message: text,
                conversation_history: history,
                client_turn_count: clientTurnCount,
            });
            history.push({ role: 'client', text: out.client_message });
            await db_1.prisma.attempt.update({
                where: { id: attempt.id },
                data: {
                    conversationHistoryJson: JSON.stringify(history),
                    virtualCustomerStateJson: JSON.stringify(out.update_state),
                },
            });
            if (out.end_conversation) {
                await completeVirtualCustomerAttempt(ctx, attempt.id);
                return;
            }
            await ctx.reply(out.client_message);
            await ctx.reply('✍️ Напишите, что бы вы ответили клиенту.');
        }
        catch (err) {
            console.error('Virtual customer turn error:', err);
            await ctx.reply('Ошибка при ответе клиента. Диалог завершён. Результаты будут сохранены.');
            await completeVirtualCustomerAttempt(ctx, attempt.id);
        }
        return;
    }
    // Fixed-step flow
    const currentStepNumber = attempt.answers.length + 1;
    const step = attempt.test.steps[currentStepNumber - 1];
    if (!step) {
        return ctx.reply('Ошибка: шаг не найден.');
    }
    await db_1.prisma.attemptAnswer.create({
        data: {
            attemptId: attempt.id,
            stepId: step.id,
            answerText: text,
        },
    });
    await ctx.reply('✅ Ответ сохранён.');
    if (currentStepNumber >= attempt.test.steps.length) {
        await completeAttempt(ctx, attempt.id);
    }
    else {
        await db_1.prisma.attempt.update({
            where: { id: attempt.id },
            data: { currentStep: currentStepNumber + 1 },
        });
        await sendStep(ctx, attempt.id, currentStepNumber + 1);
    }
}
async function completeVirtualCustomerAttempt(ctx, attemptId, options) {
    // 1) Показываем пользователю, что диалог закончился
    if (!options?.skipInitialReply) {
        await ctx.reply('✅ Тест завершен!');
    }
    // 2) Отдельным сообщением показываем «Оцениваем тест...», его потом заменим на итог
    let processingMsg = await ctx.reply('⏳ Оцениваем тест...');
    const attempt = await db_1.prisma.attempt.findUnique({
        where: { id: attemptId },
        include: { test: true },
    });
    if (!attempt || !attempt.conversationHistoryJson) {
        await ctx.reply('Ошибка: попытка не найдена.');
        return;
    }
    const history = JSON.parse(attempt.conversationHistoryJson);
    const state = attempt.virtualCustomerStateJson
        ? JSON.parse(attempt.virtualCustomerStateJson)
        : null;
    const steps = [];
    for (let i = 0; i + 1 < history.length; i += 2) {
        if (history[i].role === 'client' && history[i + 1].role === 'manager') {
            const stage = state?.stage ?? 'value_questions';
            steps.push({
                order: steps.length + 1,
                customerMessage: history[i].text,
                stepGoal: STAGE_TO_GOAL[stage] ?? 'Качество коммуникации с клиентом',
                scoringFocus: DEFAULT_SCORING_FOCUS,
                answer: history[i + 1].text,
            });
        }
    }
    if (steps.length === 0) {
        await db_1.prisma.attempt.update({
            where: { id: attemptId },
            data: {
                status: 'completed',
                finishedAt: new Date(),
                evaluationError: 'Недостаточно реплик для оценки',
            },
        });
        await ctx.reply('Недостаточно реплик для оценки. Результаты сохранены.');
        return;
    }
    try {
        const result = await (0, evaluator_1.evaluateAttempt)({ attemptId, steps });
        await db_1.prisma.attempt.update({
            where: { id: attemptId },
            data: {
                status: 'completed',
                finishedAt: new Date(),
                totalScore: result.total_score,
                level: result.level,
                strengthsJson: JSON.stringify(result.overall.strengths),
                weaknessesJson: JSON.stringify(result.overall.weaknesses),
                recommendationsJson: JSON.stringify(result.overall.recommendations),
                suspicionFlagsJson: JSON.stringify(result.suspicion_flags),
                evaluationResultJson: JSON.stringify(result),
            },
        });
        const summaryText = `🎯 Ваш балл: ${result.total_score.toFixed(1)}/100\n` +
            `📈 Уровень: ${result.level}\n\n` +
            `Результаты сохранены. Администратор может просмотреть детальный анализ.`;
        // Replace “Оцениваем тест...” with the final summary
        try {
            if (processingMsg && 'message_id' in processingMsg && ctx.chat) {
                await ctx.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, undefined, summaryText);
            }
            else {
                await ctx.reply(summaryText);
            }
        }
        catch {
            await ctx.reply(summaryText);
        }
    }
    catch (err) {
        console.error('Virtual customer evaluation error:', err);
        await db_1.prisma.attempt.update({
            where: { id: attemptId },
            data: {
                status: 'completed',
                finishedAt: new Date(),
                evaluationError: err instanceof Error ? err.message : String(err),
            },
        });
        await ctx.reply('Произошла ошибка при оценке диалога. Результаты сохранены. Администратор будет уведомлен.');
    }
}
async function completeAttempt(ctx, attemptId) {
    // 1) Сообщаем пользователю, что тест завершён
    await ctx.reply('✅ Тест завершен!');
    // 2) Отдельным сообщением показываем «Оцениваем тест...», его заменим на итог
    const processingMsg = await ctx.reply('⏳ Оцениваем тест...');
    const attempt = await db_1.prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            test: {
                include: {
                    steps: {
                        orderBy: { order: 'asc' },
                    },
                },
            },
            answers: {
                include: {
                    step: true,
                },
                orderBy: {
                    step: {
                        order: 'asc',
                    },
                },
            },
            user: true,
        },
    });
    if (!attempt) {
        return ctx.reply('Ошибка: попытка не найдена.');
    }
    try {
        const evaluationInput = {
            attemptId: attempt.id,
            steps: attempt.answers.map((answer) => {
                const step = attempt.test.steps.find((s) => s.id === answer.stepId);
                return {
                    order: step.order,
                    customerMessage: step.customerMessage,
                    stepGoal: step.stepGoal,
                    scoringFocus: JSON.parse(step.scoringFocusJson),
                    answer: answer.answerText,
                };
            }),
        };
        const result = await (0, evaluator_1.evaluateAttempt)(evaluationInput);
        // Save evaluation results
        for (let i = 0; i < result.steps.length; i++) {
            const stepResult = result.steps[i];
            const answer = attempt.answers[i];
            if (answer) {
                await db_1.prisma.attemptAnswer.update({
                    where: { id: answer.id },
                    data: {
                        stepScore: stepResult.step_score,
                        criteriaScoresJson: JSON.stringify(stepResult.criteria),
                        feedback: stepResult.feedback,
                        betterExample: stepResult.better_example,
                    },
                });
            }
        }
        await db_1.prisma.attempt.update({
            where: { id: attemptId },
            data: {
                status: 'completed',
                finishedAt: new Date(),
                totalScore: result.total_score,
                level: result.level,
                strengthsJson: JSON.stringify(result.overall.strengths),
                weaknessesJson: JSON.stringify(result.overall.weaknesses),
                recommendationsJson: JSON.stringify(result.overall.recommendations),
                suspicionFlagsJson: JSON.stringify(result.suspicion_flags),
            },
        });
        // Final summary text (отдельно от сообщения «Тест завершен»)
        const summaryText = `🎯 Ваш балл: ${result.total_score.toFixed(1)}/100\n` +
            `📈 Уровень: ${result.level}\n\n` +
            `Результаты сохранены. Администратор может просмотреть детальный анализ.`;
        // Replace “Оцениваем тест...” with the final summary
        try {
            if (processingMsg && 'message_id' in processingMsg && ctx.chat) {
                await ctx.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, undefined, summaryText);
            }
            else {
                await ctx.reply(summaryText);
            }
        }
        catch {
            await ctx.reply(summaryText);
        }
    }
    catch (error) {
        console.error('Evaluation error:', error);
        await ctx.reply('Произошла ошибка при оценке теста. Администратор будет уведомлен.');
    }
}
//# sourceMappingURL=test.js.map