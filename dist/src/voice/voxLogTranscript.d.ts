/**
 * Fetch call session log from Voximplant and parse transcript from WebSocket messages.
 * Used when the scenario (e.g. realtime_pure) does not send transcript in the webhook:
 * we get it from the session log in the background without affecting call speed.
 * Supports secure logs via JWT from a Voximplant service account.
 */
import type { TranscriptTurn } from './callHistory';
export interface GetTranscriptFromVoxLogResult {
    transcript: TranscriptTurn[];
    source: 'vox_log';
}
/**
 * Call Voximplant GetCallHistory for the given session id, fetch log_file_url, parse log for transcript.
 * Returns transcript array (manager/client) or empty array on any failure.
 */
export declare function getTranscriptFromVoxLog(voxSessionId: number): Promise<GetTranscriptFromVoxLogResult>;
//# sourceMappingURL=voxLogTranscript.d.ts.map