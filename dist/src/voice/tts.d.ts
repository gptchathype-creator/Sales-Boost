import type { Context } from 'telegraf';
import type { TtsVoice } from '../state/userPreferences';
export declare function isTtsEnabled(): boolean;
/** Cost per 1000 chars (OpenAI tts-1). ~$0.015/1k chars. */
export declare const TTS_COST_PER_1K_CHARS = 0.015;
/** Estimate cost for a training session (10–14 client turns, ~300 chars each). */
export declare function estimateTtsCostPerSession(): string;
/** OpenAI opus = OGG/Opus, suitable for Telegram sendVoice (voice message). */
export declare function generateSpeechOpenAI(text: string, voice?: TtsVoice): Promise<Buffer>;
export declare const generateSpeechBuffer: typeof generateSpeechOpenAI;
export interface SendVoiceOptions {
    voice?: TtsVoice;
}
/**
 * Send client voice/audio message using TTS.
 * Uses OpenAI TTS when TTS_PROVIDER=openai or ElevenLabs unavailable.
 * Fails silently for the user (only logs).
 */
export declare function sendClientVoiceIfEnabled(ctx: Context, text: string, options?: SendVoiceOptions): Promise<void>;
//# sourceMappingURL=tts.d.ts.map