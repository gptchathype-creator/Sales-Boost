/**
 * Fetch call session log from Voximplant and parse transcript from WebSocket messages.
 * Used when the scenario (e.g. realtime_pure) does not send transcript in the webhook:
 * we get it from the session log in the background without affecting call speed.
 */

import { request } from 'undici';
import type { TranscriptTurn } from './callHistory';

const VOX_API_BASE = 'https://api.voximplant.com/platform_api';

export interface GetTranscriptFromVoxLogResult {
  transcript: TranscriptTurn[];
  source: 'vox_log';
}

/**
 * Call Voximplant GetCallHistory for the given session id, fetch log_file_url, parse log for transcript.
 * Returns transcript array (manager/client) or empty array on any failure.
 */
export async function getTranscriptFromVoxLog(voxSessionId: number): Promise<GetTranscriptFromVoxLogResult> {
  const accountId = process.env.VOX_ACCOUNT_ID;
  const apiKey = process.env.VOX_API_KEY;

  if (!accountId || !apiKey) {
    console.warn('[voxLogTranscript] VOX_ACCOUNT_ID or VOX_API_KEY not set, skipping log fetch');
    return { transcript: [], source: 'vox_log' };
  }

  const form = new URLSearchParams({
    account_id: accountId,
    api_key: apiKey,
    call_session_history_id: String(voxSessionId),
    count: '1',
    with_calls: 'false',
    with_records: 'false',
    output: 'json',
  });

  let res: { statusCode: number; body: { text(): Promise<string> } };
  try {
    res = await request(`${VOX_API_BASE}/GetCallHistory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch (err) {
    console.warn('[voxLogTranscript] GetCallHistory request failed:', err instanceof Error ? err.message : err);
    return { transcript: [], source: 'vox_log' };
  }

  const text = await res.body.text();
  if (res.statusCode >= 400) {
    console.warn('[voxLogTranscript] GetCallHistory HTTP', res.statusCode, text.slice(0, 200));
    return { transcript: [], source: 'vox_log' };
  }

  let json: { result?: Array<{ log_file_url?: string }>; error?: { msg?: string } };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    console.warn('[voxLogTranscript] GetCallHistory response not JSON');
    return { transcript: [], source: 'vox_log' };
  }

  if (json.error) {
    console.warn('[voxLogTranscript] GetCallHistory error:', json.error.msg ?? json.error);
    return { transcript: [], source: 'vox_log' };
  }

  const logUrl = json.result?.[0]?.log_file_url;
  if (!logUrl || typeof logUrl !== 'string') {
    console.warn('[voxLogTranscript] No log_file_url in GetCallHistory result');
    return { transcript: [], source: 'vox_log' };
  }

  let logBody: string;
  try {
    const logRes = await request(logUrl, { method: 'GET' });
    logBody = await logRes.body.text();
    if (logRes.statusCode >= 400) {
      console.warn('[voxLogTranscript] Log fetch HTTP', logRes.statusCode);
      return { transcript: [], source: 'vox_log' };
    }
  } catch (err) {
    console.warn('[voxLogTranscript] Log fetch failed:', err instanceof Error ? err.message : err);
    return { transcript: [], source: 'vox_log' };
  }

  const transcript = parseTranscriptFromLogText(logBody);
  console.log('[voxLogTranscript] Parsed from log', { voxSessionId, turns: transcript.length });
  return { transcript, source: 'vox_log' };
}

/**
 * Parse Voximplant session log text: find WebSocket.Message lines with
 * ConversationItemDone (assistant/user) and ResponseOutputAudioTranscriptDone (assistant),
 * build ordered transcript (manager = user, client = assistant).
 */
function parseTranscriptFromLogText(logText: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  const seen = new Set<string>();

  const lines = logText.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes('ConversationItemDone') && !line.includes('ResponseOutputAudioTranscriptDone')) continue;

    let obj: { customEvent?: string; payload?: { item?: { role?: string; content?: Array<{ type?: string; transcript?: string }> }; transcript?: string } } | null = null;
    const jsonMatch = line.match(/\{[\s\S]*"customEvent"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        obj = JSON.parse(jsonMatch[0]) as typeof obj;
      } catch {
        continue;
      }
    }
    if (!obj?.payload && obj?.customEvent !== 'ResponseOutputAudioTranscriptDone') {
      const alt = line.match(/\{[\s\S]*"payload"[\s\S]*\}/);
      if (alt) {
        try {
          obj = JSON.parse(alt[0]) as typeof obj;
        } catch {
          // ignore
        }
      }
    }

    if (!obj) continue;

    const customEvent = obj.customEvent || '';

    if (customEvent === 'ResponseOutputAudioTranscriptDone' && obj.payload?.transcript != null) {
      const text = String(obj.payload.transcript).trim();
      if (text) {
        const key = `client:${text.slice(0, 50)}`;
        if (!seen.has(key)) {
          seen.add(key);
          turns.push({ role: 'client', text });
        }
      }
      continue;
    }

    if (customEvent === 'ConversationItemDone' && obj.payload?.item) {
      const item = obj.payload.item;
      const role = item.role === 'user' ? 'manager' : item.role === 'assistant' ? 'client' : null;
      if (!role) continue;
      const contents = Array.isArray(item.content) ? item.content : [];
      for (const c of contents) {
        if (c?.type === 'input_audio') continue;
        const transcript = (c as { transcript?: string })?.transcript;
        if (transcript != null && typeof transcript === 'string') {
          const text = transcript.trim();
          if (text) {
            const key = `${role}:${text.slice(0, 50)}`;
            if (!seen.has(key)) {
              seen.add(key);
              turns.push({ role: role as 'manager' | 'client', text });
            }
          }
        }
      }
    }
  }

  return turns;
}
