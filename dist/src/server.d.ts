import type { Telegraf } from 'telegraf';
/** Path for Telegram webhook (production). Call registerTelegramWebhook(bot) before startServer(). */
export declare const WEBHOOK_PATH = "/telegram-webhook";
export declare function registerTelegramWebhook(bot: Telegraf): void;
export declare function startServer(): Promise<void>;
//# sourceMappingURL=server.d.ts.map