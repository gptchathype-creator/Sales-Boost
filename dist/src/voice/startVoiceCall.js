"use strict";
/**
 * Start a voice dialog call via Voximplant StartScenarios API.
 * Used by the admin panel; all config from env (same as call-test server).
 * scenario: 'dialog' = our LLM (voice_dialog), 'realtime' = OpenAI Realtime (hybrid), 'realtime_pure' = OpenAI Realtime (prompt-only).
 * In dev, prefers live tunnel URL from getTunnelUrl() so dialog_url is always current.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveVoiceCallUrls = resolveVoiceCallUrls;
exports.startVoiceCall = startVoiceCall;
const undici_1 = require("undici");
const node_crypto_1 = require("node:crypto");
const tunnel_1 = require("../tunnel");
const VOX_API_BASE = 'https://api.voximplant.com/platform_api';
function normalizePhone(v) {
    const digits = String(v).replace(/\D/g, '');
    return digits ? '+' + digits : v;
}
function resolveVoiceCallUrls() {
    const tunnelUrl = (0, tunnel_1.getTunnelUrl)()?.replace(/\/$/, '') || '';
    const miniAppUrl = String(process.env.MINI_APP_URL || '').replace(/\/$/, '');
    const voiceDialogBaseUrl = String(process.env.VOICE_DIALOG_BASE_URL || '').replace(/\/$/, '');
    const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    // Prefer stable HTTPS URLs from env for webhooks so they don't break on local tunnel restart.
    const eventUrlBase = publicBaseUrl ||
        miniAppUrl ||
        tunnelUrl ||
        voiceDialogBaseUrl ||
        '';
    // For dialog_url / stream_url: prefer explicit VOICE_DIALOG_BASE_URL, then MINI_APP_URL, then live tunnel.
    const baseUrl = (voiceDialogBaseUrl || miniAppUrl || tunnelUrl || '').replace(/\/$/, '');
    const eventUrl = eventUrlBase ? `${eventUrlBase}/webhooks/vox` : '';
    return { tunnelUrl, baseUrl, eventUrlBase, eventUrl };
}
async function startVoiceCall(to, options = {}) {
    const { scenario = 'dialog' } = options;
    const accountId = process.env.VOX_ACCOUNT_ID;
    const apiKey = process.env.VOX_API_KEY;
    const appId = process.env.VOX_APP_ID;
    const { baseUrl, eventUrl } = resolveVoiceCallUrls();
    if (!accountId || !apiKey || !appId) {
        return { error: 'VOX_ACCOUNT_ID, VOX_API_KEY, VOX_APP_ID must be set in env.' };
    }
    const toNormalized = normalizePhone(to);
    if (!toNormalized || toNormalized.length < 10) {
        return { error: 'Invalid phone number.' };
    }
    const callId = (0, node_crypto_1.randomUUID)();
    let scriptName;
    let ruleName;
    let customData;
    if (scenario === 'realtime_pure') {
        scriptName = process.env.VOX_REALTIME_PURE_SCENARIO_NAME || 'voice_realtime_pure';
        ruleName = process.env.VOX_REALTIME_PURE_RULE_NAME || 'voice_realtime_pure_rule';
        const openaiApiKey = process.env.OPENAI_API_KEY || '';
        if (!openaiApiKey || openaiApiKey.length < 10) {
            return { error: 'OPENAI_API_KEY must be set in env for Realtime Pure scenario.' };
        }
        customData = {
            call_id: callId,
            to: toNormalized,
            event_url: eventUrl,
            caller_id: process.env.VOX_CALLER_ID ? normalizePhone(process.env.VOX_CALLER_ID) : undefined,
            openai_api_key: openaiApiKey,
        };
        // No dialog_url: full script is in the scenario prompt.
    }
    else if (scenario === 'realtime') {
        scriptName = process.env.VOX_REALTIME_SCENARIO_NAME || 'voice_realtime';
        ruleName = process.env.VOX_REALTIME_RULE_NAME || 'voice_realtime_rule';
        const openaiApiKey = process.env.OPENAI_API_KEY || '';
        if (!openaiApiKey || openaiApiKey.length < 10) {
            return { error: 'OPENAI_API_KEY must be set in env for Realtime scenario.' };
        }
        customData = {
            call_id: callId,
            to: toNormalized,
            event_url: eventUrl,
            caller_id: process.env.VOX_CALLER_ID ? normalizePhone(process.env.VOX_CALLER_ID) : undefined,
            openai_api_key: openaiApiKey,
        };
        // When baseUrl is set, pass dialog_url so Realtime uses our algorithm (virtual client) via function calling.
        if (baseUrl) {
            customData.dialog_url = `${baseUrl}/voice/dialog`;
        }
    }
    else {
        if (!baseUrl) {
            return { error: 'VOICE_DIALOG_BASE_URL or MINI_APP_URL must be set for dialog scenario.' };
        }
        const dialogUrl = `${baseUrl}/voice/dialog`;
        const useStream = process.env.VOICE_USE_STREAM === 'true' || process.env.VOICE_USE_STREAM === '1';
        const streamUrl = useStream
            ? baseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/voice/stream'
            : undefined;
        scriptName = process.env.VOX_DIALOG_SCENARIO_NAME || 'voice_dialog';
        ruleName = process.env.VOX_DIALOG_RULE_NAME || 'voice_dialog_rule';
        customData = {
            call_id: callId,
            to: toNormalized,
            event_url: eventUrl,
            caller_id: process.env.VOX_CALLER_ID ? normalizePhone(process.env.VOX_CALLER_ID) : undefined,
            tag: null,
            dialog_url: dialogUrl,
        };
        if (streamUrl)
            customData.stream_url = streamUrl;
    }
    const formParams = {
        account_id: accountId,
        api_key: apiKey,
        application_id: appId,
        script_name: scriptName,
        script_custom_data: JSON.stringify(customData),
        phone: toNormalized,
        output: 'json',
        rule_name: ruleName,
    };
    const form = new URLSearchParams(formParams);
    try {
        const { statusCode, body } = await (0, undici_1.request)(`${VOX_API_BASE}/StartScenarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString(),
        });
        const text = await body.text();
        if (statusCode >= 400) {
            console.warn('[vox] StartScenarios HTTP error', {
                statusCode,
                scriptName,
                ruleName,
                to: toNormalized,
                eventUrlPresent: Boolean(eventUrl),
                callerIdPresent: Boolean(customData?.caller_id),
                response: text.slice(0, 500),
            });
            return { error: `Vox API HTTP ${statusCode}: ${text.slice(0, 200)}` };
        }
        try {
            const parsed = JSON.parse(text);
            const debugEnabled = process.env.VOX_DEBUG === '1' || process.env.VOX_DEBUG === 'true';
            if (debugEnabled) {
                console.log('[vox] StartScenarios OK', {
                    scriptName,
                    ruleName,
                    to: toNormalized,
                    eventUrlPresent: Boolean(eventUrl),
                    callerIdPresent: Boolean(customData?.caller_id),
                    result: parsed?.result,
                    callSessionHistoryId: parsed?.call_session_history_id,
                    raw: parsed,
                });
            }
            if (parsed?.error) {
                const msg = parsed.error.msg || JSON.stringify(parsed.error);
                console.warn('[vox] StartScenarios error payload', { scriptName, ruleName, to: toNormalized, msg });
                return { error: `Vox API: ${msg}` };
            }
            // Some Vox APIs return result=0 without "error" object.
            if (parsed?.result === 0) {
                const msg = parsed?.msg || parsed?.message || 'Unknown Vox API failure (result=0).';
                console.warn('[vox] StartScenarios failed result=0', { scriptName, ruleName, to: toNormalized, msg, raw: parsed });
                return { error: `Vox API: ${String(msg)}` };
            }
        }
        catch (_) {
            // ignore parse
        }
        const startedAt = new Date().toISOString();
        return { callId, startedAt, scenario };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `StartScenarios failed: ${message}` };
    }
}
//# sourceMappingURL=startVoiceCall.js.map