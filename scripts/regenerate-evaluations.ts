import { PrismaClient } from '@prisma/client';
import { evaluateAttempt } from '../src/evaluator';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const STAGE_TO_GOAL: Record<string, string> = {
  opening: 'Установить контакт, представиться, выяснить запрос',
  car_interest: 'Уточнить интерес к конкретному авто, представить выгоды',
  value_questions: 'Раскрыть ценность предложения, ответить на вопросы',
  objections: 'Отработать возражения, сохранить доверие',
  visit_scheduling: 'Записать на визит, согласовать дату/время',
  logistics: 'Объяснить адрес и как добраться',
  wrap_up: 'Подтвердить следующие шаги и контакт',
};

const DEFAULT_SCORING_FOCUS = ['STRUCTURE', 'EMPATHY_TONE', 'NEEDS_DISCOVERY', 'OBJECTION_HANDLING', 'NEXT_STEP_CTA'];

async function regenerateAllEvaluations() {
  console.log('🔄 Начинаю перегенерацию всех оценок...\n');

  // Get all completed attempts (include those with missing scores/details)
  const attempts = await prisma.attempt.findMany({
    where: {
      status: 'completed',
    },
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

  console.log(`Найдено ${attempts.length} завершенных попыток.\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    console.log(`[${i + 1}/${attempts.length}] Попытка #${attempt.id} (${attempt.user.fullName})...`);

    try {
      let evaluationSteps: Array<{
        order: number;
        customerMessage: string;
        stepGoal: string;
        scoringFocus: string[];
        answer: string;
      }>;

      // Virtual customer attempts: build steps from conversation history
      if (attempt.conversationHistoryJson && (!attempt.answers || attempt.answers.length === 0)) {
        const history: Array<{ role: string; text: string }> = JSON.parse(attempt.conversationHistoryJson);
        const state = attempt.virtualCustomerStateJson
          ? JSON.parse(attempt.virtualCustomerStateJson) as { stage?: string }
          : null;
        const stage = state?.stage ?? 'value_questions';

        evaluationSteps = [];
        for (let j = 0; j + 1 < history.length; j += 2) {
          if (history[j].role === 'client' && history[j + 1].role === 'manager') {
            evaluationSteps.push({
              order: evaluationSteps.length + 1,
              customerMessage: history[j].text,
              stepGoal: STAGE_TO_GOAL[stage] ?? 'Качество коммуникации с клиентом',
              scoringFocus: DEFAULT_SCORING_FOCUS,
              answer: history[j + 1].text,
            });
          }
        }

        if (evaluationSteps.length === 0) {
          console.log(`  ⚠️ Пропущено: недостаточно реплик в диалоге`);
          skippedCount++;
          continue;
        }

        console.log(`  📝 Виртуальный клиент: ${evaluationSteps.length} шагов`);
      }
      // Traditional attempts: use answers
      else if (attempt.answers && attempt.answers.length > 0) {
        evaluationSteps = attempt.answers.map(answer => {
          const scoringFocus = answer.step.scoringFocusJson
            ? JSON.parse(answer.step.scoringFocusJson)
            : [];
          return {
            order: answer.step.order,
            customerMessage: answer.step.customerMessage,
            stepGoal: answer.step.stepGoal,
            scoringFocus,
            answer: answer.answerText,
          };
        });
      } else {
        console.log(`  ⚠️ Пропущено: нет данных для оценки`);
        skippedCount++;
        continue;
      }

      // Re-evaluate
      const result = await evaluateAttempt({
        attemptId: attempt.id,
        steps: evaluationSteps,
      });

      // For traditional attempts: update attempt answers
      if (attempt.answers && attempt.answers.length > 0) {
        for (let j = 0; j < result.steps.length; j++) {
          const stepResult = result.steps[j];
          const answer = attempt.answers[j];
          if (answer) {
            await prisma.attemptAnswer.update({
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
      }

      // Update attempt summary (both types)
      await prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          totalScore: result.total_score,
          level: result.level,
          strengthsJson: JSON.stringify(result.overall.strengths),
          weaknessesJson: JSON.stringify(result.overall.weaknesses),
          recommendationsJson: JSON.stringify(result.overall.recommendations),
          suspicionFlagsJson: JSON.stringify(result.suspicion_flags),
          evaluationResultJson: JSON.stringify(result),
          evaluationError: null, // Clear any previous error
        },
      });

      console.log(`  ✅ Балл: ${result.total_score.toFixed(1)}, уровень: ${result.level}`);
      successCount++;

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error && error.stack) {
        console.error(`     ${error.stack.split('\n')[1]?.trim() || ''}`);
      }
      errorCount++;
    }
  }

  console.log(`\n✅ Перегенерация завершена!`);
  console.log(`   Успешно: ${successCount}`);
  console.log(`   Пропущено: ${skippedCount}`);
  console.log(`   Ошибок: ${errorCount}`);

  await prisma.$disconnect();
}

regenerateAllEvaluations().catch(console.error);
