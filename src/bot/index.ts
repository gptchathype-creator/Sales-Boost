import type { Context, Telegraf } from 'telegraf';
import { normalizeInput } from '../input/normalizeInput';
import { handleManagerInput } from './handleManagerInput';

/**
 * Register unified handlers for manager text + voice input.
 */
export function registerManagerMessageHandlers(bot: Telegraf<Context>): void {
  // Text + voice messages during training
  bot.on(['text', 'voice'], async (ctx) => {
    // Do not interfere with registration scene
    if ((ctx as any).scene?.current?.id === 'registration') {
      return;
    }

    const message: any = ctx.message;
    // Ignore commands like /start, /admin, etc.
    if (message && typeof message.text === 'string' && message.text.startsWith('/')) {
      return;
    }

    const normalized = await normalizeInput(bot, ctx);
    if (!normalized) {
      // For text, normalizeInput never returns null; for voice it returns null only on STT error
      // and already sent a technical error message.
      return;
    }

    await handleManagerInput(ctx, normalized);
  });

  // Any other message types: gently explain allowed inputs
  bot.on('message', async (ctx) => {
    const message: any = ctx.message;
    if (!message) return;

    if (message.text || message.voice) {
      // Already handled above
      return;
    }

    if ((ctx as any).scene?.current?.id === 'registration') {
      return;
    }

    await ctx.reply('Можно отвечать текстом или голосовым сообщением.');
  });
}

