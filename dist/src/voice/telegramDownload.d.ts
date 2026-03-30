import type { Telegraf, Context } from 'telegraf';
/**
 * Download Telegram voice file to ./tmp and return local filepath.
 */
export declare function downloadTelegramVoice(bot: Telegraf<Context>, fileId: string): Promise<string>;
//# sourceMappingURL=telegramDownload.d.ts.map