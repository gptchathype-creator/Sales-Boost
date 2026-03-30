"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerManagerMessageHandlers = registerManagerMessageHandlers;
const normalizeInput_1 = require("../input/normalizeInput");
const handleManagerInput_1 = require("./handleManagerInput");
/**
 * Register unified handlers for manager text + voice input.
 */
function registerManagerMessageHandlers(bot) {
    // Text + voice messages during training
    bot.on(['text', 'voice'], async (ctx) => {
        // Do not interfere with registration scene
        if (ctx.scene?.current?.id === 'registration') {
            return;
        }
        const message = ctx.message;
        // Ignore commands like /start, /admin, etc.
        if (message && typeof message.text === 'string' && message.text.startsWith('/')) {
            return;
        }
        const normalized = await (0, normalizeInput_1.normalizeInput)(bot, ctx);
        if (!normalized) {
            // For text, normalizeInput never returns null; for voice it returns null only on STT error
            // and already sent a technical error message.
            return;
        }
        await (0, handleManagerInput_1.handleManagerInput)(ctx, normalized);
    });
    // Any other message types: gently explain allowed inputs
    bot.on('message', async (ctx) => {
        const message = ctx.message;
        if (!message)
            return;
        if (message.text || message.voice) {
            // Already handled above
            return;
        }
        if (ctx.scene?.current?.id === 'registration') {
            return;
        }
        await ctx.reply('Можно отвечать текстом или голосовым сообщением.');
    });
}
//# sourceMappingURL=index.js.map