/**
 * Bot command menu (icon next to input). Sets commands with emojis.
 * /menu is not in the list. /stop_training is shown only when training is active (set per-chat).
 */
import type { Telegram } from 'telegraf';
export declare function initCommandsMenu(tg: Telegram): void;
/**
 * Default commands for the bot (no /menu, no /stop_training, no /admin).
 * Used at startup; per-chat scope set on /start adds admin for admins.
 */
export declare function setDefaultCommands(): Promise<void>;
/**
 * Set commands for a specific chat (overrides default for that chat).
 * During training: only Stop training (no Start, Settings, Admin).
 * When not training: show Start, Start training, Settings, Admin.
 */
export declare function setChatCommands(chatId: number, options: {
    trainingActive: boolean;
    isAdmin: boolean;
}): Promise<void>;
//# sourceMappingURL=commandsMenu.d.ts.map