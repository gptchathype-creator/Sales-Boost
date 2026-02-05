import { Context } from 'telegraf';
import { prisma } from '../db';
import { loadCar } from '../data/carLoader';
import { buildDealershipFromCar, getVirtualClientReply, type Strictness } from '../llm/virtualClient';
import { getDefaultState, type DialogState, type Checklist } from '../state/defaultState';
import { setChatCommands } from '../commandsMenu';
import { isAdmin } from '../utils';
import type { NormalizedInput } from '../input/normalizeInput';
import { sendClientVoiceIfEnabled } from '../voice/tts';
import { parsePreferences } from '../state/userPreferences';
import { generateTrainingAssessment } from '../llm/trainingAssessment';

const DIALOG_HISTORY_LIMIT = 12;
const MSG_GENERATING = '⏳ Подготовка сообщения...';
const DEFAULT_STRICTNESS: Strictness = 'medium';

/**
 * Unified handler for manager input (text or voice) during training dialog.
 */
export async function handleManagerInput(ctx: Context, input: NormalizedInput): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    await ctx.reply('Ошибка: не удалось определить ваш ID.');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { telegramId },
  });

  if (!user) {
    await ctx.reply('У вас нет назначенной тренировки.');
    return;
  }

  const session = await prisma.trainingSession.findFirst({
    where: { userId: user.id, status: 'in_progress' },
  });

  if (!session) {
    await ctx.reply('У вас нет назначенной тренировки.');
    return;
  }

  // Save manager message with voice metadata (if any)
  await prisma.dialogMessage.create({
    data: {
      sessionId: session.id,
      role: 'manager',
      content: input.text,
      source: input.source,
      voiceFileId: input.telegramFileId ?? null,
      voiceDurationSec: input.durationSec ?? null,
    },
  });

  let car;
  try {
    car = loadCar();
  } catch (e) {
    console.error('loadCar error:', e);
    await ctx.reply('Ошибка загрузки данных. Тренировка прервана.');
    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    const chatId = ctx.chat?.id;
    if (chatId && ctx.chat?.type === 'private') {
      setChatCommands(chatId, { trainingActive: false, isAdmin: isAdmin(ctx) }).catch(() => {});
    }
    return;
  }

  const parsedState = session.stateJson
    ? (JSON.parse(session.stateJson) as {
        stage: string;
        checklist: Record<string, string>;
        notes: string;
        client_turns: number;
        strictness?: Strictness;
      })
    : null;

  const state = parsedState ?? getDefaultState();
  const strictness: Strictness =
    parsedState?.strictness && ['low', 'medium', 'high'].includes(parsedState.strictness)
      ? parsedState.strictness
      : DEFAULT_STRICTNESS;

  const allMessages = await prisma.dialogMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  });
  const history = allMessages.map((m) => ({
    role: m.role as 'client' | 'manager',
    content: m.content,
  }));

  const safeState: DialogState = {
    stage: (state as any).stage,
    checklist: ((state as any).checklist || {}) as Checklist,
    notes: (state as any).notes ?? '',
    client_turns: (state as any).client_turns ?? 0,
  };

  try {
    const statusMsg = await ctx.reply(MSG_GENERATING);
    await ctx.sendChatAction('typing');
    let out: Awaited<ReturnType<typeof getVirtualClientReply>>;
    try {
      out = await getVirtualClientReply({
        car,
        dealership: buildDealershipFromCar(car),
        state: safeState,
        manager_last_message: input.text,
        dialog_history: history.slice(-DIALOG_HISTORY_LIMIT),
        strictness,
      });
    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      console.error('[training] Virtual client first attempt failed:', msg);
      await new Promise((r) => setTimeout(r, 1500));
      out = await getVirtualClientReply({
        car,
        dealership: buildDealershipFromCar(car),
        state: safeState,
        manager_last_message: input.text,
        dialog_history: history.slice(-DIALOG_HISTORY_LIMIT),
        strictness,
      });
    }

    const newState = { ...out.update_state, strictness };
    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { stateJson: JSON.stringify(newState) },
    });

    await prisma.dialogMessage.create({
      data: {
        sessionId: session.id,
        role: 'client',
        content: out.client_message,
        source: 'text',
      },
    });

    try {
      await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id);
    } catch (_) {}

    const prefs = parsePreferences(user.preferencesJson);
    const promptMsg = '✍️ Напишите, что бы вы ответили клиенту.';

    if (out.end_conversation) {
      await prisma.trainingSession.update({
        where: { id: session.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      const chatId = ctx.chat?.id;
      if (chatId && ctx.chat?.type === 'private') {
        setChatCommands(chatId, { trainingActive: false, isAdmin: isAdmin(ctx) }).catch(() => {});
      }
      if (prefs.replyMode === 'text') {
        await ctx.reply(out.client_message);
      } else if (out.client_message.trim()) {
        await sendClientVoiceIfEnabled(ctx, out.client_message, { voice: prefs.ttsVoice });
      }
      await ctx.reply('✅ Тренировка завершена!');
      const allMessages = await prisma.dialogMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
      });
      const dialogHistory = allMessages.map((m) => ({
        role: m.role as 'client' | 'manager',
        content: m.content,
      }));
      let formattedText = 'Оценка не сформирована.';
      try {
        const result = await generateTrainingAssessment({
          dialogHistory,
          userName: user.fullName,
        });
        formattedText = result.formattedText;
        await prisma.trainingSession.update({
          where: { id: session.id },
          data: {
            assessmentScore: result.data.score,
            assessmentJson: JSON.stringify(result.data),
          },
        });
      } catch (e) {
        console.error('[training] Assessment failed:', e instanceof Error ? e.message : e);
      }
      await ctx.reply(`📊 Ваша оценка:\n\n${formattedText}`);
      return;
    }

    if (prefs.replyMode === 'text') {
      await ctx.reply(out.client_message);
      await ctx.reply(promptMsg);
    } else if (out.client_message.trim()) {
      await sendClientVoiceIfEnabled(ctx, out.client_message, { voice: prefs.ttsVoice });
      await ctx.reply(promptMsg);
    } else {
      await ctx.reply(promptMsg);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : '';
    console.error('[training] Virtual client turn error:', msg, stack ? stack.slice(0, 500) : '');
    const userMsg =
      msg.includes('регион') || msg.includes('region') || msg.includes('HTTPS_PROXY')
        ? msg
        : msg.includes('баланс') || msg.includes('quota') || msg.includes('insufficient_quota')
          ? 'Закончился баланс OpenAI. Пополните счёт: https://platform.openai.com/account/billing'
          : msg.includes('API ключ') || msg.includes('invalid_api_key')
            ? 'Неверный OpenAI API ключ. Проверьте OPENAI_API_KEY в .env'
            : 'Ошибка при ответе клиента. Тренировка прервана. Попробуйте /start_training снова.';
    await ctx.reply(userMsg);
    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    const chatId = ctx.chat?.id;
    if (chatId && ctx.chat?.type === 'private') {
      setChatCommands(chatId, { trainingActive: false, isAdmin: isAdmin(ctx) }).catch(() => {});
    }
  }
}

