"use strict";
/**
 * In-memory call history for admin: started calls + transcript per call.
 * Persists only for process lifetime.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCall = addCall;
exports.setVoxSessionId = setVoxSessionId;
exports.appendTranscript = appendTranscript;
exports.getCallHistory = getCallHistory;
exports.getRecordByCallId = getRecordByCallId;
exports.getTestNumbers = getTestNumbers;
exports.getDefaultTo = getDefaultTo;
const MAX_HISTORY = 100;
const calls = [];
const byCallId = new Map();
function normalizePhone(v) {
    const digits = String(v).replace(/\D/g, '');
    return digits ? '+' + digits : v;
}
function addCall(callId, to) {
    const record = {
        callId,
        to: normalizePhone(to),
        startedAt: new Date().toISOString(),
        transcript: [],
        voxSessionId: null,
    };
    byCallId.set(callId, record);
    calls.unshift(record);
    if (calls.length > MAX_HISTORY) {
        const removed = calls.pop();
        if (removed)
            byCallId.delete(removed.callId);
    }
}
function setVoxSessionId(callId, voxSessionId) {
    const record = byCallId.get(callId);
    if (!record)
        return;
    if (!Number.isFinite(voxSessionId) || voxSessionId <= 0)
        return;
    record.voxSessionId = voxSessionId;
}
function appendTranscript(callId, role, text) {
    if (!text || !text.trim())
        return;
    const record = byCallId.get(callId);
    if (!record)
        return;
    record.transcript.push({ role, text: text.trim() });
}
function getCallHistory(limit = 50) {
    return calls.slice(0, Math.min(limit, calls.length));
}
/** Get one call by callId (for webhook to finalize and persist). */
function getRecordByCallId(callId) {
    return byCallId.get(callId);
}
function getTestNumbers() {
    const to = process.env.VOX_TEST_TO?.trim();
    const list = process.env.VOX_TEST_NUMBERS || '';
    const fromList = list
        .split(',')
        .map((s) => s.trim().replace(/\D/g, ''))
        .filter((s) => s.length > 0)
        .map((s) => '+' + s);
    const combined = to ? [normalizePhone(to), ...fromList] : fromList;
    return [...new Set(combined)];
}
function getDefaultTo() {
    const nums = getTestNumbers();
    return nums.length > 0 ? nums[0] : null;
}
//# sourceMappingURL=callHistory.js.map