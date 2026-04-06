"use strict";
/**
 * Persist and evaluate voice call sessions when a call ends (webhook).
 * Uses same evaluation criteria as correspondence (evaluatorV2).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeVoiceCallSession = finalizeVoiceCallSession;
const db_1 = require("../db");
const callHistory_1 = require("./callHistory");
const carLoader_1 = require("../data/carLoader");
const defaultState_1 = require("../state/defaultState");
const evaluatorV2_1 = require("../llm/evaluatorV2");
const voxLogTranscript_1 = require("./voxLogTranscript");
function normalizeOutcome(event, details) {
    if (event === 'no_answer' || event === 'busy' || event === 'failed')
        return event;
    if (event === 'disconnected')
        return 'disconnected';
    return 'completed';
}
function dialogHistoryFromTranscript(transcript) {
    return transcript.map((t) => ({
        role: t.role,
        content: t.text,
    }));
}
/**
 * Called when Vox sends event (e.g. disconnected). Persists session and runs evaluation if we have transcript.
 */
async function finalizeVoiceCallSession(payload) {
    const callId = payload.call_id;
    const to = payload.to;
    const event = (payload.event || 'disconnected');
    if (!callId || !to) {
        console.warn('[voice/session] finalizeVoiceCallSession: missing call_id or to', payload);
        return;
    }
    const record = (0, callHistory_1.getRecordByCallId)(callId);
    const startedAt = record ? new Date(record.startedAt) : new Date();
    const endedAt = new Date();
    const durationSec = record ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000) : 0;
    const outcome = normalizeOutcome(event, payload.details);
    console.log('[voice/session] finalize start', {
        callId,
        event,
        to,
        hasPayloadTranscript: Array.isArray(payload.transcript) ? payload.transcript.length : 0,
        hasMemoryTranscript: record?.transcript?.length ?? 0,
        voxSessionId: payload.vox_session_id ?? null,
    });
    // Prefer transcript from webhook payload (e.g. realtime_pure sends it); fallback to in-memory record (dialog scenario)
    const rawPayloadTranscript = payload.transcript;
    let payloadTranscript = Array.isArray(rawPayloadTranscript) &&
        rawPayloadTranscript.length > 0 &&
        rawPayloadTranscript.every((t) => typeof t === 'object' &&
            t !== null &&
            'role' in t &&
            'text' in t &&
            (t.role === 'manager' || t.role === 'client'))
        ? rawPayloadTranscript
        : [];
    const toNormalized = '+' + String(to).replace(/\D/g, '');
    // 1) Save session immediately so admin shows "Processing..." right after hangup
    const initialTranscript = payloadTranscript.length > 0 ? payloadTranscript : (record?.transcript ?? []);
    try {
        await db_1.prisma.voiceCallSession.upsert({
            where: { callId },
            create: {
                callId,
                to: toNormalized,
                startedAt,
                endedAt,
                outcome,
                durationSec,
                transcriptJson: JSON.stringify(initialTranscript),
                evaluationJson: null,
                totalScore: null,
                failureReason: null,
            },
            update: {
                endedAt,
                outcome,
                durationSec,
                transcriptJson: JSON.stringify(initialTranscript),
            },
        });
    }
    catch (err) {
        console.error('[voice/session] initial upsert error:', err instanceof Error ? err.message : err);
    }
    // 2) If transcript missing but we have vox_session_id (realtime_pure), fetch from Voximplant log and update
    let transcript = initialTranscript;
    let transcriptSource = payloadTranscript.length > 0 ? 'webhook' : (record?.transcript?.length ? 'memory' : 'none');
    if (transcript.length === 0 && payload.vox_session_id != null) {
        try {
            await new Promise((r) => setTimeout(r, 2000));
            const { transcript: logTranscript } = await (0, voxLogTranscript_1.getTranscriptFromVoxLog)(payload.vox_session_id);
            if (logTranscript.length > 0) {
                transcript = logTranscript;
                transcriptSource = 'vox_log';
                await db_1.prisma.voiceCallSession.update({
                    where: { callId },
                    data: { transcriptJson: JSON.stringify(transcript) },
                });
            }
        }
        catch (err) {
            console.warn('[voice/session] getTranscriptFromVoxLog failed:', err instanceof Error ? err.message : err);
        }
    }
    console.log('[voice/session] transcript', { callId, source: transcriptSource, turns: transcript.length });
    if (transcript.length < 2) {
        const reason = transcript.length === 0
            ? 'Transcript unavailable: webhook payload empty and Vox log returned no transcript.'
            : `Transcript too short for evaluation: ${transcript.length} turn(s).`;
        console.warn('[voice/session] transcript insufficient', { callId, source: transcriptSource, reason });
        try {
            await db_1.prisma.voiceCallSession.update({
                where: { callId },
                data: { failureReason: reason.slice(0, 200) },
            });
        }
        catch (err) {
            console.warn('[voice/session] failed to save transcript failureReason:', err instanceof Error ? err.message : err);
        }
        return;
    }
    // 3) Run evaluation (can take time) and update session when ready
    try {
        const car = (0, carLoader_1.loadCar)();
        const state = (0, defaultState_1.getDefaultState)('normal');
        const dialogHistory = dialogHistoryFromTranscript(transcript);
        console.log('[voice/session] evaluation start', { callId, turns: transcript.length });
        const { evaluation } = await (0, evaluatorV2_1.evaluateSessionV2)({
            dialogHistory,
            car,
            state,
            earlyFail: false,
            behaviorSignals: [],
        });
        const evaluationJson = JSON.stringify(evaluation);
        const totalScore = evaluation.overall_score_0_100 ?? null;
        await db_1.prisma.voiceCallSession.update({
            where: { callId },
            data: {
                evaluationJson,
                totalScore,
                failureReason: null,
            },
        });
        console.log('[voice/session] evaluation saved', { callId, totalScore });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[voice/session] evaluateSessionV2 error:', msg);
        try {
            await db_1.prisma.voiceCallSession.update({
                where: { callId },
                data: { failureReason: msg.slice(0, 200) },
            });
        }
        catch (_) { }
    }
}
//# sourceMappingURL=voiceCallSession.js.map