import type { Context, Telegraf } from 'telegraf';
import fs from 'fs';
import { downloadTelegramVoice } from '../voice/telegramDownload';
import { transcribeVoice } from '../voice/stt';

export type InputSource = 'text' | 'voice';

export interface NormalizedInput {
  text: string;
  source: InputSource;
  telegramFileId?: string;
  durationSec?: number;
}

/**
 * Normalize incoming Telegram message into uniform text input.
 * Returns null if input should NOT be processed (e.g. STT failure).
 */
export async function normalizeInput(
  bot: Telegraf<Context>,
  ctx: Context
): Promise<NormalizedInput | null> {
  const message: any = ctx.message;
  if (!message) {
    return null;
  }

  // Plain text
  if (typeof message.text === 'string') {
    const text = message.text.trim();
    return {
      text,
      source: 'text',
    };
  }

  // Voice message
  if (message.voice) {
    const voice = message.voice as { file_id: string; duration?: number };
    const fileId = voice.file_id;
    const durationSec = typeof voice.duration === 'number' ? voice.duration : undefined;

    let filepath: string | null = null;
    try {
      filepath = await downloadTelegramVoice(bot, fileId);
      const transcript = await transcribeVoice(filepath);

      return {
        text: transcript ?? '',
        source: 'voice',
        telegramFileId: fileId,
        durationSec,
      };
    } catch (err) {
      console.error('[voice] Failed to process voice message:', err);
      await ctx.reply('Не получилось распознать голос. Попробуйте ещё раз.');
      return null;
    } finally {
      if (filepath) {
        fs.promises.unlink(filepath).catch(() => {});
      }
    }
  }

  // Other message types handled elsewhere
  return null;
}

