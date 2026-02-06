import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { prisma } from '../db';
import { mainMenuButtons } from './start';
import { loadCar } from '../data/carLoader';
import { getVirtualClientReply, buildDealershipFromCar, type Strictness } from '../llm/virtualClient';
import { getDefaultState } from '../state/defaultState';
import { setChatCommands } from '../commandsMenu';
import { isAdmin } from '../utils';
import { sendClientVoiceIfEnabled } from '../voice/tts';
import { parsePreferences } from '../state/userPreferences';

const MSG_TRAINING_STARTED = '✅ Тренировка началась!';
const MSG_GENERATING = '⏳ Подготовка сообщения...';

const DEFAULT_STRICTNESS: Strictness = 'medium';

export async function handleStopTraining(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return;

  const session = await prisma.trainingSession.findFirst({
    where: { userId: user.id, status: 'in_progress' },
  });

  if (!session) {
    await ctx.reply('Нет активной тренировки.', mainMenuButtons(ctx));
    return;
  }

  await prisma.trainingSession.update({
    where: { id: session.id },
    data: { status: 'cancelled', completedAt: new Date() },
  });
  const chatId = ctx.chat?.id;
  if (chatId && ctx.chat?.type === 'private') {
    setChatCommands(chatId, { trainingActive: false, isAdmin: isAdmin(ctx) }).catch((e) =>
      console.error('setChatCommands on stop:', e)
    );
  }
  const keyboard = mainMenuButtons(ctx);
  await ctx.reply('Тренировка остановлена. Результат не сохраняется.', keyboard);
}

export async function showTrainingMenu(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user || user.fullName === `User ${telegramId}`) {
    await ctx.reply('Сначала укажите имя: /start');
    return;
  }

  const inProgress = await prisma.trainingSession.findFirst({
    where: { userId: user.id, status: 'in_progress' },
  });

  if (inProgress) {
    await ctx.reply(
      'Меню:',
      Markup.inlineKeyboard([[Markup.button.callback('⏹ Остановить тренировку', 'stop_training')]])
    );
  } else {
    await ctx.reply('Меню:', mainMenuButtons(ctx));
  }
}

export function showStrictnessChoice(ctx: Context): void {
  ctx.reply(
    'Выберите уровень строгости диалога:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🟢 Низкая (быстро, по делу)', 'start_training_low')],
      [Markup.button.callback('🟡 Средняя', 'start_training_medium')],
      [Markup.button.callback('🔴 Высокая (внимательный клиент)', 'start_training_high')],
      [Markup.button.callback('← Главное меню', 'main_menu')],
    ])
  );
}

export async function handleStartTraining(ctx: Context, strictness: Strictness = DEFAULT_STRICTNESS): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    await ctx.reply('Ошибка: не удалось определить ваш ID.');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { telegramId },
  });

  if (!user || user.fullName === `User ${telegramId}`) {
    await ctx.reply('Сначала укажите ваше имя: отправьте /start');
    return;
  }

  const existing = await prisma.trainingSession.findFirst({
    where: { userId: user.id, status: 'in_progress' },
  });

  if (existing) {
    await ctx.reply('У вас уже есть активная тренировка. Отвечайте на сообщения клиента в чате.');
    return;
  }

  let car;
  try {
    car = loadCar();
  } catch (e) {
    console.error('loadCar error:', e);
    await ctx.reply('Ошибка загрузки данных авто. Обратитесь к администратору.');
    return;
  }

  const state = getDefaultState();
  // Применяем strictness к расширенному состоянию
  const max_client_turns =
    strictness === 'low' ? 7 : strictness === 'high' ? 14 : 10;
  const stateWithStrictness = {
    ...state,
    strictnessState: {
      strictness,
      max_client_turns,
    },
    // Для обратной совместимости: сохраняем plain strictness тоже
    strictness,
  } as any;
  const dealership = buildDealershipFromCar(car);

  const session = await prisma.trainingSession.create({
    data: {
      userId: user.id,
      status: 'in_progress',
      stateJson: JSON.stringify(stateWithStrictness),
    },
  });

  const fallbackFirstMessage = `Здравствуйте! Я увидел объявление о ${car.title}. Он ещё доступен для покупки?`;

  try {
    await ctx.reply(MSG_TRAINING_STARTED);
    const statusMsg = await ctx.reply(MSG_GENERATING);
    await ctx.sendChatAction('typing');
    let out: Awaited<ReturnType<typeof getVirtualClientReply>>;
    try {
      out = await getVirtualClientReply({
        car,
        dealership,
        state,
        manager_last_message: '',
        dialog_history: [],
        strictness,
      });
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      console.error('[training] First client message failed:', msg);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        out = await getVirtualClientReply({
          car,
          dealership,
          state: stateWithStrictness,
          manager_last_message: '',
          dialog_history: [],
          strictness,
        });
      } catch (retryErr) {
        console.error('[training] Retry failed, using fallback first message:', retryErr instanceof Error ? retryErr.message : retryErr);
        out = {
          client_message: fallbackFirstMessage,
          end_conversation: false,
          reason: '',
          update_state: {
            stage: stateWithStrictness.stage,
            checklist: stateWithStrictness.checklist as Record<
              string,
              'unknown' | 'done' | 'missed'
            >,
            notes: stateWithStrictness.notes ?? '',
            client_turns: 1,
          },
        };
      }
    }
    const newState: any = {
      ...stateWithStrictness,
      ...out.update_state,
      strictnessState: {
        strictness,
        max_client_turns,
      },
      strictness,
    };
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
    if (prefs.replyMode === 'text') {
      await ctx.reply(out.client_message);
      await ctx.reply(promptMsg);
    } else if (out.client_message.trim()) {
      await sendClientVoiceIfEnabled(ctx, out.client_message, { voice: prefs.ttsVoice });
      await ctx.reply(promptMsg);
    } else {
      await ctx.reply(promptMsg);
    }
    const chatId = ctx.chat?.id;
    if (chatId && ctx.chat?.type === 'private') {
      setChatCommands(chatId, { trainingActive: true, isAdmin: isAdmin(ctx) }).catch((err) =>
        console.error('setChatCommands on start training:', err)
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[training] Start dialog error:', msg, e instanceof Error ? e.stack?.slice(0, 400) : '');
    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    const chatId = ctx.chat?.id;
    if (chatId && ctx.chat?.type === 'private') {
      setChatCommands(chatId, { trainingActive: false, isAdmin: isAdmin(ctx) }).catch(() => {});
    }
    const userMsg =
      msg.includes('регион') || msg.includes('region') || msg.includes('HTTPS_PROXY')
        ? msg
        : msg.includes('баланс') || msg.includes('quota') || msg.includes('insufficient_quota')
          ? 'Закончился баланс OpenAI. Пополните счёт: https://platform.openai.com/account/billing'
          : msg.includes('API ключ') || msg.includes('invalid_api_key')
            ? 'Неверный OpenAI API ключ. Проверьте OPENAI_API_KEY в .env'
            : 'Не удалось начать диалог с клиентом. Попробуйте позже или напишите /start_training снова.';
    await ctx.reply(userMsg);
  }
}
