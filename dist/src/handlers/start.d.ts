import { Context } from 'telegraf';
import { Markup } from 'telegraf';
/** Main menu: Start training, Settings, Admin — all vertical, one per row. */
export declare function mainMenuButtons(ctx: Context): Markup.Markup<import("@telegraf/types").InlineKeyboardMarkup>;
export declare function showMainMenu(ctx: Context): Promise<void>;
/** Shows main menu. When edit=true and ctx has callbackQuery, edits the message. When simple=true, shows only "Главное меню" + 3 buttons. */
export declare function showMainMenuContent(ctx: Context, options?: {
    edit?: boolean;
    simple?: boolean;
}): Promise<void>;
export declare function handleStart(ctx: Context): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
export declare function handleNameInput(ctx: Context, name: string): Promise<import("@telegraf/types").Message.TextMessage | undefined>;
//# sourceMappingURL=start.d.ts.map