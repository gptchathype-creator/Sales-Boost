/**
 * Persist and evaluate voice call sessions when a call ends (webhook).
 * Uses same evaluation criteria as correspondence (evaluatorV2).
 */

import { prisma } from '../db';
import { getRecordByCallId, type TranscriptTurn } from './callHistory';
import { loadCar } from '../data/carLoader';
import { getDefaultState } from '../state/defaultState';
import { evaluateSessionV2 } from '../llm/evaluatorV2';

export type VoxWebhookEvent = 'progress' | 'connected' | 'disconnected' | 'failed' | 'busy' | 'no_answer';

export interface VoxWebhookPayload {
  call_id?: string;
  to?: string;
  event?: string;
  ts?: string;
  details?: Record<string, unknown> & { reason?: string; code?: number };
  /** Transcript from scenario (e.g. realtime_pure): [{ role: 'manager'|'client', text: string }] */
  transcript?: TranscriptTurn[] | unknown[];
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
  const payloadTranscript: TranscriptTurn[] =
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
  const transcript =
    payloadTranscript.length > 0 ? payloadTranscript : (record?.transcript ?? []);
  const transcriptJson = JSON.stringify(transcript);
  const transcriptSource = payloadTranscript.length > 0 ? 'webhook' : (record?.transcript?.length ? 'memory' : 'none');
  console.log('[voice/session] transcript', { callId, source: transcriptSource, turns: transcript.length });

  let evaluationJson: string | null = null;
  let totalScore: number | null = null;
  let failureReason: string | null = null;

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
      evaluationJson = JSON.stringify(evaluation);
      totalScore = evaluation.overall_score_0_100 ?? null;
    } catch (err) {
      console.error('[voice/session] evaluateSessionV2 error:', err instanceof Error ? err.message : err);
    }
  }

  const toNormalized = '+' + String(to).replace(/\D/g, '');
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
        transcriptJson,
        evaluationJson,
        totalScore,
        failureReason,
      },
      update: {
        endedAt,
        outcome,
        durationSec,
        transcriptJson,
        evaluationJson,
        totalScore,
        failureReason,
      },
    });
    console.log('[voice/session] saved VoiceCallSession', { callId, to: payload.to, outcome, durationSec, hasEval: !!evaluationJson });
  } catch (err) {
    console.error('[voice/session] prisma.voiceCallSession upsert error:', err instanceof Error ? err.message : err);
  }
}
