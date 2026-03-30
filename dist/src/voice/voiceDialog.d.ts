/**
 * Voice call dialog: ASR (Voximplant) → text → our LLM (virtual client) → reply_text → TTS (Voximplant).
 * In-memory session store keyed by call_id. Same algorithm as Telegram training.
 */
import type { Request, Response } from 'express';
/** Result of one voice dialog turn (same shape as POST /voice/dialog response). */
export interface VoiceDialogReply {
    reply_text: string;
    end_session: boolean;
}
export declare function getVoiceDialogReply(callId: string, managerText?: string): Promise<VoiceDialogReply>;
/** Split reply text into chunks for streaming TTS (by sentence, then by max length). */
export declare function splitReplyIntoChunks(replyText: string, maxChunkLen?: number): string[];
/**
 * POST /voice/dialog
 * Body: { call_id: string, text?: string, is_final?: boolean }
 * - First request (no text or empty history): returns first client greeting.
 * - Subsequent: appends manager text, runs LLM, returns reply_text and end_session.
 */
export declare function handleVoiceDialog(req: Request, res: Response): Promise<void>;
/** Optional: cleanup old sessions (e.g. call ended without proper end_session) */
export declare function deleteVoiceSession(callId: string): void;
//# sourceMappingURL=voiceDialog.d.ts.map