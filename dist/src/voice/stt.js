"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeVoice = transcribeVoice;
const fs_1 = __importDefault(require("fs"));
const openaiClient_1 = require("../lib/openaiClient");
/**
 * Transcribe a local audio file (Telegram voice) to text using OpenAI STT.
 */
async function transcribeVoice(filepath) {
    const fileStream = fs_1.default.createReadStream(filepath);
    const result = await openaiClient_1.openai.audio.transcriptions.create({
        file: fileStream,
        model: 'gpt-4o-mini-transcribe',
        language: 'ru',
    });
    const text = result.text ?? '';
    return typeof text === 'string' ? text.trim() : '';
}
//# sourceMappingURL=stt.js.map