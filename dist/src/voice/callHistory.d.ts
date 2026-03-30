/**
 * In-memory call history for admin: started calls + transcript per call.
 * Persists only for process lifetime.
 */
export interface TranscriptTurn {
    role: 'manager' | 'client';
    text: string;
}
export interface VoiceCallRecord {
    callId: string;
    to: string;
    startedAt: string;
    transcript: TranscriptTurn[];
}
export declare function addCall(callId: string, to: string): void;
export declare function appendTranscript(callId: string, role: 'manager' | 'client', text: string): void;
export declare function getCallHistory(limit?: number): VoiceCallRecord[];
/** Get one call by callId (for webhook to finalize and persist). */
export declare function getRecordByCallId(callId: string): VoiceCallRecord | undefined;
export declare function getTestNumbers(): string[];
export declare function getDefaultTo(): string | null;
//# sourceMappingURL=callHistory.d.ts.map