import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function deleteMockData() {
  console.log('🗑️  Удаление тестовых данных...\n');

  try {
    // Find all test users
    const testUsers = await prisma.user.findMany({
      where: {
        fullName: {
          startsWith: 'TEST_',
        },
      },
      include: {
        attempts: true,
      },
    });

    console.log(`Найдено тестовых пользователей: ${testUsers.length}`);

    if (testUsers.length === 0) {
      console.log('✅ Тестовых данных не найдено.');
      await prisma.$disconnect();
      return;
    }

    // Delete users (cascades to attempts and answers)
    let deletedUsers = 0;
    let deletedAttempts = 0;

    for (const user of testUsers) {
      deletedAttempts += user.attempts.length;
      await prisma.user.delete({
        where: { id: user.id },
      });
      deletedUsers++;
      console.log(`  ✅ Удален пользователь: ${user.fullName} (попыток: ${user.attempts.length})`);
    }

    console.log(`\n✅ Удаление завершено!`);
    console.log(`   Удалено пользователей: ${deletedUsers}`);
    console.log(`   Удалено попыток: ${deletedAttempts}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Ошибка при удалении:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deleteMockData().catch(console.error);
