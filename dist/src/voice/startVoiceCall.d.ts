/**
 * Start a voice dialog call via Voximplant StartScenarios API.
 * Used by the admin panel; all config from env (same as call-test server).
 * scenario: 'dialog' = our LLM (voice_dialog), 'realtime' = OpenAI Realtime (hybrid), 'realtime_pure' = OpenAI Realtime (prompt-only).
 * In dev, prefers live tunnel URL from getTunnelUrl() so dialog_url is always current.
 */
export type VoiceCallScenario = 'dialog' | 'realtime' | 'realtime_pure';
export interface StartVoiceCallOptions {
    /** 'dialog' = our LLM (voice_dialog), 'realtime' = OpenAI Realtime. Default: 'dialog'. */
    scenario?: VoiceCallScenario;
}
export interface StartVoiceCallResult {
    callId: string;
    startedAt: string;
    scenario?: VoiceCallScenario;
}
export interface StartVoiceCallError {
    error: string;
}
export declare function startVoiceCall(to: string, options?: StartVoiceCallOptions): Promise<StartVoiceCallResult | StartVoiceCallError>;
//# sourceMappingURL=startVoiceCall.d.ts.map