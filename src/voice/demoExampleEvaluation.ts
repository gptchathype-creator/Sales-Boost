import { loadCar } from '../data/carLoader';
import { getDefaultState } from '../state/defaultState';
import { evaluateSessionV2 } from '../llm/evaluatorV2';
import { buildConversationPairs, generateCallSummary, generateReplyImprovements } from './callSummary';
import { computeUiDimensionScoresFromChecklist } from './uiDimensionScores';

export type DemoTranscriptTurn = { role: string; text: string };

const MAX_TURNS = 48;

/**
 * Полный путь как у завершённого voice-сессии: evaluatorV2 → сводка и план (LLM) → улучшения ответов (LLM).
 */
export async function evaluateDemoExampleFromTranscript(transcriptInput: DemoTranscriptTurn[]) {
  const turns = transcriptInput
    .map((t) => ({
      role: (t.role === 'manager' ? 'manager' : 'client') as 'client' | 'manager',
      text: String(t.text ?? '').trim(),
    }))
    .filter((t) => t.text);

  if (turns.length < 2) {
    throw new Error('Нужно минимум две непустые реплики.');
  }
  if (turns.length > MAX_TURNS) {
    throw new Error(`Слишком длинная стенограмма (макс. ${MAX_TURNS} реплик).`);
  }

  const dialogHistory = turns.map((t) => ({ role: t.role, content: t.text }));

  const car = loadCar();
  const state = getDefaultState('normal');
  const { evaluation } = await evaluateSessionV2({
    dialogHistory,
    car,
    state,
    earlyFail: false,
    behaviorSignals: [],
  });

  const checklistForSummary = evaluation.checklist.map((c) => ({
    code: c.code,
    status: c.status,
    comment: c.comment,
  }));

  const [callSummary, replyImprovements] = await Promise.all([
    generateCallSummary({
      transcript: turns,
      outcome: 'completed',
      totalScore: evaluation.overall_score_0_100,
      dimensionScores: evaluation.dimension_scores as unknown as Record<string, number>,
      issues: evaluation.issues,
      checklist: checklistForSummary,
      recommendations: evaluation.recommendations,
    }),
    (async () => {
      const pairs = buildConversationPairs(turns);
      if (pairs.length === 0) return [];
      return generateReplyImprovements({ pairs, limit: 12, issues: evaluation.issues });
    })(),
  ]);

  const dimensionScores = computeUiDimensionScoresFromChecklist(evaluation.checklist, evaluation.dimension_scores);

  const score = evaluation.overall_score_0_100;
  const qualityTag = score >= 76 ? 'Хорошо' : score >= 50 ? 'Средне' : 'Плохо';

  const strengths = evaluation.checklist
    .filter((c) => c.status === 'YES')
    .map((c) => (c.comment || c.code).trim())
    .filter(Boolean);
  const weaknesses = evaluation.issues.map((i) => i.recommendation).filter(Boolean);

  const durationSec = Math.max(30, Math.min(240, 20 + turns.length * 12));

  return {
    outcome: 'completed' as const,
    durationSec,
    totalScore: score,
    qualityTag,
    dimensionScores,
    strengths,
    weaknesses,
    recommendations: evaluation.recommendations,
    callSummary,
    replyImprovements,
    transcript: turns,
  };
}
