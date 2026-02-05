import { Context } from 'telegraf';
import { prisma } from '../db';

const ANSWER_TIMEOUT_MS = 60 * 1000; // 1 minute
const timeoutTimers = new Map<number, NodeJS.Timeout>();

export function setAnswerTimeout(attemptId: number, ctx: Context, stepNumber: number) {
  // Clear existing timeout for this attempt
  clearAnswerTimeout(attemptId);

  const timer = setTimeout(async () => {
    console.log(`Timeout reached for attempt ${attemptId}, step ${stepNumber}`);

    const attempt = await prisma.attempt.findUnique({
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
      const { completeVirtualCustomerAttempt } = await import('../handlers/test');
      await ctx.reply(
        '⏱️ Время на ответ истекло. Диалог завершён. Обрабатываю результаты...'
      );
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

    await prisma.attemptAnswer.create({
      data: {
        attemptId: attempt.id,
        stepId: step.id,
        answerText: '[Пропущено - превышено время ответа]',
      },
    });

    await ctx.reply(
      `⏱️ Время на ответ истекло. Вопрос пропущен.\n\n✅ Шаг ${currentStepNumber}/${attempt.test.steps.length} пропущен`
    );

    if (currentStepNumber >= attempt.test.steps.length) {
      const mod: any = await import('../handlers/test');
      await mod.completeAttempt(ctx, attempt.id);
      timeoutTimers.delete(attemptId);
    } else {
      await prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          currentStep: currentStepNumber + 1,
          lastStepSentAt: new Date(),
        },
      });
      const mod: any = await import('../handlers/test');
      await mod.sendStep(ctx, attempt.id, currentStepNumber + 1);
      setAnswerTimeout(attemptId, ctx, currentStepNumber + 1);
    }
  }, ANSWER_TIMEOUT_MS);

  timeoutTimers.set(attemptId, timer);
}

export function clearAnswerTimeout(attemptId: number) {
  const timer = timeoutTimers.get(attemptId);
  if (timer) {
    clearTimeout(timer);
    timeoutTimers.delete(attemptId);
  }
}
