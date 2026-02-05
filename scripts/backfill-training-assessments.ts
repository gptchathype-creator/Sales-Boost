/**
 * Backfill assessment for completed training sessions that don't have assessmentScore.
 * Run: npm run backfill-training
 */
import { PrismaClient } from '@prisma/client';
import { generateTrainingAssessment } from '../src/llm/trainingAssessment';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function backfill() {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      status: 'completed',
      assessmentScore: null,
    },
    include: {
      user: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  console.log(`Found ${sessions.length} completed training sessions without assessment.\n`);

  for (const session of sessions) {
    const history = session.messages.map((m) => ({
      role: m.role as 'client' | 'manager',
      content: m.content,
    }));

    if (history.length < 2) {
      console.log(`Session ${session.id}: skipped (not enough messages)`);
      continue;
    }

    try {
      const result = await generateTrainingAssessment({
        dialogHistory: history,
        userName: session.user.fullName,
      });
      await prisma.trainingSession.update({
        where: { id: session.id },
        data: {
          assessmentScore: result.data.score,
          assessmentJson: JSON.stringify(result.data),
        },
      });
      console.log(`Session ${session.id} (${session.user.fullName}): score ${result.data.score}`);
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      console.error(`Session ${session.id}: error`, e instanceof Error ? e.message : e);
    }
  }

  await prisma.$disconnect();
}

backfill().catch(console.error);
