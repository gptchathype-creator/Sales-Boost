import { Context } from 'telegraf';
import { prisma } from '../db';
import { loadCar } from '../data/carLoader';
import { buildDealershipFromCar, getVirtualClientReply, type Strictness } from '../llm/virtualClient';
import {
  mergeStateFromJson,
  type DialogState,
  type DialogHealth,
  type LoopGuard,
} from '../state/defaultState';
import { setChatCommands } from '../commandsMenu';
import { isAdmin } from '../utils';
import type { NormalizedInput } from '../input/normalizeInput';
import { sendClientVoiceIfEnabled } from '../voice/tts';
import { parsePreferences } from '../state/userPreferences';
import { evaluateSessionV2, evaluationToLegacyAssessment } from '../llm/evaluatorV2';
import { checkManagerFacts } from '../logic/factCheck';
import {
  advanceTopic,
  recordEvasion,
  checkCriticalEvasions,
  type TopicCode,
} from '../logic/topicStateMachine';
import type { ClientProfile } from '../logic/clientProfile';
import { classifyBehavior, type BehaviorSignal } from '../logic/behaviorClassifier';

const DIALOG_HISTORY_LIMIT = 12;
const MSG_GENERATING = '⏳ Подготовка сообщения...';
const DEFAULT_STRICTNESS: Strictness = 'medium';

export async function handleManagerInput(ctx: Context, input: NormalizedInput): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    await ctx.reply('Ошибка: не удалось определить ваш ID.');
    return;
  }

  const user = await prisma.user.findUnique({ where: { telegramId } });
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

  // ── Load car ──
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
    await resetChatCommands(ctx);
    return;
  }

  // ── Restore state ──
  const rawState = session.stateJson ? (JSON.parse(session.stateJson) as any) : {};
  const profileFromSession =
    (session as any).clientProfile ?? rawState?.client_profile ?? rawState?.clientProfile ?? 'normal';
  const state: DialogState = mergeStateFromJson(rawState, profileFromSession as ClientProfile);

  const strictnessFromState: Strictness | undefined =
    state.strictnessState?.strictness &&
    ['low', 'medium', 'high'].includes(state.strictnessState.strictness)
      ? state.strictnessState.strictness
      : undefined;
  const strictness: Strictness = strictnessFromState ?? DEFAULT_STRICTNESS;
  const max_client_turns = state.strictnessState?.max_client_turns ?? 10;

  // ── Determine if client is waiting for an answer ──
  const lastClientMsg = await prisma.dialogMessage.findFirst({
    where: { sessionId: session.id, role: 'client' },
    orderBy: { createdAt: 'desc' },
  });
  const isClientWaiting = lastClientMsg != null;

  // ══════════════════════════════════════════════════════════════
  // BEHAVIOR CLASSIFIER — single source of truth for this turn
  // ══════════════════════════════════════════════════════════════
  const behavior: BehaviorSignal = classifyBehavior(input.text, {
    lastClientQuestion: lastClientMsg?.content ?? undefined,
    isClientWaitingAnswer: isClientWaiting,
  });

  // ── Save manager message WITH behavior meta ──
  await prisma.dialogMessage.create({
    data: {
      sessionId: session.id,
      role: 'manager',
      content: input.text,
      source: input.source,
      voiceFileId: input.telegramFileId ?? null,
      voiceDurationSec: input.durationSec ?? null,
      qualitySignalJson: JSON.stringify(behavior),
    },
  });

  // ── Update dialog health from behavior ──
  const health: DialogHealth = { ...state.dialog_health };
  const loop: LoopGuard = { ...state.loop_guard };
  const comm = { ...state.communication };

  if (behavior.toxic) {
    health.irritation = Math.min(100, health.irritation + 40);
    health.patience = Math.max(0, health.patience - 40);
    health.trust = Math.max(0, health.trust - 40);
    loop.unanswered_question_streak += 1;
    comm.profanity_detected = true;
  } else if (behavior.low_effort) {
    health.irritation = Math.min(100, health.irritation + 15);
    health.patience = Math.max(0, health.patience - 12);
    health.trust = Math.max(0, health.trust - 8);
    loop.unanswered_question_streak += 1;
  } else if (behavior.evasion) {
    health.irritation = Math.min(100, health.irritation + 10);
    health.patience = Math.max(0, health.patience - 8);
    loop.unanswered_question_streak += 1;
  } else {
    loop.unanswered_question_streak = 0;
  }

  if (behavior.prohibited_phrase_hits.length > 0) {
    comm.prohibited_phrases = [
      ...comm.prohibited_phrases,
      ...behavior.prohibited_phrase_hits,
    ];
  }

  // Low effort streak tracking
  let lowEffort = state.low_effort_streak;
  if (behavior.low_effort) {
    lowEffort++;
  } else {
    lowEffort = 0;
  }

  state.dialog_health = health;
  state.loop_guard = loop;
  state.communication = comm;
  state.low_effort_streak = lowEffort;

  const prefs = parsePreferences(user.preferencesJson);
  const promptMsg = '✍️ Напишите, что бы вы ответили клиенту.';

  // ══════════════════════════════════════════════════════════════
  // ESCALATION LADDER
  // ══════════════════════════════════════════════════════════════

  // Level 1: TOXIC → immediate FAIL (customer replies once, firmly, then ends)
  if (behavior.toxic) {
    const toxicReply = behavior.severity === 'HIGH'
      ? 'Извините, но я не готов продолжать разговор в таком тоне. Всего доброго.'
      : 'Мне бы хотелось более уважительного общения. На этом, пожалуй, закончим.';

    // Save firm client reply
    await prisma.dialogMessage.create({
      data: { sessionId: session.id, role: 'client', content: toxicReply, source: 'text' },
    });

    const reasonCode = behavior.rationale.includes('profanity') ? 'PROFANITY' : 'BAD_TONE';
    await failSession(ctx, session.id, state, reasonCode, strictness, car, user, toxicReply);
    return;
  }

  // Level 2: LOW_EFFORT escalation (2 in a row → warning turn, 3 → FAIL)
  if (lowEffort >= 3) {
    const failReply = 'Я задаю конкретные вопросы и хотел бы получать развёрнутые ответы. Видимо, сейчас не лучшее время. До свидания.';
    await prisma.dialogMessage.create({
      data: { sessionId: session.id, role: 'client', content: failReply, source: 'text' },
    });
    await failSession(ctx, session.id, state, 'REPEATED_LOW_EFFORT', strictness, car, user, failReply);
    return;
  }

  // ── Fact check ──
  const factResult = checkManagerFacts(input.text, car);
  if (factResult.hasConflict) {
    state.fact_context.misinformation_detected = true;
    let fieldLabel = 'данные';
    if (factResult.field === 'year') fieldLabel = 'год выпуска';
    if (factResult.field === 'price_rub') fieldLabel = 'цена';
    if (factResult.field === 'mileage_km') fieldLabel = 'пробег';

    const adv = factResult.advertisedValue;
    const claimed = factResult.claimedValue;
    const clientText =
      adv && claimed
        ? `Подождите, в объявлении указан ${fieldLabel} ${adv}, а вы говорите ${claimed}. Это как?`
        : 'Стоп, в объявлении были другие данные. Объясните расхождение.';

    state.client_turns = (state.client_turns ?? 0) + 1;
    await saveState(session.id, state);
    await prisma.dialogMessage.create({
      data: { sessionId: session.id, role: 'client', content: clientText, source: 'text' },
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

  // Level 3: Health-based fail (patience exhausted + irritation high, or unanswered streak)
  const shouldFailByHealth =
    (health.patience < 15 && health.irritation > 65) ||
    loop.unanswered_question_streak >= 3;
  if (shouldFailByHealth) {
    const reason =
      loop.unanswered_question_streak >= 3 ? 'IGNORED_QUESTIONS' : 'POOR_COMMUNICATION';
    const healthReply = reason === 'IGNORED_QUESTIONS'
      ? 'Я уже несколько раз задал вопрос и не получил ответа. Видимо, вам неинтересно. Всего доброго.'
      : 'У меня сложилось впечатление, что вам не до меня. Не буду больше отнимать время.';
    await prisma.dialogMessage.create({
      data: { sessionId: session.id, role: 'client', content: healthReply, source: 'text' },
    });
    await failSession(ctx, session.id, state, reason, strictness, car, user, healthReply);
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // GET LLM REPLY (with behavior context injected)
  // ══════════════════════════════════════════════════════════════
  const allMessages = await prisma.dialogMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  });
  const history = allMessages.map((m) => ({
    role: m.role as 'client' | 'manager',
    content: m.content,
  }));

  try {
    const statusMsg = await ctx.reply(MSG_GENERATING);
    await ctx.sendChatAction('typing');

    let out: Awaited<ReturnType<typeof getVirtualClientReply>>;
    try {
      out = await getVirtualClientReply({
        car,
        dealership: buildDealershipFromCar(car),
        state,
        manager_last_message: input.text,
        dialog_history: history.slice(-DIALOG_HISTORY_LIMIT),
        strictness,
        max_client_turns,
        behaviorSignal: behavior,
      });
    } catch (apiErr) {
      console.error('[training] Virtual client first attempt failed:', apiErr instanceof Error ? apiErr.message : apiErr);
      await new Promise((r) => setTimeout(r, 1500));
      out = await getVirtualClientReply({
        car,
        dealership: buildDealershipFromCar(car),
        state,
        manager_last_message: input.text,
        dialog_history: history.slice(-DIALOG_HISTORY_LIMIT),
        strictness,
        max_client_turns,
        behaviorSignal: behavior,
      });
    }

    // ── Apply diagnostic signals to state ──
    const diag = out.diagnostics;
    state.phase = diag.current_phase;

    let topicMap = { ...state.topics };
    for (const code of diag.topics_addressed as TopicCode[]) {
      if (topicMap[code]) {
        const currentStatus = topicMap[code].status;
        const next = currentStatus === 'none' ? 'asked' : currentStatus === 'asked' ? 'answered' : currentStatus;
        const result = advanceTopic(topicMap, code, next as any);
        if (result.valid) topicMap = result.map;
      }
    }
    for (const code of diag.topics_evaded as TopicCode[]) {
      if (topicMap[code]) {
        topicMap = recordEvasion(topicMap, code);
      }
    }
    state.topics = topicMap;

    // Critical evasion check
    const evasionCheck = checkCriticalEvasions(topicMap);
    if (evasionCheck.shouldFail) {
      state.client_turns = out.update_state.client_turns;
      await saveState(session.id, state);
      await prisma.dialogMessage.create({
        data: { sessionId: session.id, role: 'client', content: out.client_message, source: 'text' },
      });
      try { await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id); } catch {}
      const evasionReply = `Я дважды спросил про ${evasionCheck.failedTopic === 'needs' ? 'мои потребности' : evasionCheck.failedTopic === 'intro' ? 'ваше имя' : evasionCheck.failedTopic === 'car_identification' ? 'какой именно автомобиль' : 'важный вопрос'} и не получил ответа. Пожалуй, обращусь в другой салон.`;
      await prisma.dialogMessage.create({
        data: { sessionId: session.id, role: 'client', content: evasionReply, source: 'text' },
      });
      await failSession(
        ctx, session.id, state,
        `CRITICAL_EVASION:${evasionCheck.failedTopic}`,
        strictness, car, user, evasionReply
      );
      return;
    }

    // Update phase checks
    if (diag.phase_checks_update && typeof diag.phase_checks_update === 'object') {
      const pc = state.phase_checks;
      const upd = diag.phase_checks_update as Record<string, boolean>;
      if (upd.introduced) pc.first_contact.introduced = true;
      if (upd.named_salon) pc.first_contact.named_salon = true;
      if (upd.clarified_car) pc.first_contact.clarified_car = true;
      if (upd.took_initiative) pc.first_contact.took_initiative = true;
      if (upd.asked_clarifying_questions) pc.needs_discovery.asked_clarifying_questions = true;
      if (upd.jumped_to_specs) pc.needs_discovery.jumped_to_specs = true;
      if (upd.structured_presentation) pc.product_presentation.structured = true;
      if (upd.connected_to_needs) pc.product_presentation.connected_to_needs = true;
      if (upd.shut_down_client) pc.money_and_objections.shut_down_client = true;
      if (upd.eco_handled) pc.money_and_objections.eco_handled = true;
      if (upd.proposed_next_step) pc.closing_attempt.proposed_next_step = true;
      if (upd.suggested_visit) pc.closing_attempt.suggested_visit = true;
      if (upd.fixed_date_time) pc.closing_attempt.fixed_date_time = true;
      if (upd.suggested_follow_up) pc.closing_attempt.suggested_follow_up = true;
    }

    // Update communication from LLM + behavior
    comm.tone = diag.manager_tone;
    comm.engagement = diag.manager_engagement;
    if (diag.misinformation_detected) state.fact_context.misinformation_detected = true;
    state.communication = comm;

    // Merge legacy state
    state.stage = out.update_state.stage as any;
    state.notes = out.update_state.notes;
    state.client_turns = out.update_state.client_turns;
    if (out.update_state.checklist) {
      state.checklist = { ...state.checklist, ...out.update_state.checklist } as any;
    }

    await saveState(session.id, state);

    await prisma.dialogMessage.create({
      data: { sessionId: session.id, role: 'client', content: out.client_message, source: 'text' },
    });

    try { await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id); } catch {}

    if (out.end_conversation) {
      await prisma.trainingSession.update({
        where: { id: session.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      await resetChatCommands(ctx);

      if (prefs.replyMode === 'text') {
        await ctx.reply(out.client_message);
      } else if (out.client_message.trim()) {
        await sendClientVoiceIfEnabled(ctx, out.client_message, { voice: prefs.ttsVoice });
      }
      await ctx.reply('✅ Тренировка завершена!');
      await runEvaluationAndSend(ctx, session.id, state, car, user, false);
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
    console.error('[training] Virtual client turn error:', msg, e instanceof Error ? e.stack?.slice(0, 500) : '');
    const userMsg =
      msg.includes('регион') || msg.includes('region') || msg.includes('HTTPS_PROXY')
        ? msg
        : msg.includes('баланс') || msg.includes('quota')
          ? 'Закончился баланс OpenAI. Пополните счёт: https://platform.openai.com/account/billing'
          : msg.includes('API ключ') || msg.includes('invalid_api_key')
            ? 'Неверный OpenAI API ключ. Проверьте OPENAI_API_KEY в .env'
            : 'Ошибка при ответе клиента. Тренировка прервана. Попробуйте /start_training снова.';
    await ctx.reply(userMsg);
    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    await resetChatCommands(ctx);
  }
}

// ── Helpers ──

async function saveState(sessionId: number, state: DialogState): Promise<void> {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { stateJson: JSON.stringify(state) },
  });
}

async function resetChatCommands(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId && ctx.chat?.type === 'private') {
    setChatCommands(chatId, { trainingActive: false, isAdmin: isAdmin(ctx) }).catch(() => {});
  }
}

async function failSession(
  ctx: Context,
  sessionId: number,
  state: DialogState,
  failureReason: string,
  _strictness: Strictness,
  car: ReturnType<typeof loadCar>,
  user: { id: number; fullName: string; preferencesJson: string | null },
  clientFinalMessage?: string
): Promise<void> {
  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      status: 'failed',
      failureReason,
      completedAt: new Date(),
      stateJson: JSON.stringify(state),
    },
  });

  const prefs = parsePreferences(user.preferencesJson);

  // The firm client reply was already saved to DB; now deliver to the user
  if (clientFinalMessage) {
    if (prefs.replyMode === 'text') {
      await ctx.reply(clientFinalMessage);
    } else {
      await sendClientVoiceIfEnabled(ctx, clientFinalMessage, { voice: prefs.ttsVoice });
    }
  }

  const reasonTexts: Record<string, string> = {
    PROFANITY: 'недопустимая лексика',
    BAD_TONE: 'грубый / враждебный тон',
    IGNORED_QUESTIONS: 'вопросы клиента игнорировались',
    POOR_COMMUNICATION: 'низкое качество коммуникации',
    REPEATED_LOW_EFFORT: 'повторные некачественные ответы (3 подряд)',
  };
  const baseReason = failureReason.split(':')[0];
  const reasonText = reasonTexts[baseReason]
    ?? (failureReason.startsWith('CRITICAL_EVASION')
      ? `критический вопрос проигнорирован дважды (${failureReason.split(':')[1] ?? ''})`
      : failureReason);
  await ctx.reply(`❌ Тренировка завершена досрочно: ${reasonText}.`);

  await runEvaluationAndSend(ctx, sessionId, state, car, user, true, failureReason);
  await resetChatCommands(ctx);
}

async function runEvaluationAndSend(
  ctx: Context,
  sessionId: number,
  state: DialogState,
  car: ReturnType<typeof loadCar>,
  user: { id: number; fullName: string },
  earlyFail: boolean,
  failureReason?: string
): Promise<void> {
  try {
    const allMessages = await prisma.dialogMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    const dialogHistory = allMessages.map((m) => ({
      role: m.role as 'client' | 'manager',
      content: m.content,
    }));

    // Collect behavior signals from all manager messages
    const behaviorSignals: BehaviorSignal[] = allMessages
      .filter((m) => m.role === 'manager' && m.qualitySignalJson)
      .map((m) => {
        try { return JSON.parse(m.qualitySignalJson!) as BehaviorSignal; }
        catch { return null; }
      })
      .filter((s): s is BehaviorSignal => s !== null);

    const { evaluation, formattedText } = await evaluateSessionV2({
      dialogHistory,
      car,
      state,
      earlyFail,
      failureReason,
      behaviorSignals,
    });

    const legacy = evaluationToLegacyAssessment(evaluation);
    const clampedScore = earlyFail
      ? Math.min(40, evaluation.overall_score_0_100)
      : evaluation.overall_score_0_100;

    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: {
        assessmentScore: clampedScore,
        assessmentJson: JSON.stringify(legacy),
        evaluationJson: JSON.stringify(evaluation),
        totalScore: clampedScore,
      },
    });    await ctx.reply(`📊 Ваша оценка:\n\n${formattedText}`);
  } catch (e) {
    console.error('[training] Evaluation failed:', e instanceof Error ? e.message : e);
    await ctx.reply('📊 Не удалось сформировать детальную оценку. Результаты сохранены.');
  }
}