import type { Context, Telegraf } from 'telegraf';
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
export declare function normalizeInput(bot: Telegraf<Context>, ctx: Context): Promise<NormalizedInput | null>;
//# sourceMappingURL=normalizeInput.d.ts.map