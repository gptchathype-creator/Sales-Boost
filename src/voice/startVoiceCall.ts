/**
 * Start a voice dialog call via Voximplant StartScenarios API.
 * Used by the admin panel; all config from env (same as call-test server).
 */

import { request } from 'undici';
import { randomUUID } from 'node:crypto';

const VOX_API_BASE = 'https://api.voximplant.com/platform_api';

function normalizePhone(v: string): string {
  const digits = String(v).replace(/\D/g, '');
  return digits ? '+' + digits : v;
}

export interface StartVoiceCallResult {
  callId: string;
  startedAt: string;
}

export interface StartVoiceCallError {
  error: string;
}

export async function startVoiceCall(to: string): Promise<StartVoiceCallResult | StartVoiceCallError> {
  const accountId = process.env.VOX_ACCOUNT_ID;
  const apiKey = process.env.VOX_API_KEY;
  const appId = process.env.VOX_APP_ID;
  const baseUrl = (process.env.VOICE_DIALOG_BASE_URL || process.env.MINI_APP_URL || '').replace(/\/$/, '');
  const eventUrlBase = process.env.PUBLIC_BASE_URL || process.env.MINI_APP_URL || baseUrl;

  if (!accountId || !apiKey || !appId) {
    return { error: 'VOX_ACCOUNT_ID, VOX_API_KEY, VOX_APP_ID must be set in env.' };
  }
  const toNormalized = normalizePhone(to);
  if (!toNormalized || toNormalized.length < 10) {
    return { error: 'Invalid phone number.' };
  }
  if (!baseUrl) {
    return { error: 'VOICE_DIALOG_BASE_URL or MINI_APP_URL must be set for dialog_url.' };
  }

  const callId = randomUUID();
  const dialogUrl = `${baseUrl}/voice/dialog`;
  const useStream = process.env.VOICE_USE_STREAM === 'true' || process.env.VOICE_USE_STREAM === '1';
  const streamUrl = useStream
    ? baseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/voice/stream'
    : undefined;
  const eventUrl = eventUrlBase ? `${eventUrlBase.replace(/\/$/, '')}/webhooks/vox` : '';

  const customData: Record<string, unknown> = {
    call_id: callId,
    to: toNormalized,
    event_url: eventUrl,
    caller_id: process.env.VOX_CALLER_ID ? normalizePhone(process.env.VOX_CALLER_ID) : undefined,
    tag: null,
    dialog_url: dialogUrl,
  };
  if (streamUrl) customData.stream_url = streamUrl;

  const formParams: Record<string, string> = {
    account_id: accountId,
    api_key: apiKey,
    application_id: appId,
    script_name: process.env.VOX_DIALOG_SCENARIO_NAME || 'voice_dialog',
    script_custom_data: JSON.stringify(customData),
    phone: toNormalized,
    output: 'json',
    rule_name: process.env.VOX_DIALOG_RULE_NAME || 'voice_dialog_rule',
  };

  const form = new URLSearchParams(formParams);

  try {
    const { statusCode, body } = await request(`${VOX_API_BASE}/StartScenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const text = await body.text();
    if (statusCode >= 400) {
      return { error: `Vox API HTTP ${statusCode}: ${text.slice(0, 200)}` };
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) {
        const msg = parsed.error.msg || JSON.stringify(parsed.error);
        return { error: `Vox API: ${msg}` };
      }
    } catch (_) {
      // ignore parse
    }
    const startedAt = new Date().toISOString();
    return { callId, startedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `StartScenarios failed: ${message}` };
  }
}
