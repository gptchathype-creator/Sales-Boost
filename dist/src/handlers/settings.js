"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSettings = handleSettings;
exports.handleSettingsCallback = handleSettingsCallback;
const telegraf_1 = require("telegraf");
const db_1 = require("../db");
const start_1 = require("./start");
const userPreferences_1 = require("../state/userPreferences");
function buildSettingsContent(prefs) {
    const modeLabel = prefs.replyMode === 'voice' ? '🔊 Голос' : '📝 Текст';
    const voiceLabel = prefs.ttsVoice === 'male' ? '👨 Мужской' : '👩 Женский';
    return (`🔧 Настройки\n\n` +
        `Режим ответа: ${modeLabel}\n` +
        `Голос клиента: ${voiceLabel}`);
}
function buildSettingsKeyboard(prefs) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback(prefs.replyMode === 'text' ? '✓ Текст' : 'Текст', 'settings_reply_text'),
            telegraf_1.Markup.button.callback(prefs.replyMode === 'voice' ? '✓ Голос' : 'Голос', 'settings_reply_voice'),
        ],
        [
            telegraf_1.Markup.button.callback(prefs.ttsVoice === 'male' ? '✓ Мужской' : 'Мужской', 'settings_voice_male'),
            telegraf_1.Markup.button.callback(prefs.ttsVoice === 'female' ? '✓ Женский' : 'Женский', 'settings_voice_female'),
        ],
        [telegraf_1.Markup.button.callback('💾 Сохранить', 'settings_save')],
    ]);
}
async function handleSettings(ctx) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId)
        return;
    const user = await db_1.prisma.user.findUnique({ where: { telegramId } });
    if (!user || user.fullName === `User ${telegramId}`) {
        await ctx.reply('Сначала укажите имя: /start');
        return;
    }
    const prefs = (0, userPreferences_1.parsePreferences)(user.preferencesJson);
    await ctx.reply(buildSettingsContent(prefs), buildSettingsKeyboard(prefs));
}
async function handleSettingsCallback(ctx, data) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId)
        return false;
    if (data === 'settings_save') {
        if (ctx.callbackQuery?.message && 'message_id' in ctx.callbackQuery.message) {
            try {
                await ctx.telegram.editMessageText(ctx.chat?.id, ctx.callbackQuery.message.message_id, undefined, '✅ Настройки сохранены', { reply_markup: { inline_keyboard: [] } });
            }
            catch {
                await ctx.reply('✅ Настройки сохранены');
            }
        }
        else {
            await ctx.reply('✅ Настройки сохранены');
        }
        // Show main menu in a new message
        await ctx.reply('Главное меню', (0, start_1.mainMenuButtons)(ctx));
        return true;
    }
    const user = await db_1.prisma.user.findUnique({ where: { telegramId } });
    if (!user)
        return false;
    let prefs = (0, userPreferences_1.parsePreferences)(user.preferencesJson);
    let updated = false;
    switch (data) {
        case 'settings_reply_text':
            if (prefs.replyMode !== 'text') {
                prefs = { ...prefs, replyMode: 'text' };
                updated = true;
            }
            break;
        case 'settings_reply_voice':
            if (prefs.replyMode !== 'voice') {
                prefs = { ...prefs, replyMode: 'voice' };
                updated = true;
            }
            break;
        case 'settings_voice_male':
            if (prefs.ttsVoice !== 'male') {
                prefs = { ...prefs, ttsVoice: 'male' };
                updated = true;
            }
            break;
        case 'settings_voice_female':
            if (prefs.ttsVoice !== 'female') {
                prefs = { ...prefs, ttsVoice: 'female' };
                updated = true;
            }
            break;
        default:
            return false;
    }
    if (updated) {
        await db_1.prisma.user.update({
            where: { id: user.id },
            data: { preferencesJson: (0, userPreferences_1.serializePreferences)(prefs) },
        });
    }
    // Update the message in place if this is a callback (avoid duplicate messages)
    if (ctx.callbackQuery?.message && 'message_id' in ctx.callbackQuery.message) {
        try {
            await ctx.telegram.editMessageText(ctx.chat?.id, ctx.callbackQuery.message.message_id, undefined, buildSettingsContent(prefs), buildSettingsKeyboard(prefs));
        }
        catch {
            await handleSettings(ctx);
        }
    }
    else {
        await handleSettings(ctx);
    }
    return true;
}
//# sourceMappingURL=settings.js.map