"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSpeechBuffer = exports.TTS_COST_PER_1K_CHARS = void 0;
exports.isTtsEnabled = isTtsEnabled;
exports.estimateTtsCostPerSession = estimateTtsCostPerSession;
exports.generateSpeechOpenAI = generateSpeechOpenAI;
exports.sendClientVoiceIfEnabled = sendClientVoiceIfEnabled;
const https_1 = __importDefault(require("https"));
const telegraf_1 = require("telegraf");
const config_1 = require("../config");
const openaiClient_1 = require("../lib/openaiClient");
const TTS_MAX_CHARS = 360;
/** OpenAI voices: male = onyx, female = nova */
const OPENAI_VOICE_MAP = {
    male: 'onyx',
    female: 'nova',
};
function useOpenAITts() {
    return config_1.config.ttsProvider === 'openai' || !(config_1.config.elevenLabsApiKey && config_1.config.elevenLabsVoiceId);
}
function isTtsEnabled() {
    return Boolean(config_1.config.openaiApiKey) || Boolean(config_1.config.elevenLabsApiKey && config_1.config.elevenLabsVoiceId);
}
/** Cost per 1000 chars (OpenAI tts-1). ~$0.015/1k chars. */
exports.TTS_COST_PER_1K_CHARS = 0.015;
/** Estimate cost for a training session (10–14 client turns, ~300 chars each). */
function estimateTtsCostPerSession() {
    const avgTurns = 12;
    const avgCharsPerTurn = 300;
    const totalChars = avgTurns * avgCharsPerTurn;
    const cost = (totalChars / 1000) * exports.TTS_COST_PER_1K_CHARS;
    return `~$${cost.toFixed(3)} за сессию (${avgTurns} сообщений × ~${avgCharsPerTurn} симв.)`;
}
function buildTtsText(fullText) {
    if (fullText.length <= TTS_MAX_CHARS)
        return fullText;
    const slice = fullText.slice(0, TTS_MAX_CHARS);
    const lastPunct = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
    if (lastPunct > 40) {
        return slice.slice(0, lastPunct + 1);
    }
    return slice + '…';
}
async function generateSpeechElevenLabs(text) {
    if (!config_1.config.elevenLabsApiKey || !config_1.config.elevenLabsVoiceId) {
        throw new Error('ElevenLabs is not configured');
    }
    const body = JSON.stringify({
        text: buildTtsText(text),
        model_id: 'eleven_multilingual_v2',
    });
    const options = {
        hostname: 'api.elevenlabs.io',
        port: 443,
        path: `/v1/text-to-speech/${encodeURIComponent(config_1.config.elevenLabsVoiceId)}?output_format=opus_48000_128`,
        method: 'POST',
        headers: {
            'xi-api-key': config_1.config.elevenLabsApiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/opus',
            'Content-Length': Buffer.byteLength(body),
        },
    };
    return await new Promise((resolve, reject) => {
        const req = https_1.default.request(options, (res) => {
            const chunks = [];
            res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    const errBody = Buffer.concat(chunks).toString('utf8');
                    return reject(new Error(`ElevenLabs TTS error: HTTP ${res.statusCode} ${res.statusMessage || ''} - ${errBody.slice(0, 300)}`));
                }
                resolve(Buffer.concat(chunks));
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
/** OpenAI opus = OGG/Opus, suitable for Telegram sendVoice (voice message). */
async function generateSpeechOpenAI(text, voice = 'male') {
    const response = await openaiClient_1.openai.audio.speech.create({
        model: 'tts-1',
        voice: OPENAI_VOICE_MAP[voice],
        input: buildTtsText(text),
        response_format: 'opus',
    });
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
// Backward‑compatible alias for non‑Telegram callers (e.g. web тренажёр)
exports.generateSpeechBuffer = generateSpeechOpenAI;
/**
 * Send client voice/audio message using TTS.
 * Uses OpenAI TTS when TTS_PROVIDER=openai or ElevenLabs unavailable.
 * Fails silently for the user (only logs).
 */
async function sendClientVoiceIfEnabled(ctx, text, options) {
    if (!isTtsEnabled())
        return;
    const trimmed = text.trim();
    if (!trimmed)
        return;
    const voice = options?.voice ?? 'male';
    const tryOpenAI = async () => {
        const buffer = await generateSpeechOpenAI(trimmed, voice);
        if (!buffer.length)
            return;
        await ctx.replyWithVoice(telegraf_1.Input.fromBuffer(buffer, 'voice.ogg'));
    };
    const tryElevenLabs = async () => {
        const audio = await generateSpeechElevenLabs(trimmed);
        if (!audio.length)
            return;
        await ctx.replyWithVoice(telegraf_1.Input.fromBuffer(audio, 'voice.ogg'));
    };
    try {
        if (useOpenAITts()) {
            await tryOpenAI();
            return;
        }
        try {
            await tryElevenLabs();
        }
        catch (elErr) {
            const msg = elErr instanceof Error ? elErr.message : String(elErr);
            if (msg.includes('401') || msg.includes('402') || msg.includes('403') || msg.includes('Payment Required') || msg.includes('Unauthorized')) {
                console.warn('[tts] ElevenLabs failed, falling back to OpenAI TTS');
                await tryOpenAI();
            }
            else {
                throw elErr;
            }
        }
    }
    catch (err) {
        console.error('[tts] Failed to send voice:', err);
    }
}
//# sourceMappingURL=tts.js.map