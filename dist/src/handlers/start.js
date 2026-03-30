"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainMenuButtons = mainMenuButtons;
exports.showMainMenu = showMainMenu;
exports.showMainMenuContent = showMainMenuContent;
exports.handleStart = handleStart;
exports.handleNameInput = handleNameInput;
const utils_1 = require("../utils");
const db_1 = require("../db");
const telegraf_1 = require("telegraf");
const MENU_HINT = 'Быстрые действия — в меню (иконка слева от поля ввода).';
function buildLandingText(fullName) {
    return (`Привет, ${fullName}!` +
        '\n\n' +
        '🚗 Sales Boost — тренажёр диалога с клиентом по продаже автомобилей.' +
        '\n\n' +
        'Он помогает:\n' +
        '• отрабатывать общение с требовательным клиентом;\n' +
        '• получать разбор ответов и рекомендации;\n' +
        '• видеть сильные стороны и точки роста в продажах.\n\n' +
        MENU_HINT +
        '\n\nВыберите, что хотите сделать:');
}
/** Main menu: Start training, Settings, Admin — all vertical, one per row. */
function mainMenuButtons(ctx) {
    const rows = [
        [telegraf_1.Markup.button.callback('🚀 Начать тренировку', 'start_training')],
        [telegraf_1.Markup.button.callback('🔧 Настройки', 'settings')],
    ];
    if ((0, utils_1.isAdmin)(ctx)) {
        rows.push([telegraf_1.Markup.button.callback('🔐 Админ', 'admin_menu')]);
    }
    return telegraf_1.Markup.inlineKeyboard(rows);
}
async function showMainMenu(ctx) {
    await ctx.reply(MENU_HINT);
}
const MAIN_MENU_SIMPLE = 'Главное меню';
/** Shows main menu. When edit=true and ctx has callbackQuery, edits the message. When simple=true, shows only "Главное меню" + 3 buttons. */
async function showMainMenuContent(ctx, options) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId)
        return;
    const user = await db_1.prisma.user.findUnique({ where: { telegramId } });
    const hasUser = user && user.fullName !== `User ${telegramId}`;
    const text = options?.simple
        ? MAIN_MENU_SIMPLE
        : hasUser
            ? buildLandingText(user.fullName)
            : '👋 Добро пожаловать! Для начала работы укажите ваше полное имя. Отправьте /start';
    const keyboard = mainMenuButtons(ctx);
    const canEdit = options?.edit && ctx.callbackQuery?.message && 'message_id' in ctx.callbackQuery.message;
    if (canEdit) {
        const msg = ctx.callbackQuery.message;
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, text, keyboard);
    }
    else {
        await ctx.reply(text, keyboard);
    }
}
async function handleStart(ctx) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
        return ctx.reply('Ошибка: не удалось определить ваш ID.');
    }
    let user = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    if (!user) {
        await ctx.reply('👋 Добро пожаловать! Для начала работы укажите ваше полное имя.');
        return;
    }
    if (user.fullName === `User ${telegramId}`) {
        await ctx.reply('👋 Добро пожаловать! Для начала работы укажите ваше полное имя.');
        return;
    }
    await ctx.reply(buildLandingText(user.fullName), mainMenuButtons(ctx));
}
async function handleNameInput(ctx, name) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
        return ctx.reply('Ошибка: не удалось определить ваш ID.');
    }
    if (name.length < 2 || name.length > 100) {
        return ctx.reply('Имя должно быть от 2 до 100 символов. Попробуйте еще раз.');
    }
    const user = await (0, utils_1.getUserOrCreate)(telegramId, name);
    // Check if user should be admin (by username or ID)
    const shouldBeAdmin = (0, utils_1.isAdmin)(ctx);
    if (shouldBeAdmin && user.role !== 'admin') {
        await db_1.prisma.user.update({
            where: { id: user.id },
            data: { role: 'admin' },
        });
    }
    if (user.fullName !== name) {
        await db_1.prisma.user.update({
            where: { id: user.id },
            data: { fullName: name },
        });
    }
    await ctx.reply(buildLandingText(name), mainMenuButtons(ctx));
}
//# sourceMappingURL=start.js.map