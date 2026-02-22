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
import type { ClientProfile } from '../logic/clientProfile';
import { getProfileConfig, pickRandomObjection } from '../logic/clientProfile';

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

/**
 * Show client profile selection after strictness is chosen.
 */
export function showProfileChoice(ctx: Context, strictness: Strictness): void {
  ctx.reply(
    'Выберите тип клиента:',
    Markup.inlineKeyboard([
      [Markup.button.callback('👤 Обычный', `profile_${strictness}_normal`)],
      [Markup.button.callback('🔍 Дотошный', `profile_${strictness}_thorough`)],
      [Markup.button.callback('💪 Жёсткий', `profile_${strictness}_pressure`)],
      [Markup.button.callback('← Назад', 'training')],
    ])
  );
}

export async function handleStartTraining(
  ctx: Context,
  strictness: Strictness = DEFAULT_STRICTNESS,
  profile: ClientProfile = 'normal'
): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    await ctx.reply('Ошибка: не удалось определить ваш ID.');
    return;
  }

  const user = await prisma.user.findUnique({ where: { telegramId } });
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

  // ── Build initial state with profile + strictness ──
  const profileConfig = getProfileConfig(profile);
  const max_client_turns =
    strictness === 'low'
      ? profileConfig.min_turns
      : strictness === 'high'
        ? profileConfig.max_turns
        : Math.round((profileConfig.min_turns + profileConfig.max_turns) / 2);

  const state = getDefaultState(profile);
  state.strictnessState = { strictness, max_client_turns };
  state.dialog_health.patience = profileConfig.patience_base;
  state.dialog_health.trust = profileConfig.trust_base;
  state.objection_triggered = pickRandomObjection(profile);

  const dealership = buildDealershipFromCar(car);

  const session = await prisma.trainingSession.create({
    data: {
      userId: user.id,
      status: 'in_progress',
      stateJson: JSON.stringify(state),
      clientProfile: profile,
    },
  });

  const fallbackFirstMessage = `Здравствуйте! Я увидел объявление о ${car.title}. Он ещё доступен для покупки?`;

  try {
    const profileLabel =
      profile === 'normal' ? '👤 Обычный' : profile === 'thorough' ? '🔍 Дотошный' : '💪 Жёсткий';
    await ctx.reply(`${MSG_TRAINING_STARTED}\nКлиент: ${profileLabel}`);
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
        max_client_turns,
      });
    } catch (firstErr) {
      console.error('[training] First client message failed:', firstErr instanceof Error ? firstErr.message : firstErr);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        out = await getVirtualClientReply({
          car,
          dealership,
          state,
          manager_last_message: '',
          dialog_history: [],
          strictness,
          max_client_turns,
        });
      } catch {
        out = {
          client_message: fallbackFirstMessage,
          end_conversation: false,
          reason: '',
          diagnostics: {
            current_phase: 'first_contact',
            topics_addressed: [],
            topics_evaded: [],
            manager_tone: 'neutral',
            manager_engagement: 'active',
            misinformation_detected: false,
            phase_checks_update: {},
          },
          update_state: {
            stage: state.stage,
            checklist: state.checklist as Record<string, 'unknown' | 'done' | 'missed'>,
            notes: '',
            client_turns: 1,
          },
        };
      }
    }

    const newState = {
      ...state,
      ...{
        stage: out.update_state.stage,
        checklist: { ...state.checklist, ...out.update_state.checklist },
        notes: out.update_state.notes,
        client_turns: out.update_state.client_turns,
      },
      phase: out.diagnostics.current_phase,
    };

    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { stateJson: JSON.stringify(newState) },
    });
    await prisma.dialogMessage.create({
      data: { sessionId: session.id, role: 'client', content: out.client_message, source: 'text' },
    });

    try { await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id); } catch {}

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
        : msg.includes('баланс') || msg.includes('quota')
          ? 'Закончился баланс OpenAI. Пополните счёт: https://platform.openai.com/account/billing'
          : msg.includes('API ключ') || msg.includes('invalid_api_key')
            ? 'Неверный OpenAI API ключ. Проверьте OPENAI_API_KEY в .env'
            : 'Не удалось начать диалог с клиентом. Попробуйте позже или напишите /start_training снова.';
    await ctx.reply(userMsg);
  }
}
