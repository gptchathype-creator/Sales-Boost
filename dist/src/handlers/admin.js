"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAdmin = handleAdmin;
exports.handleAdminLatest = handleAdminLatest;
exports.handleAdminByManager = handleAdminByManager;
exports.handleAdminManagerDetail = handleAdminManagerDetail;
exports.handleAdminSummary = handleAdminSummary;
exports.handleDeleteMe = handleDeleteMe;
exports.handleCheckAdmin = handleCheckAdmin;
const db_1 = require("../db");
const utils_1 = require("../utils");
const telegraf_1 = require("telegraf");
const ITEMS_PER_PAGE = 5;
const config_1 = require("../config");
const tunnel_1 = require("../tunnel");
async function handleAdmin(ctx) {
    try {
        if (!(0, utils_1.isAdmin)(ctx)) {
            return ctx.reply('Нет доступа');
        }
        // Use tunnel URL (live) or config (MINI_APP_URL / tunnel callback)
        const url = ((0, tunnel_1.getTunnelUrl)() || config_1.config.miniAppUrl || '').trim().replace(/\/+$/, '') || '';
        const isHttps = url.startsWith('https://') && !url.includes('localhost') && !url.includes('127.0.0.1');
        if (!url) {
            await ctx.reply('Сервер не запущен. Запустите бота (npm run dev) и попробуйте /admin снова.');
            return;
        }
        // Telegram requires HTTPS for Web App — show button only with valid HTTPS
        if (isHttps) {
            await ctx.reply('🔐 Админ-панель\n\nНажмите кнопку — панель откроется внутри Telegram.\n\n' +
                'Если видите ошибку 530 — закройте окно, напишите /admin и нажмите кнопку снова.', telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.webApp('Открыть Админ-панель', url)]]));
            return;
        }
        // Localhost or tunnel still starting — no button (Telegram rejects HTTP)
        await ctx.reply('⏳ Туннель загружается…\n\n' +
            'Подождите 30–60 сек (в терминале появится [TUNNEL] https://…), затем нажмите /admin снова.\n\n' +
            'Админ-панель в Telegram работает только по HTTPS.');
    }
    catch (err) {
        console.error('[admin] Error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.reply('Ошибка: ' + msg.slice(0, 200)).catch(() => { });
    }
}
async function handleAdminLatest(ctx, page = 0) {
    if (!(0, utils_1.isAdmin)(ctx)) {
        return ctx.reply('❌ Нет доступа');
    }
    const attempts = await db_1.prisma.attempt.findMany({
        where: { status: 'completed' },
        include: {
            user: true,
            test: true,
            answers: {
                include: {
                    step: true,
                },
            },
        },
        orderBy: { finishedAt: 'desc' },
        take: ITEMS_PER_PAGE,
        skip: page * ITEMS_PER_PAGE,
    });
    if (attempts.length === 0) {
        return ctx.reply('Нет завершенных попыток.');
    }
    for (const attempt of attempts) {
        const summary = (0, utils_1.formatAttemptSummary)(attempt);
        const breakdown = (0, utils_1.formatStepBreakdown)(attempt.answers);
        await ctx.reply(summary + breakdown, {
            parse_mode: 'HTML',
        });
    }
    const totalCount = await db_1.prisma.attempt.count({
        where: { status: 'completed' },
    });
    const hasNext = (page + 1) * ITEMS_PER_PAGE < totalCount;
    const hasPrev = page > 0;
    if (hasNext || hasPrev) {
        const buttons = [];
        if (hasPrev) {
            buttons.push(telegraf_1.Markup.button.callback('◀️ Назад', `admin_latest_${page - 1}`));
        }
        if (hasNext) {
            buttons.push(telegraf_1.Markup.button.callback('Вперед ▶️', `admin_latest_${page + 1}`));
        }
        await ctx.reply('Навигация:', telegraf_1.Markup.inlineKeyboard([buttons]));
    }
}
async function handleAdminByManager(ctx, page = 0) {
    if (!(0, utils_1.isAdmin)(ctx)) {
        return ctx.reply('❌ Нет доступа');
    }
    const users = await db_1.prisma.user.findMany({
        where: { role: 'manager' },
        include: {
            attempts: {
                where: { status: 'completed' },
                orderBy: { finishedAt: 'desc' },
                take: 1,
            },
        },
        orderBy: { fullName: 'asc' },
        take: ITEMS_PER_PAGE,
        skip: page * ITEMS_PER_PAGE,
    });
    if (users.length === 0) {
        return ctx.reply('Нет менеджеров.');
    }
    const buttons = users.map((user) => [
        telegraf_1.Markup.button.callback(`${user.fullName} (${user.attempts.length} попыток)`, `admin_manager_${user.id}`),
    ]);
    const totalCount = await db_1.prisma.user.count({
        where: { role: 'manager' },
    });
    const hasNext = (page + 1) * ITEMS_PER_PAGE < totalCount;
    const hasPrev = page > 0;
    if (hasPrev) {
        buttons.push([telegraf_1.Markup.button.callback('◀️ Назад', `admin_by_manager_${page - 1}`)]);
    }
    if (hasNext) {
        buttons.push([telegraf_1.Markup.button.callback('Вперед ▶️', `admin_by_manager_${page + 1}`)]);
    }
    buttons.push([telegraf_1.Markup.button.callback('🔙 Назад в меню', 'admin_menu')]);
    await ctx.reply('Выберите менеджера:', telegraf_1.Markup.inlineKeyboard(buttons));
}
async function handleAdminManagerDetail(ctx, userId) {
    if (!(0, utils_1.isAdmin)(ctx)) {
        return ctx.reply('❌ Нет доступа');
    }
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        include: {
            attempts: {
                where: { status: 'completed' },
                include: {
                    test: true,
                    answers: {
                        include: {
                            step: true,
                        },
                    },
                },
                orderBy: { finishedAt: 'desc' },
            },
        },
    });
    if (!user) {
        return ctx.reply('Менеджер не найден.');
    }
    if (user.attempts.length === 0) {
        return ctx.reply(`У ${user.fullName} нет завершенных попыток.`);
    }
    await ctx.reply(`📊 Попытки менеджера: ${user.fullName}\n`);
    for (const attempt of user.attempts) {
        const summary = (0, utils_1.formatAttemptSummary)(attempt);
        const breakdown = (0, utils_1.formatStepBreakdown)(attempt.answers);
        await ctx.reply(summary + breakdown);
    }
    await ctx.reply('🔙', telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🔙 Назад к списку', 'admin_by_manager_0')],
        [telegraf_1.Markup.button.callback('🏠 Главное меню', 'admin_menu')],
    ]));
}
async function handleAdminSummary(ctx) {
    if (!(0, utils_1.isAdmin)(ctx)) {
        return ctx.reply('❌ Нет доступа');
    }
    const attempts = await db_1.prisma.attempt.findMany({
        where: { status: 'completed', totalScore: { not: null } },
        include: {
            user: true,
        },
    });
    if (attempts.length === 0) {
        return ctx.reply('Нет данных для сводки.');
    }
    const totalScore = attempts.reduce((sum, a) => sum + (a.totalScore || 0), 0);
    const avgScore = totalScore / attempts.length;
    const levelCounts = {
        Junior: 0,
        Middle: 0,
        Senior: 0,
    };
    const allWeaknesses = {};
    attempts.forEach((attempt) => {
        if (attempt.level) {
            levelCounts[attempt.level]++;
        }
        if (attempt.weaknessesJson) {
            const weaknesses = JSON.parse(attempt.weaknessesJson);
            weaknesses.forEach((w) => {
                allWeaknesses[w] = (allWeaknesses[w] || 0) + 1;
            });
        }
    });
    const topWeaknesses = Object.entries(allWeaknesses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([weakness, count]) => `${weakness} (${count})`)
        .join('\n• ');
    let text = `📊 Сводка по команде\n\n`;
    text += `Всего попыток: ${attempts.length}\n`;
    text += `Средний балл: ${avgScore.toFixed(1)}/100\n\n`;
    text += `Распределение по уровням:\n`;
    text += `• Junior: ${levelCounts.Junior}\n`;
    text += `• Middle: ${levelCounts.Middle}\n`;
    text += `• Senior: ${levelCounts.Senior}\n\n`;
    if (topWeaknesses) {
        text += `Топ слабых сторон:\n• ${topWeaknesses}`;
    }
    await ctx.reply(text, telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🔙 Назад', 'admin_menu')],
    ]));
}
async function handleDeleteMe(ctx) {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
        return ctx.reply('Ошибка: не удалось определить ваш ID.');
    }
    const user = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    if (!user) {
        return ctx.reply('Пользователь не найден.');
    }
    if (user.role === 'admin' || (0, utils_1.isAdmin)(ctx)) {
        return ctx.reply('Администраторы не могут удалить свой профиль через эту команду.');
    }
    // Delete user (cascades to attempts and answers)
    await db_1.prisma.user.delete({
        where: { id: user.id },
    });
    await ctx.reply('✅ Ваш профиль и все данные удалены.');
}
// Command to check admin status
async function handleCheckAdmin(ctx) {
    const telegramId = ctx.from?.id.toString();
    const username = ctx.from?.username;
    if (!telegramId) {
        return ctx.reply('Ошибка: не удалось определить ваш ID.');
    }
    const isUserAdmin = (0, utils_1.isAdmin)(ctx);
    const user = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    let message = `📋 Информация о вашем аккаунте:\n\n`;
    message += `🆔 ID: ${telegramId}\n`;
    if (username) {
        message += `👤 Username: @${username}\n`;
    }
    message += `📝 Имя: ${user?.fullName || 'Не указано'}\n`;
    message += `🔐 Роль в БД: ${user?.role || 'Не зарегистрирован'}\n`;
    message += `✅ Админ по whitelist: ${isUserAdmin ? 'Да' : 'Нет'}\n\n`;
    if (isUserAdmin) {
        message += `🎉 Вы имеете права администратора! Используйте /admin для доступа к панели.`;
    }
    else {
        message += `💡 Чтобы стать админом, добавьте ваш ID (${telegramId}) или username${username ? ` (@${username})` : ''} в переменную ADMIN_TELEGRAM_IDS в файле .env`;
    }
    await ctx.reply(message);
}
//# sourceMappingURL=admin.js.map