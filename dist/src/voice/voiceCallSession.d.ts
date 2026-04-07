/**
 * Persist and evaluate voice call sessions when a call ends (webhook).
 * Uses same evaluation criteria as correspondence (evaluatorV2).
 */
import { type TranscriptTurn } from './callHistory';
export type VoxWebhookEvent = 'progress' | 'connected' | 'disconnected' | 'failed' | 'busy' | 'no_answer';
export interface VoxWebhookPayload {
    call_id?: string;
    to?: string;
    event?: string;
    ts?: string;
    details?: Record<string, unknown> & {
        reason?: string;
        code?: number;
    };
    /** Transcript from scenario (e.g. realtime_pure): [{ role: 'manager'|'client', text: string }] */
    transcript?: TranscriptTurn[] | unknown[];
    /** Voximplant session id (from AppEvents.Started) — used to fetch session log and parse transcript if not sent */
    vox_session_id?: number;
    /** Some Vox scenarios send vox_call_id instead of vox_session_id (call session history id). */
    vox_call_id?: number | string;
}
/**
 * Called when Vox sends event (e.g. disconnected). Persists session and runs evaluation if we have transcript.
 */
export declare function finalizeVoiceCallSession(payload: VoxWebhookPayload): Promise<void>;
//# sourceMappingURL=voiceCallSession.d.ts.map