export type VoxFinalStatus =
  | "initiated"
  | "progress"
  | "connected"
  | "disconnected"
  | "failed"
  | "no_answer"
  | "busy";

export interface VoxCallMetrics {
  callId: string;
  to: string;
  voxCallId?: string;
  createdAt: string;
  firstProgressAt?: string;
  connectedAt?: string;
  endedAt?: string;
  pddMs?: number;
  answerDelayMs?: number;
  totalMs?: number;
  finalStatus: VoxFinalStatus;
}

export interface VoxEventPayload {
  call_id: string;
  to: string;
  vox_call_id?: string;
  event:
    | "progress"
    | "connected"
    | "disconnected"
    | "failed"
    | "hangup"
    | "busy"
    | "no_answer"
    | string;
  ts: string;
  details?: Record<string, unknown>;
}

export interface VoxEnvConfig {
  accountId: string;
  apiKey: string;
  appId: string;
  scenarioName: string;
  ruleName?: string;
  ruleId?: string;
  callerId?: string;
  publicBaseUrl: string;
}

export interface VoxStartCallParams {
  callId: string;
  to: string;
  eventUrl: string;
  callerId?: string;
  tag?: string;
  /** Full URL for voice dialog (ASR → our LLM → TTS). E.g. https://main-app.example.com/voice/dialog */
  dialogUrl?: string;
  /** WebSocket URL for streaming reply in chunks (faster TTS start). E.g. wss://main-app.example.com/voice/stream */
  streamUrl?: string;
  /** Override scenario name (e.g. "voice_dialog" for ASR→LLM→TTS flow). */
  scenarioName?: string;
  /** Override routing rule (required in Voximplant: the rule determines which scenario runs). E.g. "voice_dialog_rule". */
  ruleName?: string;
}
