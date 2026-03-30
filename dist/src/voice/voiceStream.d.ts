/**
 * WebSocket /voice/stream: stream reply_text in chunks so the scenario can start TTS sooner.
 * Messages: { call_id, text? } -> we send { chunk: "..." } then { done: true, end_session: boolean }.
 */
import type { WebSocket } from 'ws';
export declare function handleVoiceStreamMessage(ws: WebSocket, raw: string): Promise<void>;
//# sourceMappingURL=voiceStream.d.ts.map