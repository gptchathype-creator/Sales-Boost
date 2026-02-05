import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { prisma } from '../db';
import { mainMenuButtons } from './start';
import {
  parsePreferences,
  serializePreferences,
  type ReplyMode,
  type TtsVoice,
} from '../state/userPreferences';
function buildSettingsContent(prefs: ReturnType<typeof parsePreferences>) {
  const modeLabel = prefs.replyMode === 'voice' ? '🔊 Голос' : '📝 Текст';
  const voiceLabel = prefs.ttsVoice === 'male' ? '👨 Мужской' : '👩 Женский';
  return (
    `🔧 Настройки\n\n` +
    `Режим ответа: ${modeLabel}\n` +
    `Голос клиента: ${voiceLabel}`
  );
}

function buildSettingsKeyboard(prefs: ReturnType<typeof parsePreferences>) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        prefs.replyMode === 'text' ? '✓ Текст' : 'Текст',
        'settings_reply_text'
      ),
      Markup.button.callback(
        prefs.replyMode === 'voice' ? '✓ Голос' : 'Голос',
        'settings_reply_voice'
      ),
    ],
    [
      Markup.button.callback(
        prefs.ttsVoice === 'male' ? '✓ Мужской' : 'Мужской',
        'settings_voice_male'
      ),
      Markup.button.callback(
        prefs.ttsVoice === 'female' ? '✓ Женский' : 'Женский',
        'settings_voice_female'
      ),
    ],
    [Markup.button.callback('💾 Сохранить', 'settings_save')],
  ]);
}

export async function handleSettings(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user || user.fullName === `User ${telegramId}`) {
    await ctx.reply('Сначала укажите имя: /start');
    return;
  }

  const prefs = parsePreferences(user.preferencesJson);
  await ctx.reply(buildSettingsContent(prefs), buildSettingsKeyboard(prefs));
}

export async function handleSettingsCallback(ctx: Context, data: string): Promise<boolean> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return false;

  if (data === 'settings_save') {
    if (ctx.callbackQuery?.message && 'message_id' in ctx.callbackQuery.message) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat?.id,
          ctx.callbackQuery.message.message_id,
          undefined,
          '✅ Настройки сохранены',
          { reply_markup: { inline_keyboard: [] } }
        );
      } catch {
        await ctx.reply('✅ Настройки сохранены');
      }
    } else {
      await ctx.reply('✅ Настройки сохранены');
    }
    // Show main menu in a new message
    await ctx.reply('Главное меню', mainMenuButtons(ctx));
    return true;
  }

  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return false;

  let prefs = parsePreferences(user.preferencesJson);
  let updated = false;

  switch (data) {
    case 'settings_reply_text':
      if (prefs.replyMode !== 'text') {
        prefs = { ...prefs, replyMode: 'text' as ReplyMode };
        updated = true;
      }
      break;
    case 'settings_reply_voice':
      if (prefs.replyMode !== 'voice') {
        prefs = { ...prefs, replyMode: 'voice' as ReplyMode };
        updated = true;
      }
      break;
    case 'settings_voice_male':
      if (prefs.ttsVoice !== 'male') {
        prefs = { ...prefs, ttsVoice: 'male' as TtsVoice };
        updated = true;
      }
      break;
    case 'settings_voice_female':
      if (prefs.ttsVoice !== 'female') {
        prefs = { ...prefs, ttsVoice: 'female' as TtsVoice };
        updated = true;
      }
      break;
    default:
      return false;
  }

  if (updated) {
    await prisma.user.update({
      where: { id: user.id },
      data: { preferencesJson: serializePreferences(prefs) },
    });
  }

  // Update the message in place if this is a callback (avoid duplicate messages)
  if (ctx.callbackQuery?.message && 'message_id' in ctx.callbackQuery.message) {
    try {
      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        buildSettingsContent(prefs),
        buildSettingsKeyboard(prefs)
      );
    } catch {
      await handleSettings(ctx);
    }
  } else {
    await handleSettings(ctx);
  }
  return true;
}
