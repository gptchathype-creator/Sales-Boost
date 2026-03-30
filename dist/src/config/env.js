"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const EnvSchema = zod_1.z.object({
    TELEGRAM_BOT_TOKEN: zod_1.z.string().optional(),
    BOT_TOKEN: zod_1.z.string().optional(),
    OPENAI_API_KEY: zod_1.z.string().min(1, 'OPENAI_API_KEY is required'),
    DATABASE_URL: zod_1.z.string().min(1).default('file:./dev.db'),
    ADMIN_TELEGRAM_IDS: zod_1.z.string().optional(),
    PORT: zod_1.z.string().optional(),
    ALLOW_DEV_ADMIN: zod_1.z.string().optional(),
    MINI_APP_URL: zod_1.z.string().optional(),
    ELEVENLABS_API_KEY: zod_1.z.string().optional(),
    ELEVENLABS_VOICE_ID: zod_1.z.string().optional(),
    TTS_PROVIDER: zod_1.z.string().optional(), // "openai" | "elevenlabs" — default: elevenlabs if keys set, else openai
    HTTPS_PROXY: zod_1.z.string().optional(), // Прокси для OpenAI (если API недоступен в регионе)
    AUTH_TOKEN_SECRET: zod_1.z.string().optional(),
});
const raw = EnvSchema.parse(process.env);
const botToken = raw.TELEGRAM_BOT_TOKEN || raw.BOT_TOKEN;
if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN or BOT_TOKEN is required');
}
exports.env = {
    botToken,
    openaiApiKey: raw.OPENAI_API_KEY,
    adminIdentifiers: raw.ADMIN_TELEGRAM_IDS
        ? raw.ADMIN_TELEGRAM_IDS.split(',').map((id) => id.trim().toLowerCase()).filter(Boolean)
        : [],
    databaseUrl: raw.DATABASE_URL,
    port: parseInt(raw.PORT || '3000', 10),
    allowDevAdmin: raw.ALLOW_DEV_ADMIN === 'true' || raw.ALLOW_DEV_ADMIN === '1',
    miniAppUrl: raw.MINI_APP_URL,
    elevenLabsApiKey: raw.ELEVENLABS_API_KEY,
    elevenLabsVoiceId: raw.ELEVENLABS_VOICE_ID,
    ttsProvider: raw.TTS_PROVIDER?.toLowerCase() === 'openai' ? 'openai' : 'elevenlabs',
    httpsProxy: raw.HTTPS_PROXY?.trim() || undefined,
    authTokenSecret: raw.AUTH_TOKEN_SECRET?.trim() || undefined,
};
//# sourceMappingURL=env.js.map