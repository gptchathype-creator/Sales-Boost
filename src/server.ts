import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import type { Telegraf } from 'telegraf';
import { WebSocketServer } from 'ws';
import { prisma } from './db';
import { config } from './config';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleVoiceDialog } from './voice/voiceDialog';
import { handleVoiceStreamMessage } from './voice/voiceStream';
import { addCall, getCallHistory, getTestNumbers } from './voice/callHistory';
import { startVoiceCall } from './voice/startVoiceCall';
import { finalizeVoiceCallSession } from './voice/voiceCallSession';

// ---- In-memory cache for admin analytics (Team / Voice dashboard) ----
type TeamSummaryCache = {
  totalAttempts: number;
  avgScore: number;
  levelCounts: { Junior: number; Middle: number; Senior: number };
  topWeaknesses: { weakness: string; count: number }[];
  topStrengths: { strength: string; count: number }[];
  expertSummary: unknown;
};

type VoiceDashboardCache = {
  totalCalls: number;
  answeredPercent: number;
  missedPercent: number;
  avgDurationSec: number;
  outcomeBreakdown: {
    completed: number;
    no_answer: number;
    busy: number;
    failed: number;
    disconnected: number;
  };
};

const ANALYTICS_TTL_MS = 5 * 60 * 1000; // 5 minutes

let teamSummaryCache: { data: TeamSummaryCache | null; expiresAt: number } = {
  data: null,
  expiresAt: 0,
};

let voiceDashboardCache: { data: VoiceDashboardCache | null; expiresAt: number } = {
  data: null,
  expiresAt: 0,
};
import { getTunnelUrl } from './tunnel';

const app = express();

/** Path for Telegram webhook (production). Call registerTelegramWebhook(bot) before startServer(). */
export const WEBHOOK_PATH = '/telegram-webhook';

export function registerTelegramWebhook(bot: Telegraf): void {
  app.post(WEBHOOK_PATH, async (req, res) => {
    try {
      if (!req.body) {
        console.error('[WEBHOOK] No body');
        return res.status(400).end();
      }
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error('[WEBHOOK] Error:', err);
      res.status(500).end();
    }
  });
}
app.use(express.json());

// Resolve absolute path to public/index.html (works for tsx and compiled)
function getIndexPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'public', 'index.html'),
    path.resolve(__dirname, '..', 'public', 'index.html'),
    path.resolve(__dirname, '..', '..', 'public', 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const INDEX_HTML_PATH = getIndexPath();

/** Only show attempts that were properly evaluated (have score, evaluation result, or error) — excludes empty force-closed sessions */
const completedWithDataWhere = {
  status: 'completed' as const,
  OR: [
    { totalScore: { not: null } },
    { evaluationResultJson: { not: null } },
    { evaluationError: { not: null } },
  ],
};

if (!INDEX_HTML_PATH) {
  console.error('[ERROR] public/index.html not found. Checked:', path.resolve(process.cwd(), 'public'), path.resolve(__dirname, '..', 'public'));
} else {
  console.log('[OK] Mini App index:', INDEX_HTML_PATH);
}

// Static files
const publicPath = path.resolve(process.cwd(), 'public');
const publicPathAlt = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicPath));
if (publicPathAlt !== publicPath) {
  app.use(express.static(publicPathAlt));
}

// Friendly error page (Russian)
function sendErrorHtml(res: express.Response, status: number, title: string, message: string) {
  res.status(status).type('html').send(`
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sales Boost</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:20px;background:#1a1a2e;color:#eee;">
<h1 style="color:#fff;">${title}</h1>
<p>${message}</p>
<p style="color:#888;font-size:14px;">Проверьте, что бот запущен (npm run dev) и туннель активен. Откройте /admin в боте снова.</p>
</body></html>
  `);
}

// Health check: verify server is running (e.g. curl http://localhost:3000/health)
app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Sales Boost server is running' });
});

// Voice call dialog: Voximplant scenario sends ASR text here, we return LLM reply for TTS
app.post('/voice/dialog', (req, res) => {
  console.log('[voice/dialog] POST received');
  handleVoiceDialog(req, res).catch((err) => {
    console.error('[voice/dialog] Unhandled:', err);
    res.status(500).json({ error: 'Internal error', reply_text: 'Здравствуйте, произошла ошибка. Попробуйте позже.', end_session: false });
  });
});

// Explicit root: always serve Mini App
app.get('/', (req, res) => {
  if (INDEX_HTML_PATH) {
    try {
      return res.sendFile(INDEX_HTML_PATH);
    } catch (err) {
      console.error('Error sending index.html:', err);
      sendErrorHtml(res, 500, 'Ошибка загрузки', 'Не удалось отдать страницу приложения. См. логи сервера.');
      return;
    }
  }
  sendErrorHtml(res, 404, 'Файл не найден', 'Файл public/index.html не найден. Убедитесь, что папка public и index.html есть в проекте.');
});

// API endpoint to verify admin and get data
app.get('/api/admin/verify', async (req, res) => {
  try {
    const { initData } = req.query;
    const isLocalhost = ['127.0.0.1', '::1', 'localhost'].includes(req.ip || '') ||
      (req.get('host') || '').startsWith('localhost');

    // Dev bypass: on localhost with ALLOW_DEV_ADMIN=true, allow without Telegram
    if (!initData && config.allowDevAdmin && isLocalhost) {
      return res.json({
        success: true,
        user: { id: 'dev', username: 'dev', firstName: 'Локальный доступ (dev)' },
      });
    }

    if (!initData) {
      return res.status(401).json({
        error: 'Нет данных авторизации. Откройте панель через кнопку «Открыть Админ-панель» в чате с ботом (напишите /admin). В браузере напрямую панель не авторизуется.',
      });
    }

    const params = new URLSearchParams(initData as string);
    const userStr = params.get('user');
    if (!userStr) {
      return res.status(401).json({ error: 'Неверные данные Telegram. Откройте панель из чата с ботом (/admin).' });
    }

    const user = JSON.parse(userStr);
    const telegramId = user.id?.toString();
    const username = user.username?.toLowerCase();

    if (!telegramId) {
      return res.status(401).json({ error: 'Не удалось определить пользователя.' });
    }

    const isAdmin = config.adminIdentifiers.includes(telegramId) ||
      (username && (
        config.adminIdentifiers.includes(username) ||
        config.adminIdentifiers.includes(`@${username}`)
      ));

    if (!isAdmin) {
      return res.status(403).json({ error: 'Нет доступа. Ваш Telegram не в списке администраторов (ADMIN_TELEGRAM_IDS в .env).' });
    }

    res.json({
      success: true,
      user: {
        id: telegramId,
        username: user.username,
        firstName: user.first_name,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Ошибка сервера. Попробуйте позже.' });
  }
});

// Get training session details (V2 evaluation-aware)
app.get('/api/admin/training-sessions/:sessionId', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        user: true,
        messages: { orderBy: { createdAt: 'asc' as const } },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const isFailed = session.status === 'failed';
    const hasV2Eval = session.evaluationJson != null;
    const hasLegacyAssessment = session.assessmentScore != null && session.assessmentJson != null;

    // Build conversation steps from messages (sequential pairs)
    const msgs = session.messages;
    const conversationPairs: Array<{ order: number; customerMessage: string; answer: string }> = [];
    for (let i = 0; i + 1 < msgs.length; i += 2) {
      if (msgs[i].role === 'client' && msgs[i + 1].role === 'manager') {
        conversationPairs.push({
          order: conversationPairs.length + 1,
          customerMessage: msgs[i].content,
          answer: msgs[i + 1].content,
        });
      }
    }

    // Collect behavior signals from manager messages (V2)
    const managerMsgs = msgs.filter(m => m.role === 'manager' && m.qualitySignalJson);
    let behaviorSummary: any = null;
    if (managerMsgs.length > 0) {
      let toxicCount = 0;
      let lowEffortCount = 0;
      let evasionCount = 0;
      const allProhibited: string[] = [];
      for (const m of managerMsgs) {
        try {
          const sig = JSON.parse(m.qualitySignalJson!);
          if (sig.toxic) toxicCount++;
          if (sig.low_effort) lowEffortCount++;
          if (sig.evasion) evasionCount++;
          if (Array.isArray(sig.prohibited_phrase_hits)) allProhibited.push(...sig.prohibited_phrase_hits);
        } catch { /* skip */ }
      }
      behaviorSummary = {
        totalManagerMessages: managerMsgs.length,
        toxicCount,
        lowEffortCount,
        evasionCount,
        prohibitedPhrases: [...new Set(allProhibited)],
      };
    }

    if (hasV2Eval) {
      // ── V2 evaluation response ──
      const evalData = JSON.parse(session.evaluationJson as string);
      const score = evalData.overall_score_0_100 ?? session.totalScore ?? 0;
      const level = scoreToLevel(score);
      const qualityTag = isFailed ? 'Плохо' : scoreToQualityTag(score);

      const checklistItems = Array.isArray(evalData.checklist) ? evalData.checklist : [];
      const issues = Array.isArray(evalData.issues) ? evalData.issues : [];
      const recommendations = Array.isArray(evalData.recommendations) ? evalData.recommendations : [];

      const steps = conversationPairs.map((p) => {
        return {
          order: p.order,
          customerMessage: p.customerMessage,
          answer: p.answer,
          score: null,
          feedback: null,
          betterExample: null,
          criteriaScores: {} as Record<string, number>,
        };
      });

      return res.json({
        type: 'training',
        id: session.id,
        userName: session.user.fullName,
        testTitle: 'Тренировка с виртуальным клиентом',
        clientProfile: (session as any).clientProfile ?? 'normal',
        startedAt: session.createdAt,
        finishedAt: session.completedAt,
        totalScore: score,
        level,
        qualityTag,
        failureReason: session.failureReason,
        failureReasonLabel: isFailed ? getFailureReasonLabel(session.failureReason) : null,
        dimensionScores: evalData.dimension_scores ?? null,
        checklist: checklistItems,
        issues,
        strengths: checklistItems
          .filter((c: any) => c.status === 'YES')
          .map((c: any) => c.comment || c.code),
        weaknesses: issues.map((i: any) => i.recommendation || i.issue_type),
        recommendations,
        behaviorSummary,
        steps,
      });
    }

    // ── Legacy assessment fallback ──
    const data = hasLegacyAssessment ? JSON.parse(session.assessmentJson as string) : {};
    const score = hasLegacyAssessment ? (session.assessmentScore as number) : 0;
    const level = hasLegacyAssessment ? scoreToLevel(score) : null;
    const qualityTag = isFailed ? 'Плохо' : scoreToQualityTag(score);
    const assessmentSteps = (data.steps || []) as Array<{
      step_order: number;
      step_score: number;
      feedback?: string;
      better_example?: string;
    }>;
    const globalImprovements: string[] = Array.isArray(data.improvements)
      ? (data.improvements as string[])
      : [];

    const steps = conversationPairs.map((p) => {
      const stepData = assessmentSteps.find((s) => s.step_order === p.order);
      if (!stepData) {
        const genericImprovement =
          globalImprovements[0] ||
          'Ответить подробнее и сфокусироваться на пользе для клиента и следующем шаге.';
        return {
          order: p.order,
          customerMessage: p.customerMessage,
          answer: p.answer,
          score: 0,
          feedback:
            'Этот ответ не был отдельно оценён моделью. ' +
            `Общая рекомендация: ${genericImprovement}`,
          betterExample: genericImprovement,
          criteriaScores: {} as Record<string, number>,
        };
      }
      return {
        order: p.order,
        customerMessage: p.customerMessage,
        answer: p.answer,
        score: stepData.step_score ?? 0,
        feedback: stepData.feedback ?? null,
        betterExample: stepData.better_example ?? null,
        criteriaScores: {} as Record<string, number>,
      };
    });

    res.json({
      type: 'training',
      id: session.id,
      userName: session.user.fullName,
      testTitle: 'Тренировка с виртуальным клиентом',
      clientProfile: (session as any).clientProfile ?? 'normal',
      startedAt: session.createdAt,
      finishedAt: session.completedAt,
      totalScore: hasLegacyAssessment ? session.assessmentScore : isFailed ? 0 : null,
      level,
      qualityTag,
      failureReason: session.failureReason,
      failureReasonLabel: isFailed ? getFailureReasonLabel(session.failureReason) : null,
      dimensionScores: null,
      checklist: [],
      issues: [],
      strengths: [],
      weaknesses: data.mistakes || [],
      recommendations: data.improvements || [],
      behaviorSummary,
      steps,
    });
  } catch (error) {
    console.error('Get training session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single attempt details with full feedback (must come before /api/admin/attempts)
app.get('/api/admin/attempts/:attemptId', async (req, res) => {
  try {
    const attemptId = parseInt(req.params.attemptId);
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        user: true,
        test: true,
        answers: {
          include: {
            step: true,
          },
          orderBy: {
            step: {
              order: 'asc',
            },
          },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Only serve attempts with meaningful data (exclude empty force-closed sessions)
    const hasData =
      attempt.totalScore != null ||
      attempt.evaluationResultJson != null ||
      attempt.evaluationError != null;
    if (!hasData) {
      return res.status(404).json({ error: 'Attempt has no evaluation data' });
    }

    let steps: Array<{
      order: number;
      customerMessage: string;
      stepGoal?: string;
      answer: string;
      score: number | null;
      feedback: string | null;
      betterExample: string | null;
      criteriaScores: Record<string, number>;
    }>;

    if (attempt.answers.length > 0) {
      steps = attempt.answers.map(answer => ({
        order: answer.step.order,
        customerMessage: answer.step.customerMessage,
        stepGoal: answer.step.stepGoal,
        answer: answer.answerText,
        score: answer.stepScore,
        feedback: answer.feedback,
        betterExample: answer.betterExample,
        criteriaScores: answer.criteriaScoresJson ? JSON.parse(answer.criteriaScoresJson) : {},
      }));
    } else if (attempt.evaluationResultJson && attempt.conversationHistoryJson) {
      const history: Array<{ role: string; text: string }> = JSON.parse(attempt.conversationHistoryJson);
      const evalResult = JSON.parse(attempt.evaluationResultJson);
      const pairs: Array<{ customerMessage: string; answer: string }> = [];
      for (let i = 0; i + 1 < history.length; i += 2) {
        if (history[i].role === 'client' && history[i + 1].role === 'manager') {
          pairs.push({ customerMessage: history[i].text, answer: history[i + 1].text });
        }
      }
      steps = (evalResult.steps || []).map((s: { step_order: number; step_score: number; feedback?: string; better_example?: string; criteria?: Record<string, number> }, idx: number) => {
        const pair = pairs[idx] || { customerMessage: '', answer: '' };
        return {
          order: s.step_order,
          customerMessage: pair.customerMessage,
          answer: pair.answer,
          score: s.step_score,
          feedback: s.feedback ?? null,
          betterExample: s.better_example ?? null,
          criteriaScores: s.criteria ?? {},
        };
      });
    } else {
      steps = [];
    }

    const score = attempt.totalScore ?? 0;
    res.json({
      id: attempt.id,
      userName: attempt.user.fullName,
      testTitle: attempt.test.title,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      totalScore: attempt.totalScore,
      level: attempt.level,
      qualityTag: scoreToQualityTag(score),
      evaluationError: attempt.evaluationError,
      strengths: attempt.strengthsJson ? JSON.parse(attempt.strengthsJson) : [],
      weaknesses: attempt.weaknessesJson ? JSON.parse(attempt.weaknessesJson) : [],
      recommendations: attempt.recommendationsJson ? JSON.parse(attempt.recommendationsJson) : [],
      suspicionFlags: attempt.suspicionFlagsJson ? JSON.parse(attempt.suspicionFlagsJson) : [],
      steps,
    });
  } catch (error) {
    console.error('Get attempt details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: derive level from score (for backward compatibility)
function scoreToLevel(score: number): string {
  if (score < 40) return 'Junior';
  if (score < 70) return 'Middle';
  return 'Senior';
}

// Quality tag for conversation result (one word)
function scoreToQualityTag(score: number): string {
  if (score < 50) return 'Плохо';
  if (score < 76) return 'Средне';
  return 'Хорошо';
}

function getFailureReasonLabel(reason?: string | null): string {
  if (!reason) return 'Тренировка досрочно завершена';
  const base = reason.split(':')[0];
  const map: Record<string, string> = {
    PROFANITY: 'Недопустимая лексика',
    BAD_TONE: 'Грубый / враждебный тон',
    IGNORED_QUESTIONS: 'Игнорирование вопросов клиента',
    POOR_COMMUNICATION: 'Низкое качество коммуникации',
    REPEATED_LOW_EFFORT: 'Повторные некачественные ответы',
    rude_language: 'Недопустимая лексика',
    ignored_questions: 'Игнорирование вопросов клиента',
    poor_communication: 'Низкое качество коммуникации',
    repeated_low_effort: 'Повторные некачественные ответы',
  };
  if (map[base]) return map[base];
  if (base === 'CRITICAL_EVASION' || base === 'critical_evasion') {
    const topic = reason.split(':')[1] ?? '';
    return `Критический вопрос проигнорирован (${topic})`;
  }
  return 'Тренировка досрочно завершена';
}

// Short summary for card (from assessment or built from strengths/weaknesses)
function buildCardSummary(
  type: 'attempt' | 'training',
  data: { quality?: string; strengths?: string[]; weaknesses?: string[]; recommendations?: string[]; mistakes?: string[]; improvements?: string[] }
): string {
  if (type === 'training' && data.quality?.trim()) {
    return data.quality;
  }
  const parts: string[] = [];
  if (data.strengths?.length) parts.push(data.strengths[0]);
  if (data.weaknesses?.length) parts.push(data.weaknesses[0]);
  if (data.mistakes?.length) parts.push(data.mistakes[0]);
  if (data.recommendations?.length && parts.length < 2) parts.push(data.recommendations[0]);
  if (data.improvements?.length && parts.length < 2) parts.push(data.improvements[0]);
  return parts.slice(0, 2).join('. ') || 'Краткая оценка диалога.';
}

// Get attempts + training sessions merged (for Employees tab)
app.get('/api/admin/attempts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 1000;

    const [attempts, trainingSessions] = await Promise.all([
      prisma.attempt.findMany({
        where: completedWithDataWhere,
        include: {
          user: true,
          test: true,
          answers: {
            include: { step: true },
            orderBy: { step: { order: 'asc' as const } },
          },
        },
        orderBy: { finishedAt: 'desc' },
      }),
      prisma.trainingSession.findMany({
        where: {
          status: { in: ['completed', 'failed'] },
          OR: [
            { assessmentScore: { not: null } },
            { failureReason: { not: null } },
          ],
        },
        include: { user: true },
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    const attemptItems = attempts.map(a => {
      const strengths = a.strengthsJson ? JSON.parse(a.strengthsJson) : [];
      const weaknesses = a.weaknessesJson ? JSON.parse(a.weaknessesJson) : [];
      const recommendations = a.recommendationsJson ? JSON.parse(a.recommendationsJson) : [];
      const score = a.totalScore ?? 0;
      return {
        type: 'attempt' as const,
        id: a.id,
        userName: a.user.fullName,
        testTitle: a.test.title,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
        totalScore: a.totalScore,
        level: a.level,
        qualityTag: scoreToQualityTag(score),
        summary: buildCardSummary('attempt', { strengths, weaknesses, recommendations }),
        evaluationError: a.evaluationError,
        strengths,
        weaknesses,
        recommendations,
        steps: a.answers.map(ans => ({
          order: ans.step.order,
          customerMessage: ans.step.customerMessage,
          answer: ans.answerText,
          score: ans.stepScore,
          feedback: ans.feedback,
        })),
      };
    });

    const trainingItems = trainingSessions.map(s => {
      const hasV2Eval = s.evaluationJson != null;
      const hasLegacyAssessment = s.assessmentScore != null && s.assessmentJson != null;
      const isFailed = s.status === 'failed';

      let score = 0;
      let weaknesses: string[] = [];
      let recommendations: string[] = [];
      let dimensionScores = null;

      if (hasV2Eval) {
        const evalData = JSON.parse(s.evaluationJson as string);
        score = evalData.overall_score_0_100 ?? s.totalScore ?? 0;
        weaknesses = Array.isArray(evalData.issues)
          ? evalData.issues.map((i: any) => i.recommendation || i.issue_type)
          : [];
        recommendations = Array.isArray(evalData.recommendations) ? evalData.recommendations : [];
        dimensionScores = evalData.dimension_scores ?? null;
      } else if (hasLegacyAssessment) {
        const data = JSON.parse(s.assessmentJson as string);
        score = s.assessmentScore as number;
        weaknesses = Array.isArray(data.mistakes) ? data.mistakes : [];
        recommendations = Array.isArray(data.improvements) ? data.improvements : [];
      }

      const failReasonLabels: Record<string, string> = {
        rude_language: 'Досрочно завершена: недопустимая лексика.',
        ignored_questions: 'Досрочно завершена: менеджер игнорировал вопросы.',
        poor_communication: 'Досрочно завершена: низкое качество коммуникации.',
        repeated_low_effort: 'Досрочно завершена: повторные некачественные ответы.',
        PROFANITY: 'Досрочно завершена: недопустимая лексика.',
        BAD_TONE: 'Досрочно завершена: грубый / враждебный тон.',
        IGNORED_QUESTIONS: 'Досрочно завершена: менеджер игнорировал вопросы.',
        POOR_COMMUNICATION: 'Досрочно завершена: низкое качество коммуникации.',
        REPEATED_LOW_EFFORT: 'Досрочно завершена: повторные некачественные ответы.',
      };
      const baseReason = (s.failureReason ?? '').split(':')[0];

      let summary: string;
      if (isFailed) {
        summary = failReasonLabels[baseReason]
          ?? (baseReason === 'critical_evasion' || baseReason === 'CRITICAL_EVASION'
            ? `Досрочно завершена: критический вопрос проигнорирован (${(s.failureReason ?? '').split(':')[1] ?? ''}).`
            : 'Тренировка досрочно завершена системой.');
      } else if (hasV2Eval) {
        summary = `Балл: ${score}/100`;
      } else {
        const data = hasLegacyAssessment ? JSON.parse(s.assessmentJson as string) : {};
        summary = buildCardSummary('training', {
          quality: data.quality,
          mistakes: data.mistakes,
          improvements: data.improvements,
        });
      }

      return {
        type: 'training' as const,
        id: `t-${s.id}`,
        sessionId: s.id,
        userName: s.user.fullName,
        testTitle: 'Тренировка с виртуальным клиентом',
        clientProfile: (s as any).clientProfile ?? 'normal',
        startedAt: s.createdAt,
        finishedAt: s.completedAt,
        totalScore: score,
        level: scoreToLevel(score),
        qualityTag: isFailed ? 'Плохо' : scoreToQualityTag(score),
        summary,
        evaluationError: null,
        strengths: [],
        weaknesses,
        recommendations,
        dimensionScores,
        steps: [],
      };
    });

    const merged = [...attemptItems, ...trainingItems].sort((a, b) => {
      const dateA = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const dateB = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return dateB - dateA;
    });

    const total = merged.length;
    const page = 0;
    const paginated = merged.slice(0, limit);

    res.json({
      attempts: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get attempts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team summary (training & attempts) with in-memory snapshot cache
app.get('/api/admin/summary', async (req, res) => {
  try {
    const now = Date.now();
    if (teamSummaryCache.data && teamSummaryCache.expiresAt > now) {
      return res.json(teamSummaryCache.data);
    }

    const [attempts, trainingSessions] = await Promise.all([
      prisma.attempt.findMany({
        where: { status: 'completed', totalScore: { not: null } },
        include: {
          user: true,
        },
      }),
      prisma.trainingSession.findMany({
        where: {
          status: { in: ['completed', 'failed'] },
          OR: [
            { assessmentScore: { not: null } },
            { failureReason: { not: null } },
          ],
        },
        include: {
          user: true,
        },
      }),
    ]);

    const totalItems = attempts.length + trainingSessions.length;

    if (totalItems === 0) {
      const empty: TeamSummaryCache = {
        totalAttempts: 0,
        avgScore: 0,
        levelCounts: { Junior: 0, Middle: 0, Senior: 0 },
        topWeaknesses: [],
        topStrengths: [],
        expertSummary: null,
      };
      teamSummaryCache = { data: empty, expiresAt: now + ANALYTICS_TTL_MS };
      return res.json(empty);
    }

    const totalScoreAttempts = attempts.reduce((sum, a) => sum + (a.totalScore || 0), 0);
    const totalScoreTrainings = trainingSessions.reduce((sum, s) => {
      if (s.totalScore != null) return sum + s.totalScore;
      if (s.evaluationJson != null) {
        try {
          const evalData = JSON.parse(s.evaluationJson);
          if (typeof evalData.overall_score_0_100 === 'number') return sum + evalData.overall_score_0_100;
        } catch { /* skip */ }
      }
      if (s.assessmentScore != null) return sum + s.assessmentScore;
      if (s.status === 'failed') return sum;
      return sum;
    }, 0);

    const totalScore = totalScoreAttempts + totalScoreTrainings;
    const avgScore = totalItems > 0 ? totalScore / totalItems : 0;

    const levelCounts = {
      Junior: 0,
      Middle: 0,
      Senior: 0,
    };

    const allWeaknesses: Record<string, number> = {};
    const allStrengths: Record<string, number> = {};

    attempts.forEach((attempt) => {
      if (attempt.level) {
        levelCounts[attempt.level as keyof typeof levelCounts]++;
      }
      if (attempt.weaknessesJson) {
        const weaknesses = JSON.parse(attempt.weaknessesJson);
        weaknesses.forEach((w: string) => {
          allWeaknesses[w] = (allWeaknesses[w] || 0) + 1;
        });
      }
      if (attempt.strengthsJson) {
        const strengths = JSON.parse(attempt.strengthsJson);
        strengths.forEach((s: string) => {
          allStrengths[s] = (allStrengths[s] || 0) + 1;
        });
      }
    });

    trainingSessions.forEach((s) => {
      const hasV2Eval = s.evaluationJson != null;
      if (hasV2Eval) {
        try {
          const evalData = JSON.parse(s.evaluationJson as string);
          const issues: any[] = Array.isArray(evalData.issues) ? evalData.issues : [];
          const recs: string[] = Array.isArray(evalData.recommendations) ? evalData.recommendations : [];
          const checklistItems: any[] = Array.isArray(evalData.checklist) ? evalData.checklist : [];
          issues.forEach((i: any) => {
            const text = i.recommendation || i.issue_type || '';
            if (text) allWeaknesses[text] = (allWeaknesses[text] || 0) + 1;
          });
          recs.forEach((r: string) => {
            if (r) allStrengths[r] = (allStrengths[r] || 0) + 1;
          });
          checklistItems
            .filter((c: any) => c.status === 'YES')
            .forEach((c: any) => {
              const text = c.comment || c.code;
              if (text) allStrengths[text] = (allStrengths[text] || 0) + 1;
            });
        } catch { /* skip malformed JSON */ }
      } else if (s.assessmentJson) {
        const data = JSON.parse(s.assessmentJson) as {
          mistakes?: string[];
          improvements?: string[];
          quality?: string;
        };
        const mistakes = Array.isArray(data.mistakes) ? data.mistakes : [];
        const improvements = Array.isArray(data.improvements) ? data.improvements : [];
        mistakes.forEach((w: string) => {
          allWeaknesses[w] = (allWeaknesses[w] || 0) + 1;
        });
        improvements.forEach((r: string) => {
          allStrengths[r] = (allStrengths[r] || 0) + 1;
        });
      }
    });

    const topWeaknesses = Object.entries(allWeaknesses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([weakness, count]) => ({ weakness, count }));

    const topStrengths = Object.entries(allStrengths)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([strength, count]) => ({ strength, count }));

    // Prepare data for expert summary
    const teamData = {
      totalAttempts: totalItems,
      avgScore,
      levelCounts,
      topWeaknesses,
      topStrengths,
      attempts: [
        ...attempts.map(a => ({
          userName: a.user.fullName,
          score: a.totalScore || 0,
          level: a.level || '',
          strengths: a.strengthsJson ? JSON.parse(a.strengthsJson) : [],
          weaknesses: a.weaknessesJson ? JSON.parse(a.weaknessesJson) : [],
          recommendations: a.recommendationsJson ? JSON.parse(a.recommendationsJson) : [],
        })),
        ...trainingSessions.map(s => {
          let score = 0;
          let weaknesses: string[] = [];
          let recommendations: string[] = [];
          let strengths: string[] = [];

          if (s.evaluationJson) {
            try {
              const evalData = JSON.parse(s.evaluationJson);
              score = evalData.overall_score_0_100 ?? s.totalScore ?? s.assessmentScore ?? 0;
              weaknesses = Array.isArray(evalData.issues)
                ? evalData.issues.map((i: any) => i.recommendation || i.issue_type)
                : [];
              recommendations = Array.isArray(evalData.recommendations) ? evalData.recommendations : [];
              strengths = Array.isArray(evalData.checklist)
                ? evalData.checklist.filter((c: any) => c.status === 'YES').map((c: any) => c.comment || c.code)
                : [];
            } catch { /* skip */ }
          } else if (s.assessmentJson) {
            const data = JSON.parse(s.assessmentJson) as { mistakes?: string[]; improvements?: string[] };
            score = s.assessmentScore ?? 0;
            weaknesses = data.mistakes || [];
            recommendations = data.improvements || [];
          }

          return {
            userName: s.user.fullName,
            score,
            level: scoreToLevel(score),
            strengths,
            weaknesses,
            recommendations,
          };
        }),
      ],
    };

    // Generate expert summary
    let expertSummary = null;
    try {
      const { generateExpertTeamSummary } = await import('./team-summary');
      expertSummary = await generateExpertTeamSummary(teamData);
    } catch (error) {
      console.error('Error generating expert summary:', error);
      // Continue without expert summary if generation fails
    }

    const payload: TeamSummaryCache = {
      totalAttempts: totalItems,
      avgScore: Math.round(avgScore * 10) / 10,
      levelCounts,
      topWeaknesses,
      topStrengths,
      expertSummary,
    };
    teamSummaryCache = { data: payload, expiresAt: now + ANALYTICS_TTL_MS };
    res.json(payload);
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Voice calls dashboard (telephony availability) with in-memory snapshot cache
app.get('/api/admin/voice-dashboard', async (_req, res) => {
  try {
    const now = Date.now();
    if (voiceDashboardCache.data && voiceDashboardCache.expiresAt > now) {
      return res.json(voiceDashboardCache.data);
    }

    const calls = await prisma.voiceCallSession.findMany();
    if (!calls.length) {
      const empty: VoiceDashboardCache = {
        totalCalls: 0,
        answeredPercent: 0,
        missedPercent: 0,
        avgDurationSec: 0,
        outcomeBreakdown: {
          completed: 0,
          no_answer: 0,
          busy: 0,
          failed: 0,
          disconnected: 0,
        },
      };
      voiceDashboardCache = { data: empty, expiresAt: now + ANALYTICS_TTL_MS };
      return res.json(empty);
    }

    const breakdown: VoiceDashboardCache['outcomeBreakdown'] = {
      completed: 0,
      no_answer: 0,
      busy: 0,
      failed: 0,
      disconnected: 0,
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const c of calls) {
      const key = (c.outcome || 'disconnected') as keyof typeof breakdown;
      if (breakdown[key] !== undefined) {
        breakdown[key] += 1;
      } else {
        breakdown.disconnected += 1;
      }
      if (typeof c.durationSec === 'number' && c.durationSec > 0) {
        totalDuration += c.durationSec;
        durationCount += 1;
      }
    }

    const total = calls.length;
    const answered = breakdown.completed;
    const missed = total - answered;
    const answeredPercent = total > 0 ? Math.round((answered / total) * 100) : 0;
    const missedPercent = total > 0 ? Math.round((missed / total) * 100) : 0;
    const avgDurationSec = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

    const payload: VoiceDashboardCache = {
      totalCalls: total,
      answeredPercent,
      missedPercent,
      avgDurationSec,
      outcomeBreakdown: breakdown,
    };
    voiceDashboardCache = { data: payload, expiresAt: now + ANALYTICS_TTL_MS };
    res.json(payload);
  } catch (error) {
    console.error('Get voice-dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get OpenAI usage/expenses for current period
app.get('/api/admin/expenses', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const startTime = Math.floor(startOfMonth.getTime() / 1000);
    const endTime = Math.floor(endOfMonth.getTime() / 1000);

    let totalSpentUsd = 0;
    let error: string | null = null;

    try {
      const https = await import('https');
      const response = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
        const url = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}&limit=31`;
        const apiKey = config.openaiApiKey;
        if (!apiKey) {
          reject(new Error('OPENAI_API_KEY not configured'));
          return;
        }
        const req = https.get(url, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }, (resp) => {
          let data = '';
          resp.on('data', (chunk) => { data += chunk; });
          resp.on('end', () => resolve({ statusCode: resp.statusCode || 0, data }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });

      if (response.statusCode === 200) {
        const json = JSON.parse(response.data);
        const buckets = json.data || [];
        for (const bucket of buckets) {
          const results = bucket.results || [];
          for (const r of results) {
            const amount = r.amount;
            if (amount && typeof amount.value === 'number') {
              totalSpentUsd += amount.value;
            }
          }
        }
      } else {
        try {
          const errJson = response.data ? JSON.parse(response.data) : {};
          error = errJson.error?.message || `API returned ${response.statusCode}`;
        } catch {
          error = `API returned ${response.statusCode}`;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      error = msg;
      if (msg.includes('401') || msg.includes('403') || msg.includes('organization')) {
        error = 'Требуется ключ организации (Organization API key) для доступа к данным расходов. Используйте platform.openai.com для просмотра.';
      }
    }

    res.json({
      periodStart: startOfMonth.toISOString(),
      periodEnd: endOfMonth.toISOString(),
      totalSpentUsd: Math.round(totalSpentUsd * 100) / 100,
      currency: 'USD',
      error,
      billingUrl: 'https://platform.openai.com/account/billing',
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get managers list
app.get('/api/admin/managers', async (req, res) => {
  try {
    const managers = await prisma.user.findMany({
      where: { role: 'manager' },
      include: {
        attempts: {
          where: completedWithDataWhere,
          orderBy: { finishedAt: 'desc' },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({
      managers: managers.map(manager => ({
        id: manager.id,
        name: manager.fullName,
        telegramId: manager.telegramId,
        attemptsCount: manager.attempts.length,
        latestAttempt: manager.attempts[0] ? {
          id: manager.attempts[0].id,
          finishedAt: manager.attempts[0].finishedAt,
          score: manager.attempts[0].totalScore,
          level: manager.attempts[0].level,
        } : null,
      })),
    });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get manager attempts
app.get('/api/admin/managers/:managerId/attempts', async (req, res) => {
  try {
    const managerId = parseInt(req.params.managerId);
    const attempts = await prisma.attempt.findMany({
      where: {
        userId: managerId,
        ...completedWithDataWhere,
      },
      include: {
        test: true,
        answers: {
          include: {
            step: true,
          },
          orderBy: {
            step: {
              order: 'asc',
            },
          },
        },
      },
      orderBy: { finishedAt: 'desc' },
    });

    res.json({
      attempts: attempts.map(attempt => ({
        id: attempt.id,
        testTitle: attempt.test.title,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
        totalScore: attempt.totalScore,
        level: attempt.level,
        strengths: attempt.strengthsJson ? JSON.parse(attempt.strengthsJson) : [],
        weaknesses: attempt.weaknessesJson ? JSON.parse(attempt.weaknessesJson) : [],
        recommendations: attempt.recommendationsJson ? JSON.parse(attempt.recommendationsJson) : [],
        steps: attempt.answers.map(answer => ({
          order: answer.step.order,
          customerMessage: answer.step.customerMessage,
          answer: answer.answerText,
          score: answer.stepScore,
          feedback: answer.feedback,
        })),
      })),
    });
  } catch (error) {
    console.error('Get manager attempts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: diagnose voice env (no secrets — only presence). Uses live tunnel URL when available.
app.get('/api/admin/voice-env-check', (_req, res) => {
  const VOX_ACCOUNT_ID = !!process.env.VOX_ACCOUNT_ID?.trim();
  const VOX_API_KEY = !!process.env.VOX_API_KEY?.trim();
  const VOX_APP_ID = !!process.env.VOX_APP_ID?.trim();
  const VOX_CALLER_ID = !!process.env.VOX_CALLER_ID?.trim();
  const tunnelLive = !!getTunnelUrl()?.trim();
  const baseUrlFromEnv = !!(process.env.VOICE_DIALOG_BASE_URL || process.env.MINI_APP_URL || process.env.PUBLIC_BASE_URL)?.trim();
  const baseUrl = tunnelLive || baseUrlFromEnv;
  const voxKeys = Object.keys(process.env).filter((k) => k.startsWith('VOX_') || k.startsWith('VOICE_'));
  res.json({
    ok: VOX_ACCOUNT_ID && VOX_API_KEY && VOX_APP_ID && baseUrl,
    VOX_ACCOUNT_ID,
    VOX_API_KEY,
    VOX_APP_ID,
    VOX_CALLER_ID,
    VOICE_DIALOG_BASE_URL_or_MINI_APP_URL: baseUrl,
    tunnel_live: tunnelLive,
    voxAndVoiceKeysInProcess: voxKeys.sort(),
  });
});

// Admin: test numbers for Call tab (from .env)
app.get('/api/admin/test-numbers', (_req, res) => {
  try {
    const numbers = getTestNumbers();
    res.json({ numbers });
  } catch (err) {
    console.error('test-numbers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: start voice call (Voximplant)
app.post('/api/admin/start-voice-call', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const toRaw = body.to != null ? String(body.to).trim() : null;
    const numbers = getTestNumbers();
    const defaultTo = numbers.length > 0 ? numbers[0] : null;
    const to = toRaw || defaultTo;
    if (!to) {
      return res.status(400).json({
        error: 'Укажите номер (to) или задайте VOX_TEST_TO / VOX_TEST_NUMBERS в .env.',
      });
    }
    const scenario = (body.scenario === 'realtime' || body.scenario === 'realtime_pure' || body.scenario === 'dialog') ? body.scenario : undefined;
    const result = await startVoiceCall(to, { scenario });
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    addCall(result.callId, to);
    const toNormalized = '+' + String(to).replace(/\D/g, '');
    try {
      await prisma.voiceCallSession.create({
        data: {
          callId: result.callId,
          to: toNormalized,
          scenario: result.scenario ?? 'dialog',
          startedAt: new Date(result.startedAt),
        },
      });
    } catch (e) {
      console.warn('[voice] VoiceCallSession create (may already exist):', e instanceof Error ? e.message : e);
    }
    res.json({ callId: result.callId, startedAt: result.startedAt, to, scenario: result.scenario });
  } catch (err) {
    console.error('start-voice-call error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Voximplant webhook: call events (disconnected, failed, no_answer, busy)
app.post('/webhooks/vox', async (req, res) => {
  res.status(200).end();
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const event = payload.event || payload.event_type;
  const hasTranscript = Array.isArray(payload.transcript);
  console.log('[webhooks/vox] received', { event, callId: payload.call_id, keys: Object.keys(payload), transcriptTurns: hasTranscript ? payload.transcript.length : 0 });
  if (['disconnected', 'failed', 'no_answer', 'busy'].includes(event)) {
    finalizeVoiceCallSession(payload).catch((err) => {
      console.error('[webhooks/vox] finalizeVoiceCallSession error:', err instanceof Error ? err.message : err);
    });
  }
});

// Admin: call history from DB (persisted; same phone = multiple cards)
app.get('/api/admin/call-history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const sessions = await prisma.voiceCallSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    const calls = sessions.map((s) => {
      const transcript = s.transcriptJson
        ? (JSON.parse(s.transcriptJson) as Array<{ role: string; text: string }>)
        : [];
      const hasEvaluation = !!s.evaluationJson;
      const ended = !!s.endedAt;
      const endedAtMs = s.endedAt ? s.endedAt.getTime() : null;
      const ageSec = endedAtMs != null ? (Date.now() - endedAtMs) / 1000 : null;
      const isRecent = ageSec != null && ageSec >= 0 && ageSec < 120;
      // Avoid "stuck processing" forever when there is no transcript: only show processing for recent ended calls.
      const isProcessing = ended && !hasEvaluation && !s.failureReason && (transcript.length >= 2 || isRecent);
      const processingStage = ended && !hasEvaluation && isProcessing
        ? (transcript.length >= 2 ? 'evaluation' : 'transcript')
        : null;
      return {
        id: s.id,
        callId: s.callId,
        to: s.to,
        scenario: s.scenario,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        outcome: s.outcome,
        durationSec: s.durationSec,
        transcript,
        transcriptTurns: transcript.length,
        totalScore: s.totalScore,
        hasEvaluation,
        isProcessing,
        processingStage,
        processingError: s.failureReason,
      };
    });
    res.json({ calls });
  } catch (err) {
    console.error('call-history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: one call session detail (for card open: checklist, recommendations, transcript)
app.get('/api/admin/call-history/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const session = await prisma.voiceCallSession.findFirst({
      where: { id },
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const transcript = session.transcriptJson
      ? (JSON.parse(session.transcriptJson) as Array<{ role: string; text: string }>)
      : [];
    let evaluation: Record<string, unknown> | null = null;
    if (session.evaluationJson) {
      try {
        evaluation = JSON.parse(session.evaluationJson) as Record<string, unknown>;
      } catch (_) {}
    }
    const score = session.totalScore ?? (evaluation && typeof (evaluation as any).overall_score_0_100 === 'number' ? (evaluation as any).overall_score_0_100 : null);
    const checklist = evaluation && Array.isArray((evaluation as any).checklist) ? (evaluation as any).checklist : [];
    const issues = evaluation && Array.isArray((evaluation as any).issues) ? (evaluation as any).issues : [];
    const recommendations = evaluation && Array.isArray((evaluation as any).recommendations) ? (evaluation as any).recommendations : [];
    const dimensionScores = evaluation && (evaluation as any).dimension_scores ? (evaluation as any).dimension_scores : null;
    const qualityTag = score != null ? (score >= 76 ? 'Хорошо' : score >= 50 ? 'Средне' : 'Плохо') : null;
    res.json({
      id: session.id,
      callId: session.callId,
      to: session.to,
      scenario: session.scenario,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      outcome: session.outcome,
      durationSec: session.durationSec,
      transcript,
      transcriptTurns: transcript.length,
      hasEvaluation: !!session.evaluationJson,
      isProcessing: (() => {
        const ended = !!session.endedAt;
        const hasEval = !!session.evaluationJson;
        const endedAtMs = session.endedAt ? session.endedAt.getTime() : null;
        const ageSec = endedAtMs != null ? (Date.now() - endedAtMs) / 1000 : null;
        const isRecent = ageSec != null && ageSec >= 0 && ageSec < 120;
        return ended && !hasEval && !session.failureReason && (transcript.length >= 2 || isRecent);
      })(),
      processingStage: (() => {
        const ended = !!session.endedAt;
        const hasEval = !!session.evaluationJson;
        const endedAtMs = session.endedAt ? session.endedAt.getTime() : null;
        const ageSec = endedAtMs != null ? (Date.now() - endedAtMs) / 1000 : null;
        const isRecent = ageSec != null && ageSec >= 0 && ageSec < 120;
        const isProcessing = ended && !hasEval && !session.failureReason && (transcript.length >= 2 || isRecent);
        if (!ended || hasEval || !isProcessing) return null;
        return transcript.length >= 2 ? 'evaluation' : 'transcript';
      })(),
      processingError: session.failureReason,
      totalScore: score,
      qualityTag,
      dimensionScores,
      checklist,
      issues,
      recommendations,
      strengths: checklist.filter((c: any) => c.status === 'YES').map((c: any) => c.comment || c.code),
      weaknesses: issues.map((i: any) => (i.recommendation || i.issue_type) || ''),
    });
  } catch (err) {
    console.error('call-history/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fallback: for any non-API GET request, serve Mini App (so /index.html etc. work)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (INDEX_HTML_PATH) {
    try {
      return res.sendFile(INDEX_HTML_PATH);
    } catch (err) {
      console.error('Error sending index.html (fallback):', err);
    }
  }
  next();
});

// Final 404: friendly message instead of plain "Not Found"
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Маршрут не найден', path: req.path });
  }
  sendErrorHtml(
    res,
    404,
    'Страница не найдена',
    `Запрошенный адрес «${req.path}» не найден. Mini App открывается по корневому адресу (/) — проверьте URL в настройках бота.`
  );
});

export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Try multiple paths for certificates (dev and production)
    const possibleCertPaths = [
      path.join(process.cwd(), 'cert.pem'),
      path.join(__dirname, '../../cert.pem'),
      path.join(__dirname, '../cert.pem'),
    ];
    const possibleKeyPaths = [
      path.join(process.cwd(), 'key.pem'),
      path.join(__dirname, '../../key.pem'),
      path.join(__dirname, '../key.pem'),
    ];

    let certPath: string | null = null;
    let keyPath: string | null = null;

    for (const cp of possibleCertPaths) {
      if (fs.existsSync(cp)) {
        certPath = cp;
        break;
      }
    }

    for (const kp of possibleKeyPaths) {
      if (fs.existsSync(kp)) {
        keyPath = kp;
        break;
      }
    }

    // For tunnel (Cloudflare), always use HTTP - tunnel provides HTTPS
    // When miniAppUrl is localhost, always use HTTP so the site loads in browser immediately
    const useTunnel = config.miniAppUrl.includes('trycloudflare.com') || config.miniAppUrl.includes('loca.lt') || config.miniAppUrl.includes('localtunnel.me') || config.miniAppUrl.includes('serveo') || config.miniAppUrl.includes('lhr.life');
    const isLocalhost = config.miniAppUrl.includes('localhost') || config.miniAppUrl.includes('127.0.0.1');
    const useHttp = useTunnel || isLocalhost || !certPath || !keyPath || !config.miniAppUrl.startsWith('https://');

    const onListen = () => {
      resolve();
    };

    const host = '0.0.0.0'; // listen on all interfaces (Railway requires this)
    const port = parseInt(process.env.PORT || String(config.port), 10);

    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error('[ERROR] Port ' + port + ' is already in use.');
        console.error('        Stop the other process or use another port: PORT=3002 npm run dev');
      } else {
        console.error('[ERROR] Server error:', err);
      }
      reject(err);
    };

    function attachVoiceStream(server: http.Server | https.Server): void {
      const wss = new WebSocketServer({ noServer: true });
      wss.on('connection', (ws, _req) => {
        console.log('[voice/stream] Client connected, waiting for message');
        ws.on('message', (data: Buffer | string) => {
          handleVoiceStreamMessage(ws, data.toString());
        });
      });
      server.on('upgrade', (request, socket, head) => {
        if (request.url?.startsWith('/voice/stream')) {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        } else {
          socket.destroy();
        }
      });
    }

    if (!useHttp && certPath && keyPath) {
      const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
      const httpsServer = https.createServer(options, app);
      attachVoiceStream(httpsServer);
      httpsServer.on('error', onError);
      httpsServer.listen(port, host, () => {
        console.log('[OK] HTTPS server: http://localhost:' + port);
        console.log('     Mini App URL: ' + config.miniAppUrl);
        console.log('     (Self-signed cert - Telegram may show warning)');
        onListen();
      });
    } else {
      const httpServer = http.createServer(app);
      attachVoiceStream(httpServer);
      httpServer.on('error', onError);
      httpServer.listen(port, host, () => {
        console.log('[OK] HTTP server: http://localhost:' + port);
        console.log('     Open in browser: http://localhost:' + port);
        console.log('     Health: http://localhost:' + port + '/health');
        console.log('     Voice stream: ws://localhost:' + port + '/voice/stream');
        if (useTunnel) {
          console.log('     Tunnel will provide HTTPS for Telegram.');
        }
        onListen();
      });
    }
  });
}
