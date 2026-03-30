"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeInput = normalizeInput;
const fs_1 = __importDefault(require("fs"));
const telegramDownload_1 = require("../voice/telegramDownload");
const stt_1 = require("../voice/stt");
/**
 * Normalize incoming Telegram message into uniform text input.
 * Returns null if input should NOT be processed (e.g. STT failure).
 */
async function normalizeInput(bot, ctx) {
    const message = ctx.message;
    if (!message) {
        return null;
    }
    // Plain text
    if (typeof message.text === 'string') {
        const text = message.text.trim();
        return {
            text,
            source: 'text',
        };
    }
    // Voice message
    if (message.voice) {
        const voice = message.voice;
        const fileId = voice.file_id;
        const durationSec = typeof voice.duration === 'number' ? voice.duration : undefined;
        let filepath = null;
        try {
            filepath = await (0, telegramDownload_1.downloadTelegramVoice)(bot, fileId);
            const transcript = await (0, stt_1.transcribeVoice)(filepath);
            return {
                text: transcript ?? '',
                source: 'voice',
                telegramFileId: fileId,
                durationSec,
            };
        }
        catch (err) {
            console.error('[voice] Failed to process voice message:', err);
            await ctx.reply('Не получилось распознать голос. Попробуйте ещё раз.');
            return null;
        }
        finally {
            if (filepath) {
                fs_1.default.promises.unlink(filepath).catch(() => { });
            }
        }
    }
    // Other message types handled elsewhere
    return null;
}
//# sourceMappingURL=normalizeInput.js.map