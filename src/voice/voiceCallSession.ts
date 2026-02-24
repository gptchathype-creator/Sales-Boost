/**
 * Persist and evaluate voice call sessions when a call ends (webhook).
 * Uses same evaluation criteria as correspondence (evaluatorV2).
 */

import { prisma } from '../db';
import { getRecordByCallId, type TranscriptTurn } from './callHistory';
import { loadCar } from '../data/carLoader';
import { getDefaultState } from '../state/defaultState';
import { evaluateSessionV2 } from '../llm/evaluatorV2';
import { getTranscriptFromVoxLog } from './voxLogTranscript';

export type VoxWebhookEvent = 'progress' | 'connected' | 'disconnected' | 'failed' | 'busy' | 'no_answer';

export interface VoxWebhookPayload {
  call_id?: string;
  to?: string;
  event?: string;
  ts?: string;
  details?: Record<string, unknown> & { reason?: string; code?: number };
  /** Transcript from scenario (e.g. realtime_pure): [{ role: 'manager'|'client', text: string }] */
  transcript?: TranscriptTurn[] | unknown[];
  /** Voximplant session id (from AppEvents.Started) — used to fetch session log and parse transcript if not sent */
  vox_session_id?: number;
}

function normalizeOutcome(event: string, details?: { reason?: string; code?: number }): string {
  if (event === 'no_answer' || event === 'busy' || event === 'failed') return event;
  if (event === 'disconnected') return 'disconnected';
  return 'completed';
}

function dialogHistoryFromTranscript(transcript: TranscriptTurn[]): Array<{ role: 'client' | 'manager'; content: string }> {
  return transcript.map((t) => ({
    role: t.role as 'client' | 'manager',
    content: t.text,
  }));
}

/**
 * Called when Vox sends event (e.g. disconnected). Persists session and runs evaluation if we have transcript.
 */
export async function finalizeVoiceCallSession(payload: VoxWebhookPayload): Promise<void> {
  const callId = payload.call_id;
  const to = payload.to;
  const event = (payload.event || 'disconnected') as VoxWebhookEvent;

  if (!callId || !to) {
    console.warn('[voice/session] finalizeVoiceCallSession: missing call_id or to', payload);
    return;
  }

  const record = getRecordByCallId(callId);
  const startedAt = record ? new Date(record.startedAt) : new Date();
  const endedAt = new Date();
  const durationSec = record ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000) : 0;
  const outcome = normalizeOutcome(event, payload.details);

  // Prefer transcript from webhook payload (e.g. realtime_pure sends it); fallback to in-memory record (dialog scenario)
  const rawPayloadTranscript = payload.transcript;
  let payloadTranscript: TranscriptTurn[] =
    Array.isArray(rawPayloadTranscript) &&
    rawPayloadTranscript.length > 0 &&
    rawPayloadTranscript.every(
      (t: unknown) =>
        typeof t === 'object' &&
        t !== null &&
        'role' in t &&
        'text' in t &&
        ((t as { role: string }).role === 'manager' || (t as { role: string }).role === 'client')
    )
      ? (rawPayloadTranscript as TranscriptTurn[])
      : [];

  const toNormalized = '+' + String(to).replace(/\D/g, '');

  // 1) Save session immediately so admin shows "Processing..." right after hangup
  const initialTranscript = payloadTranscript.length > 0 ? payloadTranscript : (record?.transcript ?? []);
  try {
    await prisma.voiceCallSession.upsert({
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
  } catch (err) {
    console.error('[voice/session] initial upsert error:', err instanceof Error ? err.message : err);
  }

  // 2) If transcript missing but we have vox_session_id (realtime_pure), fetch from Voximplant log and update
  let transcript: TranscriptTurn[] = initialTranscript;
  let transcriptSource: 'webhook' | 'memory' | 'vox_log' | 'none' =
    payloadTranscript.length > 0 ? 'webhook' : (record?.transcript?.length ? 'memory' : 'none');

  if (transcript.length === 0 && payload.vox_session_id != null) {
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const { transcript: logTranscript } = await getTranscriptFromVoxLog(payload.vox_session_id);
      if (logTranscript.length > 0) {
        transcript = logTranscript;
        transcriptSource = 'vox_log';
        await prisma.voiceCallSession.update({
          where: { callId },
          data: { transcriptJson: JSON.stringify(transcript) },
        });
      }
    } catch (err) {
      console.warn('[voice/session] getTranscriptFromVoxLog failed:', err instanceof Error ? err.message : err);
    }
  }

  console.log('[voice/session] transcript', { callId, source: transcriptSource, turns: transcript.length });

  // 3) Run evaluation (can take time) and update session when ready
  if (transcript.length >= 2) {
    try {
      const car = loadCar();
      const state = getDefaultState('normal');
      const dialogHistory = dialogHistoryFromTranscript(transcript);
      const { evaluation } = await evaluateSessionV2({
        dialogHistory,
        car,
        state,
        earlyFail: false,
        behaviorSignals: [],
      });

      const evaluationJson = JSON.stringify(evaluation);
      const totalScore = evaluation.overall_score_0_100 ?? null;

      await prisma.voiceCallSession.update({
        where: { callId },
        data: {
          evaluationJson,
          totalScore,
          failureReason: null,
        },
      });
      console.log('[voice/session] evaluation saved', { callId, totalScore });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[voice/session] evaluateSessionV2 error:', msg);
      try {
        await prisma.voiceCallSession.update({
          where: { callId },
          data: { failureReason: msg.slice(0, 200) },
        });
      } catch (_) {}
    }
  }
}
