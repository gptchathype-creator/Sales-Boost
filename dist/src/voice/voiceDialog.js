"use strict";
/**
 * Voice call dialog: ASR (Voximplant) → text → our LLM (virtual client) → reply_text → TTS (Voximplant).
 * In-memory session store keyed by call_id. Same algorithm as Telegram training.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVoiceDialogReply = getVoiceDialogReply;
exports.splitReplyIntoChunks = splitReplyIntoChunks;
exports.handleVoiceDialog = handleVoiceDialog;
exports.deleteVoiceSession = deleteVoiceSession;
const carLoader_1 = require("../data/carLoader");
const virtualClient_1 = require("../llm/virtualClient");
const defaultState_1 = require("../state/defaultState");
const behaviorClassifier_1 = require("../logic/behaviorClassifier");
const clientProfile_1 = require("../logic/clientProfile");
const topicStateMachine_1 = require("../logic/topicStateMachine");
const callHistory_1 = require("./callHistory");
const DIALOG_HISTORY_LIMIT = 12;
const DEFAULT_STRICTNESS = 'medium';
const DEFAULT_PROFILE = 'normal';
const sessions = new Map();
// Car loaded once at first use
let cachedCar = null;
let cachedDealership = '';
function getCarAndDealership() {
    if (!cachedCar) {
        cachedCar = (0, carLoader_1.loadCar)();
        cachedDealership = (0, virtualClient_1.buildDealershipFromCar)(cachedCar);
    }
    return { car: cachedCar, dealership: cachedDealership };
}
function getOrCreateSession(callId) {
    let session = sessions.get(callId);
    if (session)
        return session;
    const { car, dealership } = getCarAndDealership();
    const state = (0, defaultState_1.getDefaultState)(DEFAULT_PROFILE);
    const max_client_turns = 10;
    state.strictnessState = { strictness: DEFAULT_STRICTNESS, max_client_turns };
    state.objection_triggered = (0, clientProfile_1.pickRandomObjection)(DEFAULT_PROFILE);
    session = {
        state,
        history: [],
        car,
        dealership,
        strictness: DEFAULT_STRICTNESS,
        max_client_turns,
        createdAt: Date.now(),
    };
    sessions.set(callId, session);
    return session;
}
function applyDiagnosticsToState(state, out) {
    const diag = out.diagnostics;
    state.phase = diag.current_phase;
    state.client_turns = out.update_state.client_turns;
    state.stage = out.update_state.stage;
    state.notes = out.update_state.notes ?? state.notes;
    if (out.update_state.checklist) {
        state.checklist = { ...state.checklist, ...out.update_state.checklist };
    }
    let topicMap = { ...state.topics };
    for (const code of diag.topics_addressed) {
        if (topicMap[code]) {
            const currentStatus = topicMap[code].status;
            const next = currentStatus === 'none' ? 'asked' : currentStatus === 'asked' ? 'answered' : currentStatus;
            const result = (0, topicStateMachine_1.advanceTopic)(topicMap, code, next);
            if (result.valid)
                topicMap = result.map;
        }
    }
    for (const code of diag.topics_evaded) {
        if (topicMap[code])
            topicMap = (0, topicStateMachine_1.recordEvasion)(topicMap, code);
    }
    state.topics = topicMap;
    state.communication.tone = diag.manager_tone;
    state.communication.engagement = diag.manager_engagement;
    if (diag.misinformation_detected)
        state.fact_context.misinformation_detected = true;
}
/**
 * Core logic: get reply_text and end_session for a call_id and optional manager text.
 * Used by both POST /voice/dialog and WebSocket /voice/stream.
 */
const FALLBACK_GREETING = 'Здравствуйте! Я увидел ваше объявление. Подскажите, товар ещё доступен?';
async function getVoiceDialogReply(callId, managerText) {
    const text = typeof managerText === 'string' ? managerText.trim() : '';
    let session;
    try {
        session = getOrCreateSession(callId);
    }
    catch (err) {
        console.error('[voice/dialog] getOrCreateSession failed (e.g. loadCar):', err instanceof Error ? err.message : err);
        return { reply_text: FALLBACK_GREETING, end_session: false };
    }
    const { state, history, car, dealership, strictness, max_client_turns } = session;
    if (history.length === 0) {
        const fallbackFirst = `Здравствуйте! Я увидел объявление о ${car.title}. Он ещё доступен для покупки?`;
        let out;
        try {
            out = await (0, virtualClient_1.getVirtualClientReply)({
                car,
                dealership,
                state,
                manager_last_message: '',
                dialog_history: [],
                strictness,
                max_client_turns,
                maxResponseTokens: 220,
            });
        }
        catch (err) {
            console.error('[voice/dialog] First message LLM error:', err instanceof Error ? err.message : err);
            out = {
                client_message: fallbackFirst,
                end_conversation: false,
                reason: '',
                diagnostics: {
                    current_phase: 'first_contact',
                    topics_addressed: [],
                    topics_evaded: [],
                    manager_tone: 'neutral',
                    manager_engagement: 'active',
                    misinformation_detected: false,
                    phase_checks_update: {},
                },
                update_state: { stage: state.stage, checklist: {}, notes: '', client_turns: 1 },
            };
        }
        applyDiagnosticsToState(state, out);
        const firstReply = (out.client_message && out.client_message.trim()) || fallbackFirst;
        session.history.push({ role: 'client', content: firstReply });
        return { reply_text: firstReply, end_session: out.end_conversation };
    }
    if (!text) {
        const lastClient = [...history].reverse().find((m) => m.role === 'client');
        return { reply_text: lastClient?.content ?? '', end_session: false };
    }
    session.history.push({ role: 'manager', content: text });
    const lastClientMsg = [...history].reverse().find((m) => m.role === 'client');
    const behavior = (0, behaviorClassifier_1.classifyBehavior)(text, {
        lastClientQuestion: lastClientMsg?.content,
        isClientWaitingAnswer: true,
    });
    if (behavior.toxic) {
        const toxicReply = behavior.severity === 'HIGH'
            ? 'Извините, но я не готов продолжать разговор в таком тоне. Всего доброго.'
            : 'Мне бы хотелось более уважительного общения. На этом, пожалуй, закончим.';
        session.history.push({ role: 'client', content: toxicReply });
        sessions.delete(callId);
        return { reply_text: toxicReply, end_session: true };
    }
    if (behavior.low_effort) {
        state.low_effort_streak = (state.low_effort_streak ?? 0) + 1;
    }
    else {
        state.low_effort_streak = 0;
    }
    if (state.low_effort_streak >= 3) {
        const failReply = 'Я задаю конкретные вопросы и хотел бы получать развёрнутые ответы. Видимо, сейчас не лучшее время. До свидания.';
        session.history.push({ role: 'client', content: failReply });
        sessions.delete(callId);
        return { reply_text: failReply, end_session: true };
    }
    const historyForLlm = history.slice(-DIALOG_HISTORY_LIMIT);
    let out;
    try {
        out = await (0, virtualClient_1.getVirtualClientReply)({
            car,
            dealership,
            state,
            manager_last_message: text,
            dialog_history: historyForLlm,
            strictness,
            max_client_turns,
            behaviorSignal: behavior,
            maxResponseTokens: 220,
        });
    }
    catch (err) {
        console.error('[voice/dialog] LLM error:', err instanceof Error ? err.message : err);
        throw new Error('LLM failed');
    }
    applyDiagnosticsToState(state, out);
    session.history.push({ role: 'client', content: out.client_message });
    const evasionCheck = (0, topicStateMachine_1.checkCriticalEvasions)(state.topics);
    if (evasionCheck.shouldFail) {
        const evasionReply = `Я дважды спросил про важный вопрос и не получил ответа. Пожалуй, обращусь в другой салон.`;
        session.history.push({ role: 'client', content: evasionReply });
        sessions.delete(callId);
        return { reply_text: evasionReply, end_session: true };
    }
    if (out.end_conversation)
        sessions.delete(callId);
    return { reply_text: out.client_message, end_session: out.end_conversation };
}
/** Split reply text into chunks for streaming TTS (by sentence, then by max length). */
function splitReplyIntoChunks(replyText, maxChunkLen = 80) {
    const s = replyText.trim();
    if (!s)
        return [];
    const sentences = s.split(/(?<=[.!?])\s+/).map((t) => t.trim()).filter(Boolean);
    const parts = [];
    for (const sent of sentences) {
        if (sent.length <= maxChunkLen) {
            parts.push(sent);
        }
        else {
            for (let i = 0; i < sent.length; i += maxChunkLen) {
                parts.push(sent.slice(i, i + maxChunkLen));
            }
        }
    }
    return parts.length > 0 ? parts : [s];
}
/**
 * POST /voice/dialog
 * Body: { call_id: string, text?: string, is_final?: boolean }
 * - First request (no text or empty history): returns first client greeting.
 * - Subsequent: appends manager text, runs LLM, returns reply_text and end_session.
 */
async function handleVoiceDialog(req, res) {
    try {
        const body = req.body;
        const callId = body?.call_id;
        const managerText = typeof body?.text === 'string' ? body.text.trim() : '';
        console.log('[voice/dialog] Request', { call_id: callId, text_preview: managerText ? managerText.slice(0, 60) : '(first)' });
        if (!callId) {
            res.status(400).json({ error: 'Missing call_id' });
            return;
        }
        const result = await getVoiceDialogReply(callId, managerText);
        if (managerText)
            (0, callHistory_1.appendTranscript)(callId, 'manager', managerText);
        (0, callHistory_1.appendTranscript)(callId, 'client', result.reply_text);
        res.json({ reply_text: result.reply_text, end_session: result.end_session });
    }
    catch (err) {
        console.error('[voice/dialog] Error:', err);
        res.status(200).json({
            reply_text: FALLBACK_GREETING,
            end_session: false,
        });
    }
}
/** Optional: cleanup old sessions (e.g. call ended without proper end_session) */
function deleteVoiceSession(callId) {
    sessions.delete(callId);
}
//# sourceMappingURL=voiceDialog.js.map