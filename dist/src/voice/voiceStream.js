"use strict";
/**
 * WebSocket /voice/stream: stream reply_text in chunks so the scenario can start TTS sooner.
 * Messages: { call_id, text? } -> we send { chunk: "..." } then { done: true, end_session: boolean }.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleVoiceStreamMessage = handleVoiceStreamMessage;
const voiceDialog_1 = require("./voiceDialog");
const CHUNK_MAX_LEN = 80;
function send(ws, obj) {
    if (ws.readyState !== 1 /* OPEN */)
        return;
    try {
        ws.send(JSON.stringify(obj));
    }
    catch (err) {
        console.error('[voice/stream] send error:', err);
    }
}
async function handleVoiceStreamMessage(ws, raw) {
    const len = raw?.length ?? 0;
    console.log('[voice/stream] Message received, length:', len, 'preview:', (raw || '').slice(0, 80));
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch {
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
        const result = await (0, voiceDialog_1.getVoiceDialogReply)(callId, managerText);
        const replyLen = result?.reply_text?.length ?? 0;
        console.log('[voice/stream] Reply length:', replyLen);
        const chunks = (0, voiceDialog_1.splitReplyIntoChunks)(result.reply_text, CHUNK_MAX_LEN);
        console.log('[voice/stream] Sending', chunks.length, 'chunks');
        for (const chunk of chunks) {
            send(ws, { chunk });
        }
        send(ws, { done: true, end_session: result.end_session });
    }
    catch (err) {
        console.error('[voice/stream] Error:', err);
        send(ws, { error: err instanceof Error ? err.message : 'Unknown error', done: true, end_session: true });
    }
}
//# sourceMappingURL=voiceStream.js.map