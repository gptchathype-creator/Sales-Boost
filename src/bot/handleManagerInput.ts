import { Context } from 'telegraf';
import { prisma } from '../db';
import { loadCar } from '../data/carLoader';
import { buildDealershipFromCar, getVirtualClientReply, type Strictness } from '../llm/virtualClient';
import {
  getDefaultState,
  type DialogState,
  type Checklist,
  type DialogHealth,
  type LoopGuard,
  type StrictnessState,
} from '../state/defaultState';
import { setChatCommands } from '../commandsMenu';
import { isAdmin } from '../utils';
import type { NormalizedInput } from '../input/normalizeInput';
import { sendClientVoiceIfEnabled } from '../voice/tts';
import { parsePreferences } from '../state/userPreferences';
import { generateTrainingAssessment } from '../llm/trainingAssessment';
import { computeQualitySignal } from '../logic/qualitySignal';
import { checkManagerFacts } from '../logic/factCheck';

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

  // Save manager message with voice metadata (if any) and quality signal
  const qualitySignal = computeQualitySignal(input.text);
  await prisma.dialogMessage.create({
    data: {
      sessionId: session.id,
      role: 'manager',
      content: input.text,
      source: input.source,
      voiceFileId: input.telegramFileId ?? null,
      voiceDurationSec: input.durationSec ?? null,
      qualitySignalJson: JSON.stringify(qualitySignal),
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

  const rawState = session.stateJson ? (JSON.parse(session.stateJson) as any) : null;
  const base = getDefaultState();

  const strictnessFromState: Strictness | undefined =
    rawState?.strictnessState?.strictness && ['low', 'medium', 'high'].includes(rawState.strictnessState.strictness)
      ? rawState.strictnessState.strictness
      : rawState?.strictness && ['low', 'medium', 'high'].includes(rawState.strictness)
        ? rawState.strictness
        : undefined;

  const strictness: Strictness = strictnessFromState ?? DEFAULT_STRICTNESS;
  const max_client_turns: number =
    rawState?.strictnessState?.max_client_turns ??
    (strictness === 'low' ? 7 : strictness === 'high' ? 14 : 10);

  const state: DialogState = {
    stage: rawState?.stage ?? base.stage,
    checklist: { ...base.checklist, ...(rawState?.checklist ?? {}) },
    notes: rawState?.notes ?? base.notes,
    client_turns: rawState?.client_turns ?? base.client_turns,
    dialog_health: { ...base.dialog_health, ...(rawState?.dialog_health ?? {}) },
    topic_lifecycle: { ...base.topic_lifecycle, ...(rawState?.topic_lifecycle ?? {}) },
    loop_guard: { ...base.loop_guard, ...(rawState?.loop_guard ?? {}) },
    strictnessState: {
      strictness,
      max_client_turns,
      ...(rawState?.strictnessState ?? {}),
    } as StrictnessState,
    fact_context: { ...base.fact_context, ...(rawState?.fact_context ?? {}) },
  };

  const allMessages = await prisma.dialogMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  });
  const history = allMessages.map((m) => ({
    role: m.role as 'client' | 'manager',
    content: m.content,
  }));

  const safeState: DialogState = state;

  // === Update dialog health based on quality signal ===
  const updatedHealth: DialogHealth = { ...state.dialog_health };
  const updatedLoop: LoopGuard = { ...state.loop_guard };

  if (qualitySignal.profanity) {
    updatedHealth.irritation = Math.min(100, updatedHealth.irritation + 30);
    updatedHealth.patience = Math.max(0, updatedHealth.patience - 30);
    updatedHealth.trust = Math.max(0, updatedHealth.trust - 30);
    updatedLoop.unanswered_question_streak += 1;
  } else if (qualitySignal.very_short || qualitySignal.nonsense) {
    updatedHealth.irritation = Math.min(100, updatedHealth.irritation + 15);
    updatedHealth.patience = Math.max(0, updatedHealth.patience - 10);
    updatedHealth.trust = Math.max(0, updatedHealth.trust - 10);
    updatedLoop.unanswered_question_streak += 1;
  } else {
    // Более-менее нормальный ответ — сбрасываем стрик
    updatedLoop.unanswered_question_streak = 0;
  }

  // Сохраняем обновлённое состояние перед любыми решениями
  state.dialog_health = updatedHealth;
  state.loop_guard = updatedLoop;

  // === Ранняя остановка при грубой речи ===
  const prefs = parsePreferences(user.preferencesJson);
  const promptMsg = '✍️ Напишите, что бы вы ответили клиенту.';

  if (qualitySignal.profanity) {
    await prisma.trainingSession.update({
      where: { id: session.id },
      data: {
        status: 'failed',
        failureReason: 'rude_language',
        completedAt: new Date(),
        stateJson: JSON.stringify({
          ...state,
          strictness: strictness,
          strictnessState: state.strictnessState,
        }),
      },
    });
    const finalMsg =
      'Наверное, на этом закончим. Для меня важна вежливая коммуникация, а сейчас это не так. Спасибо за время.';
    if (prefs.replyMode === 'text') {
      await ctx.reply(finalMsg);
    } else {
      await sendClientVoiceIfEnabled(ctx, finalMsg, { voice: prefs.ttsVoice });
    }
    await ctx.reply('❌ Тренировка завершена из‑за недопустимой лексики.');

    // Сформировать краткий разбор для менеджера даже при досрочном завершении
    try {
      const allMessages = await prisma.dialogMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
      });
      const dialogHistory = allMessages.map((m) => ({
        role: m.role as 'client' | 'manager',
        content: m.content,
      }));
      const assessment = await generateTrainingAssessment({
        dialogHistory,
        userName: user.fullName,
      });
      // Для таких случаев оценку жёстко ограничиваем низким значением
      const clampedScore = Math.min(20, Math.max(0, assessment.data.score || 0));
      await prisma.trainingSession.update({
        where: { id: session.id },
        data: {
          assessmentScore: clampedScore,
          assessmentJson: JSON.stringify(assessment.data),
        },
      });
      await ctx.reply(
        `📊 Краткий разбор (тренировка завершена системой из‑за лексики):\n\n${assessment.formattedText}`
      );
    } catch (e) {
      console.error(
        '[training] Assessment failed for rude_language session:',
        e instanceof Error ? e.message : e
      );
    }

    const chatId = ctx.chat?.id;
    if (chatId && ctx.chat?.type === 'private') {
      setChatCommands(chatId, { trainingActive: false, isAdmin: isAdmin(ctx) }).catch(() => {});
    }
    return;
  }

  // === Fact check: противоречия с car.json по году/цене/пробегу ===
  const factResult = checkManagerFacts(input.text, car);
  if (factResult.hasConflict) {
    let fieldLabel = 'данные';
    if (factResult.field === 'year') fieldLabel = 'год выпуска';
    if (factResult.field === 'price_rub') fieldLabel = 'цена';
    if (factResult.field === 'mileage_km') fieldLabel = 'пробег';

    const adv = factResult.advertisedValue;
    const claimed = factResult.claimedValue;
    const clientText =
      adv && claimed
        ? `Странно, в объявлении указан ${fieldLabel} ${adv}, а вы говорите ${claimed}. Уточните, пожалуйста, почему так?`
        : 'Странно, в объявлении были другие данные. Уточните, пожалуйста, почему сейчас по-другому?';

    const nextClientTurns = (state.client_turns ?? 0) + 1;
    const newStateForFact = {
      ...state,
      client_turns: nextClientTurns,
      notes: `${state.notes || ''}\nintent:fact_check;`.trim(),
      strictness,
      strictnessState: state.strictnessState,
    };

    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { stateJson: JSON.stringify(newStateForFact) },
    });

    await prisma.dialogMessage.create({
      data: {
        sessionId: session.id,
        role: 'client',
        content: clientText,
        source: 'text',
      },
    });

    if (prefs.replyMode === 'text') {
      await ctx.reply(clientText);
      await ctx.reply(promptMsg);
    } else {
      await sendClientVoiceIfEnabled(ctx, clientText, { voice: prefs.ttsVoice });
      await ctx.reply(promptMsg);
    }
    return;
  }

  // === Проверка на "провал" коммуникации по терпению/раздражению и игнору вопросов ===
  const shouldFailByHealth =
    (updatedHealth.patience < 20 && updatedHealth.irritation > 60) ||
    updatedLoop.unanswered_question_streak >= 2;

  if (shouldFailByHealth) {
    const failureReason =
      updatedLoop.unanswered_question_streak >= 2 ? 'ignored_questions' : 'poor_communication';

    await prisma.trainingSession.update({
      where: { id: session.id },
      data: {
        status: 'failed',
        failureReason,
        completedAt: new Date(),
        stateJson: JSON.stringify({
          ...state,
          strictness,
          strictnessState: state.strictnessState,
        }),
      },
    });

    const finalMsg =
      'Пожалуй, давайте на этом остановимся. У меня осталось ощущение, что мы друг друга плохо понимаем.';
    if (prefs.replyMode === 'text') {
      await ctx.reply(finalMsg);
    } else {
      await sendClientVoiceIfEnabled(ctx, finalMsg, { voice: prefs.ttsVoice });
    }

    const reasonText =
      failureReason === 'ignored_questions'
        ? 'система зафиксировала, что вопросы клиента несколько раз подряд игнорировались.'
        : 'система зафиксировала низкое качество коммуникации (терпение клиента на нуле, высокий уровень раздражения).';
    await ctx.reply(
      `❌ Тренировка завершена досрочно: ${reasonText}\nПопробуйте пройти её ещё раз позже.`
    );

    // Краткий разбор при досрочном завершении по качеству общения
    try {
      const allMessages = await prisma.dialogMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
      });
      const dialogHistory = allMessages.map((m) => ({
        role: m.role as 'client' | 'manager',
        content: m.content,
      }));
      const assessment = await generateTrainingAssessment({
        dialogHistory,
        userName: user.fullName,
      });
      const clampedScore = Math.min(40, Math.max(0, assessment.data.score || 0));
      await prisma.trainingSession.update({
        where: { id: session.id },
        data: {
          assessmentScore: clampedScore,
          assessmentJson: JSON.stringify(assessment.data),
        },
      });
      await ctx.reply(
        `📊 Краткий разбор (тренировка завершена системой):\n\n${assessment.formattedText}`
      );
    } catch (e) {
      console.error(
        '[training] Assessment failed for failed communication session:',
        e instanceof Error ? e.message : e
      );
    }

    const chatId = ctx.chat?.id;
    if (chatId && ctx.chat?.type === 'private') {
      setChatCommands(chatId, { trainingActive: false, isAdmin: isAdmin(ctx) }).catch(() => {});
    }
    return;
  }

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

    const newState: any = {
      ...state,
      ...out.update_state,
      dialog_health: updatedHealth,
      loop_guard: updatedLoop,
      strictness,
      strictnessState: {
        strictness,
        max_client_turns,
      },
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

