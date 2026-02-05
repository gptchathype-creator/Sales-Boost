import { PrismaClient } from '@prisma/client';
import { evaluateAttempt } from '../src/evaluator';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Different answer templates for different skill levels
const answerTemplates = {
  // Excellent answers (Senior level)
  excellent: [
    'Здравствуйте! Спасибо за ваш интерес к нашим автомобилям. У нас действительно широкий выбор моделей. Чтобы подобрать именно то, что вам нужно, расскажите, пожалуйста, какой тип автомобиля вас интересует? Может быть, вы ищете седан, внедорожник или что-то другое?',
    'Понимаю ваши опасения по поводу цены. Давайте обсудим варианты. У нас есть несколько моделей в разных ценовых категориях. Также мы можем рассмотреть варианты рассрочки или обмен вашего текущего автомобиля. Какая сумма для вас комфортна?',
    'Отличный вопрос! Мы ценим, что вы сравниваете предложения. Наша цена включает не только сам автомобиль, но и полный пакет услуг: гарантийное обслуживание, помощь с оформлением документов, и наша команда всегда готова помочь после покупки. Это дополнительная ценность, которую мы предоставляем.',
    'Понимаю, что это важное решение. Давайте я помогу вам принять его. Мы можем организовать тест-драйв, чтобы вы могли почувствовать автомобиль. Также у нас сейчас действует специальное предложение, которое заканчивается в конце недели. Может быть, запланируем встречу?',
    'Отличный вопрос о гарантии! Мы предоставляем расширенную гарантию на 3 года или 100 000 км. Кроме того, у нас есть собственный сервисный центр, где вы всегда можете получить помощь. Наша команда поддержки работает даже после покупки. Это дает вам уверенность и спокойствие.',
    'Отлично, что вы готовы двигаться дальше! Процесс очень простой. Нам понадобятся: паспорт, водительское удостоверение и документы на обмен, если планируете. Мы поможем оформить все документы прямо здесь. Можем записаться на удобное для вас время?',
    'Конечно! Давайте подберем удобное время. У нас есть слоты на этой неделе: завтра в 14:00, послезавтра в 16:00 или в пятницу в любое время. Что вам больше подходит? Я забронирую для вас тест-драйв и подготовлю все необходимое.',
  ],
  
  // Good answers (Middle level)
  good: [
    'Здравствуйте! У нас есть разные модели автомобилей. Что именно вас интересует?',
    'Цена зависит от модели. Можем обсудить варианты, которые подходят вашему бюджету. Есть модели подешевле.',
    'Мы предлагаем хорошее качество и сервис. У нас есть гарантия и сервисное обслуживание. Это важно при покупке.',
    'Понимаю, что нужно подумать. Можем организовать тест-драйв, если интересно. Это поможет принять решение.',
    'У нас есть гарантия на автомобили. Также есть сервисный центр для обслуживания. Все будет в порядке.',
    'Для покупки нужны паспорт и права. Мы поможем с оформлением документов. Можем обсудить детали.',
    'Да, можем записаться. Когда вам удобно? Могу предложить несколько вариантов времени.',
  ],
  
  // Poor answers (Junior level)
  poor: [
    'У нас есть машины.',
    'Цена нормальная.',
    'У конкурентов хуже.',
    'Подумайте и решите.',
    'Гарантия есть.',
    'Нужны документы.',
    'Можем записаться.',
  ],
  
  // Very poor answers (Junior level, low score)
  veryPoor: [
    'Машины есть.',
    'Дорого, но что делать.',
    'Не знаю, почему дороже.',
    'Как хотите.',
    'Гарантия стандартная.',
    'Документы нужны.',
    'Да, можно.',
  ],
};

async function generateMockData() {
  console.log('🎭 Генерация тестовых данных...\n');

  // Get active test
  const test = await prisma.test.findFirst({
    where: { isActive: true },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!test) {
    console.error('❌ Активный тест не найден. Сначала запустите seed.');
    await prisma.$disconnect();
    return;
  }

  // Create test users with different skill levels
  const mockUsers = [
    { name: 'TEST_Алексей Петров', answers: answerTemplates.excellent },
    { name: 'TEST_Мария Иванова', answers: answerTemplates.excellent },
    { name: 'TEST_Дмитрий Сидоров', answers: answerTemplates.good },
    { name: 'TEST_Анна Козлова', answers: answerTemplates.good },
    { name: 'TEST_Сергей Волков', answers: answerTemplates.good },
    { name: 'TEST_Елена Новикова', answers: answerTemplates.poor },
    { name: 'TEST_Игорь Морозов', answers: answerTemplates.poor },
    { name: 'TEST_Ольга Лебедева', answers: answerTemplates.veryPoor },
  ];

  let createdCount = 0;
  let errorCount = 0;

  for (let i = 0; i < mockUsers.length; i++) {
    const mockUser = mockUsers[i];
    console.log(`[${i + 1}/${mockUsers.length}] Создание попытки для ${mockUser.name}...`);

    try {
      // Create or get user
      const telegramId = `TEST_${Date.now()}_${i}`;
      let user = await prisma.user.findFirst({
        where: { fullName: mockUser.name },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            telegramId,
            fullName: mockUser.name,
            role: 'manager',
          },
        });
      }

      // Create attempt
      const attempt = await prisma.attempt.create({
        data: {
          userId: user.id,
          testId: test.id,
          status: 'in_progress',
          currentStep: 1,
        },
      });

      // Create answers
      const answers = [];
      for (let j = 0; j < test.steps.length; j++) {
        const step = test.steps[j];
        const answerText = mockUser.answers[j] || mockUser.answers[mockUser.answers.length - 1];

        const answer = await prisma.attemptAnswer.create({
          data: {
            attemptId: attempt.id,
            stepId: step.id,
            answerText,
          },
        });

        answers.push({
          order: step.order,
          customerMessage: step.customerMessage,
          stepGoal: step.stepGoal,
          scoringFocus: JSON.parse(step.scoringFocusJson),
          answer: answerText,
        });
      }

      // Evaluate attempt
      console.log(`  ⏳ Оценка попытки...`);
      const result = await evaluateAttempt({
        attemptId: attempt.id,
        steps: answers,
      });

      // Update answers with evaluation results
      for (let j = 0; j < result.steps.length; j++) {
        const stepResult = result.steps[j];
        const answer = await prisma.attemptAnswer.findFirst({
          where: {
            attemptId: attempt.id,
            stepId: test.steps[j].id,
          },
        });

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

      // Update attempt with summary
      await prisma.attempt.update({
        where: { id: attempt.id },
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

      console.log(`  ✅ Создано (балл: ${result.total_score.toFixed(1)}, уровень: ${result.level})`);
      createdCount++;

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`  ❌ Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error && error.stack) {
        console.error(`     ${error.stack.split('\n')[0]}`);
      }
      errorCount++;
    }
  }

  console.log(`\n✅ Генерация завершена!`);
  console.log(`   Создано: ${createdCount}`);
  console.log(`   Ошибок: ${errorCount}`);
  console.log(`\n💡 Для удаления тестовых данных выполните: npm run delete-mock`);

  await prisma.$disconnect();
}

generateMockData().catch(console.error);
