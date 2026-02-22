/**
 * WebSocket /voice/stream: stream reply_text in chunks so the scenario can start TTS sooner.
 * Messages: { call_id, text? } -> we send { chunk: "..." } then { done: true, end_session: boolean }.
 */

import type { WebSocket } from 'ws';
import { getVoiceDialogReply, splitReplyIntoChunks } from './voiceDialog';

const CHUNK_MAX_LEN = 80;

function send(ws: WebSocket, obj: object): void {
  if (ws.readyState !== 1 /* OPEN */) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch (err) {
    console.error('[voice/stream] send error:', err);
  }
}

export async function handleVoiceStreamMessage(ws: WebSocket, raw: string): Promise<void> {
  console.log('[voice/stream] Message received, length:', raw?.length);
  let data: { call_id?: string; text?: string };
  try {
    data = JSON.parse(raw);
  } catch {
    send(ws, { error: 'Invalid JSON' });
    return;
  }
  const callId = data?.call_id;
  if (!callId || typeof callId !== 'string') {
    send(ws, { error: 'Missing call_id' });
    return;
  }
  const managerText = typeof data?.text === 'string' ? data.text : undefined;
  console.log('[voice/stream] call_id=', callId, 'text=', managerText ? managerText.slice(0, 40) : '(first)');

  try {
    const result = await getVoiceDialogReply(callId, managerText);
    const chunks = splitReplyIntoChunks(result.reply_text, CHUNK_MAX_LEN);
    console.log('[voice/stream] Sending', chunks.length, 'chunks');
    for (const chunk of chunks) {
      send(ws, { chunk });
    }
    send(ws, { done: true, end_session: result.end_session });
  } catch (err) {
    console.error('[voice/stream] Error:', err);
    send(ws, { error: err instanceof Error ? err.message : 'Unknown error', done: true, end_session: true });
  }
}
