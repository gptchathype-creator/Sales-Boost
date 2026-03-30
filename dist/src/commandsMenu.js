"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommandsMenu = initCommandsMenu;
exports.setDefaultCommands = setDefaultCommands;
exports.setChatCommands = setChatCommands;
let telegram = null;
const CMD_START = { command: 'start', description: '🏠 Главное меню' };
const CMD_START_TRAINING = { command: 'start_training', description: '🚀 Начать тренировку' };
const CMD_STOP_TRAINING = { command: 'stop_training', description: '⏹ Остановить тренировку' };
const CMD_SETTINGS = { command: 'settings', description: '🔧 Настройки' };
const CMD_ADMIN = { command: 'admin', description: '🔐 Админ' };
function initCommandsMenu(tg) {
    telegram = tg;
}
/**
 * Default commands for the bot (no /menu, no /stop_training, no /admin).
 * Used at startup; per-chat scope set on /start adds admin for admins.
 */
async function setDefaultCommands() {
    if (!telegram)
        return;
    await telegram.setMyCommands([CMD_START, CMD_START_TRAINING, CMD_SETTINGS]);
}
/**
 * Set commands for a specific chat (overrides default for that chat).
 * During training: only Stop training (no Start, Settings, Admin).
 * When not training: show Start, Start training, Settings, Admin.
 */
async function setChatCommands(chatId, options) {
    if (!telegram)
        return;
    const commands = [CMD_START];
    if (options.trainingActive) {
        commands.push(CMD_STOP_TRAINING);
        // No Start training, Settings, or Admin during training
    }
    else {
        commands.push(CMD_START_TRAINING);
        commands.push(CMD_SETTINGS);
        if (options.isAdmin) {
            commands.push(CMD_ADMIN);
        }
    }
    await telegram.setMyCommands(commands, {
        scope: { type: 'chat', chat_id: chatId },
    });
}
//# sourceMappingURL=commandsMenu.js.map