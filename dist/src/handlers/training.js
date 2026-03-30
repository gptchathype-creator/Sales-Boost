"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStopTraining = handleStopTraining;
exports.showTrainingMenu = showTrainingMenu;
exports.showStrictnessChoice = showStrictnessChoice;
exports.showProfileChoice = showProfileChoice;
exports.handleStartTraining = handleStartTraining;
const telegraf_1 = require("telegraf");
const db_1 = require("../db");
const start_1 = require("./start");
const carLoader_1 = require("../data/carLoader");
const virtualClient_1 = require("../llm/virtualClient");
const defaultState_1 = require("../state/defaultState");
const commandsMenu_1 = require("../commandsMenu");
const utils_1 = require("../utils");
const tts_1 = require("../voice/tts");
const userPreferences_1 = require("../state/userPreferences");
const clientProfile_1 = require("../logic/clientProfile");
const MSG_TRAINING_STARTED = '✅ Тренировка началась!';
const MSG_GENERATING = '⏳ Подготовка сообщения...';
const DEFAULT_STRICTNESS = 'medium';
async function handleStopTraining(ctx) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId)
        return;
    const user = await db_1.prisma.user.findUnique({ where: { telegramId } });
    if (!user)
        return;
    const session = await db_1.prisma.trainingSession.findFirst({
        where: { userId: user.id, status: 'in_progress' },
    });
    if (!session) {
        await ctx.reply('Нет активной тренировки.', (0, start_1.mainMenuButtons)(ctx));
        return;
    }
    await db_1.prisma.trainingSession.update({
        where: { id: session.id },
        data: { status: 'cancelled', completedAt: new Date() },
    });
    const chatId = ctx.chat?.id;
    if (chatId && ctx.chat?.type === 'private') {
        (0, commandsMenu_1.setChatCommands)(chatId, { trainingActive: false, isAdmin: (0, utils_1.isAdmin)(ctx) }).catch((e) => console.error('setChatCommands on stop:', e));
    }
    const keyboard = (0, start_1.mainMenuButtons)(ctx);
    await ctx.reply('Тренировка остановлена. Результат не сохраняется.', keyboard);
}
async function showTrainingMenu(ctx) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId)
        return;
    const user = await db_1.prisma.user.findUnique({ where: { telegramId } });
    if (!user || user.fullName === `User ${telegramId}`) {
        await ctx.reply('Сначала укажите имя: /start');
        return;
    }
    const inProgress = await db_1.prisma.trainingSession.findFirst({
        where: { userId: user.id, status: 'in_progress' },
    });
    if (inProgress) {
        await ctx.reply('Меню:', telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback('⏹ Остановить тренировку', 'stop_training')]]));
    }
    else {
        await ctx.reply('Меню:', (0, start_1.mainMenuButtons)(ctx));
    }
}
function showStrictnessChoice(ctx) {
    ctx.reply('Выберите уровень строгости диалога:', telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🟢 Низкая (быстро, по делу)', 'start_training_low')],
        [telegraf_1.Markup.button.callback('🟡 Средняя', 'start_training_medium')],
        [telegraf_1.Markup.button.callback('🔴 Высокая (внимательный клиент)', 'start_training_high')],
        [telegraf_1.Markup.button.callback('← Главное меню', 'main_menu')],
    ]));
}
/**
 * Show client profile selection after strictness is chosen.
 */
function showProfileChoice(ctx, strictness) {
    ctx.reply('Выберите тип клиента:', telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('👤 Обычный', `profile_${strictness}_normal`)],
        [telegraf_1.Markup.button.callback('🔍 Дотошный', `profile_${strictness}_thorough`)],
        [telegraf_1.Markup.button.callback('💪 Жёсткий', `profile_${strictness}_pressure`)],
        [telegraf_1.Markup.button.callback('← Назад', 'training')],
    ]));
}
async function handleStartTraining(ctx, strictness = DEFAULT_STRICTNESS, profile = 'normal') {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
        await ctx.reply('Ошибка: не удалось определить ваш ID.');
        return;
    }
    const user = await db_1.prisma.user.findUnique({ where: { telegramId } });
    if (!user || user.fullName === `User ${telegramId}`) {
        await ctx.reply('Сначала укажите ваше имя: отправьте /start');
        return;
    }
    const existing = await db_1.prisma.trainingSession.findFirst({
        where: { userId: user.id, status: 'in_progress' },
    });
    if (existing) {
        await ctx.reply('У вас уже есть активная тренировка. Отвечайте на сообщения клиента в чате.');
        return;
    }
    let car;
    try {
        car = (0, carLoader_1.loadCar)();
    }
    catch (e) {
        console.error('loadCar error:', e);
        await ctx.reply('Ошибка загрузки данных авто. Обратитесь к администратору.');
        return;
    }
    // ── Build initial state with profile + strictness ──
    const profileConfig = (0, clientProfile_1.getProfileConfig)(profile);
    const max_client_turns = strictness === 'low'
        ? profileConfig.min_turns
        : strictness === 'high'
            ? profileConfig.max_turns
            : Math.round((profileConfig.min_turns + profileConfig.max_turns) / 2);
    const state = (0, defaultState_1.getDefaultState)(profile);
    state.strictnessState = { strictness, max_client_turns };
    state.dialog_health.patience = profileConfig.patience_base;
    state.dialog_health.trust = profileConfig.trust_base;
    state.objection_triggered = (0, clientProfile_1.pickRandomObjection)(profile);
    const dealership = (0, virtualClient_1.buildDealershipFromCar)(car);
    const session = await db_1.prisma.trainingSession.create({
        data: {
            userId: user.id,
            status: 'in_progress',
            stateJson: JSON.stringify(state),
            clientProfile: profile,
        },
    });
    const fallbackFirstMessage = `Здравствуйте! Я увидел объявление о ${car.title}. Он ещё доступен для покупки?`;
    try {
        const profileLabel = profile === 'normal' ? '👤 Обычный' : profile === 'thorough' ? '🔍 Дотошный' : '💪 Жёсткий';
        await ctx.reply(`${MSG_TRAINING_STARTED}\nКлиент: ${profileLabel}`);
        const statusMsg = await ctx.reply(MSG_GENERATING);
        await ctx.sendChatAction('typing');
        let out;
        try {
            out = await (0, virtualClient_1.getVirtualClientReply)({
                car,
                dealership,
                state,
                manager_last_message: '',
                dialog_history: [],
                strictness,
                max_client_turns,
            });
        }
        catch (firstErr) {
            console.error('[training] First client message failed:', firstErr instanceof Error ? firstErr.message : firstErr);
            await new Promise((r) => setTimeout(r, 2000));
            try {
                out = await (0, virtualClient_1.getVirtualClientReply)({
                    car,
                    dealership,
                    state,
                    manager_last_message: '',
                    dialog_history: [],
                    strictness,
                    max_client_turns,
                });
            }
            catch {
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
                        checklist: state.checklist,
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
        await db_1.prisma.trainingSession.update({
            where: { id: session.id },
            data: { stateJson: JSON.stringify(newState) },
        });
        await db_1.prisma.dialogMessage.create({
            data: { sessionId: session.id, role: 'client', content: out.client_message, source: 'text' },
        });
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        }
        catch { }
        const prefs = (0, userPreferences_1.parsePreferences)(user.preferencesJson);
        const promptMsg = '✍️ Напишите, что бы вы ответили клиенту.';
        if (prefs.replyMode === 'text') {
            await ctx.reply(out.client_message);
            await ctx.reply(promptMsg);
        }
        else if (out.client_message.trim()) {
            await (0, tts_1.sendClientVoiceIfEnabled)(ctx, out.client_message, { voice: prefs.ttsVoice });
            await ctx.reply(promptMsg);
        }
        else {
            await ctx.reply(promptMsg);
        }
        const chatId = ctx.chat?.id;
        if (chatId && ctx.chat?.type === 'private') {
            (0, commandsMenu_1.setChatCommands)(chatId, { trainingActive: true, isAdmin: (0, utils_1.isAdmin)(ctx) }).catch((err) => console.error('setChatCommands on start training:', err));
        }
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[training] Start dialog error:', msg, e instanceof Error ? e.stack?.slice(0, 400) : '');
        await db_1.prisma.trainingSession.update({
            where: { id: session.id },
            data: { status: 'completed', completedAt: new Date() },
        });
        const chatId = ctx.chat?.id;
        if (chatId && ctx.chat?.type === 'private') {
            (0, commandsMenu_1.setChatCommands)(chatId, { trainingActive: false, isAdmin: (0, utils_1.isAdmin)(ctx) }).catch(() => { });
        }
        const userMsg = msg.includes('регион') || msg.includes('region') || msg.includes('HTTPS_PROXY')
            ? msg
            : msg.includes('баланс') || msg.includes('quota')
                ? 'Закончился баланс OpenAI. Пополните счёт: https://platform.openai.com/account/billing'
                : msg.includes('API ключ') || msg.includes('invalid_api_key')
                    ? 'Неверный OpenAI API ключ. Проверьте OPENAI_API_KEY в .env'
                    : 'Не удалось начать диалог с клиентом. Попробуйте позже или напишите /start_training снова.';
        await ctx.reply(userMsg);
    }
}
//# sourceMappingURL=training.js.map