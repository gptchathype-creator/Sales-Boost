import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  BOT_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  ADMIN_TELEGRAM_IDS: z.string().optional(),
  PORT: z.string().optional(),
  ALLOW_DEV_ADMIN: z.string().optional(),
  MINI_APP_URL: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  TTS_PROVIDER: z.string().optional(), // "openai" | "elevenlabs" — default: elevenlabs if keys set, else openai
  HTTPS_PROXY: z.string().optional(), // Прокси для OpenAI (если API недоступен в регионе)
});

const raw = EnvSchema.parse(process.env);

const botToken = raw.TELEGRAM_BOT_TOKEN || raw.BOT_TOKEN;
if (!botToken) {
  throw new Error('TELEGRAM_BOT_TOKEN or BOT_TOKEN is required');
}

export const env = {
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
} as const;

