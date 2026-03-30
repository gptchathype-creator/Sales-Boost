"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = isAdmin;
exports.isAdminById = isAdminById;
exports.getUserOrCreate = getUserOrCreate;
exports.validateAnswerText = validateAnswerText;
exports.getActiveTest = getActiveTest;
exports.formatAttemptSummary = formatAttemptSummary;
exports.formatStepBreakdown = formatStepBreakdown;
exports.sendCSV = sendCSV;
const db_1 = require("./db");
const config_1 = require("./config");
function isAdmin(ctx) {
    if (!ctx.from) {
        return false;
    }
    const telegramId = ctx.from.id?.toString() || '';
    const username = ctx.from.username?.toLowerCase() || '';
    const usernameWithAt = username ? `@${username}` : '';
    // Check by ID
    if (config_1.config.adminIdentifiers.includes(telegramId)) {
        return true;
    }
    // Check by username (with or without @)
    if (username && (config_1.config.adminIdentifiers.includes(username) ||
        config_1.config.adminIdentifiers.includes(usernameWithAt))) {
        return true;
    }
    return false;
}
// Legacy function for backward compatibility (when only ID is available)
function isAdminById(telegramId) {
    return config_1.config.adminIdentifiers.includes(telegramId.toLowerCase().trim());
}
async function getUserOrCreate(telegramId, fullName) {
    let user = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    if (!user) {
        // Check admin status by ID (we don't have full context here)
        const role = isAdminById(telegramId) ? 'admin' : 'manager';
        user = await db_1.prisma.user.create({
            data: {
                telegramId,
                fullName: fullName || `User ${telegramId}`,
                role,
            },
        });
    }
    // Update role if user is admin (check by ID or username if available)
    // This handles the case when admin list is updated
    if (user.role !== 'admin' && isAdminById(telegramId)) {
        await db_1.prisma.user.update({
            where: { id: user.id },
            data: { role: 'admin' },
        });
        user.role = 'admin';
    }
    return user;
}
function validateAnswerText(text) {
    if (text.length < 20) {
        return { valid: false, error: 'Ответ слишком короткий. Минимум 20 символов.' };
    }
    if (text.length > 1200) {
        return { valid: false, error: 'Ответ слишком длинный. Максимум 1200 символов.' };
    }
    return { valid: true };
}
async function getActiveTest() {
    return db_1.prisma.test.findFirst({
        where: { isActive: true },
        include: {
            steps: {
                orderBy: { order: 'asc' },
            },
        },
    });
}
function formatAttemptSummary(attempt) {
    const date = new Date(attempt.startedAt).toLocaleString('ru-RU');
    let text = `📊 Попытка от ${date}\n`;
    text += `Статус: ${attempt.status === 'completed' ? '✅ Завершена' : '⏳ В процессе'}\n`;
    if (attempt.totalScore !== null) {
        text += `\n🎯 Общий балл: ${attempt.totalScore.toFixed(1)}/100\n`;
        text += `📈 Уровень: ${attempt.level}\n`;
        if (attempt.strengthsJson) {
            const strengths = JSON.parse(attempt.strengthsJson);
            if (strengths.length > 0) {
                text += `\n✅ Сильные стороны:\n${strengths.map((s) => `• ${s}`).join('\n')}\n`;
            }
        }
        if (attempt.weaknessesJson) {
            const weaknesses = JSON.parse(attempt.weaknessesJson);
            if (weaknesses.length > 0) {
                text += `\n⚠️ Слабые стороны:\n${weaknesses.map((w) => `• ${w}`).join('\n')}\n`;
            }
        }
    }
    else if (attempt.evaluationError) {
        text += `\n❌ Ошибка оценки: ${attempt.evaluationError}\n`;
    }
    return text;
}
function formatStepBreakdown(answers) {
    let text = `\n📝 Детали по шагам:\n\n`;
    answers
        .sort((a, b) => a.step.order - b.step.order)
        .forEach((answer, idx) => {
        text += `${idx + 1}. Шаг ${answer.step.order}\n`;
        text += `   Клиент: "${answer.step.customerMessage.substring(0, 50)}..."\n`;
        text += `   Ответ: "${answer.answerText.substring(0, 50)}..."\n`;
        if (answer.stepScore !== null) {
            text += `   Балл: ${answer.stepScore.toFixed(1)}/100\n`;
            if (answer.feedback) {
                text += `   Обратная связь: ${answer.feedback.substring(0, 100)}...\n`;
            }
        }
        text += `\n`;
    });
    return text;
}
async function sendCSV(ctx) {
    const attempts = await db_1.prisma.attempt.findMany({
        where: { status: 'completed' },
        include: {
            user: true,
            test: true,
        },
        orderBy: { finishedAt: 'desc' },
    });
    if (attempts.length === 0) {
        await ctx.reply('Нет завершенных попыток для экспорта.');
        return;
    }
    const csvRows = [
        [
            'ID',
            'Менеджер',
            'Тест',
            'Дата начала',
            'Дата завершения',
            'Балл',
            'Уровень',
            'Сильные стороны',
            'Слабые стороны',
        ],
    ];
    for (const attempt of attempts) {
        const strengths = attempt.strengthsJson ? JSON.parse(attempt.strengthsJson).join('; ') : '';
        const weaknesses = attempt.weaknessesJson ? JSON.parse(attempt.weaknessesJson).join('; ') : '';
        csvRows.push([
            attempt.id.toString(),
            attempt.user.fullName,
            attempt.test.title,
            new Date(attempt.startedAt).toISOString(),
            attempt.finishedAt ? new Date(attempt.finishedAt).toISOString() : '',
            attempt.totalScore?.toFixed(1) || '',
            attempt.level || '',
            strengths,
            weaknesses,
        ]);
    }
    // Simple CSV generation (csv-stringify can be used for more complex cases)
    const csvContent = csvRows.map(row => row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        const escaped = cell.replace(/"/g, '""');
        if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
            return `"${escaped}"`;
        }
        return escaped;
    }).join(',')).join('\n');
    await ctx.replyWithDocument({
        source: Buffer.from(csvContent, 'utf-8'),
        filename: `attempts_${new Date().toISOString().split('T')[0]}.csv`,
    });
}
//# sourceMappingURL=utils.js.map