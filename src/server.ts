import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import type { Telegraf } from 'telegraf';
import { prisma } from './db';
import { config } from './config';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Get training session details
app.get('/api/admin/training-sessions/:sessionId', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const session = await prisma.trainingSession.findUnique({
      // Показываем как завершённые, так и досрочно прерванные тренировки
      where: { id: sessionId },
      include: {
        user: true,
        messages: { orderBy: { createdAt: 'asc' as const } },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const hasAssessment = session.assessmentScore != null && session.assessmentJson != null;
    const isFailed = session.status === 'failed';
    const data = hasAssessment ? JSON.parse(session.assessmentJson as string) : {};
    const score = hasAssessment ? (session.assessmentScore as number) : 0;
    const level = hasAssessment ? scoreToLevel(score) : null;
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

    const steps = (() => {
      const msgs = session.messages;
      const pairs: Array<{ order: number; customerMessage: string; answer: string }> = [];
      for (let i = 0; i + 1 < msgs.length; i += 2) {
        if (msgs[i].role === 'client' && msgs[i + 1].role === 'manager') {
          pairs.push({
            order: pairs.length + 1,
            customerMessage: msgs[i].content,
            answer: msgs[i + 1].content,
          });
        }
      }
      return pairs.map((p) => {
        const stepData = assessmentSteps.find((s) => s.step_order === p.order);

        // Если модель не вернула покомпонентную оценку для этого шага,
        // не оставляем "Н/Д": считаем, что ответ = 0/100 и даём общую рекомендацию.
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
              'Этот ответ не был отдельно оценён моделью, но по контексту считается слабым. ' +
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
    })();

    res.json({
      type: 'training',
      id: session.id,
      userName: session.user.fullName,
      testTitle: 'Тренировка с виртуальным клиентом',
      startedAt: session.createdAt,
      finishedAt: session.completedAt,
      totalScore: hasAssessment ? session.assessmentScore : isFailed ? 0 : null,
      level,
      qualityTag,
      strengths: [],
      weaknesses: data.mistakes || [],
      recommendations: data.improvements || [],
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
      const hasAssessment = s.assessmentScore != null && s.assessmentJson != null;
      const data = hasAssessment
        ? JSON.parse(s.assessmentJson as string)
        : { mistakes: [], improvements: [], quality: '' };
      const score = hasAssessment ? (s.assessmentScore as number) : 0;
      const isFailed = s.status === 'failed';

      let summary: string;
      if (isFailed) {
        const reason =
          s.failureReason === 'rude_language'
            ? 'Досрочно завершена системой из‑за недопустимой лексики.'
            : s.failureReason === 'ignored_questions'
              ? 'Досрочно завершена: менеджер игнорировал вопросы клиента.'
              : s.failureReason === 'poor_communication'
                ? 'Досрочно завершена: низкое качество коммуникации.'
                : 'Тренировка досрочно завершена системой.';
        summary = reason;
      } else {
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
        startedAt: s.createdAt,
        finishedAt: s.completedAt,
        totalScore: hasAssessment ? s.assessmentScore : isFailed ? 0 : null,
        level: hasAssessment ? scoreToLevel(score) : null,
        qualityTag: isFailed ? 'Плохо' : scoreToQualityTag(score),
        summary,
        evaluationError: null,
        strengths: [],
        weaknesses: (data.mistakes as string[]) || [],
        recommendations: (data.improvements as string[]) || [],
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

// Get team summary
app.get('/api/admin/summary', async (req, res) => {
  try {
    const attempts = await prisma.attempt.findMany({
      where: { status: 'completed', totalScore: { not: null } },
      include: {
        user: true,
      },
    });

    if (attempts.length === 0) {
      return res.json({
        totalAttempts: 0,
        avgScore: 0,
        levelCounts: { Junior: 0, Middle: 0, Senior: 0 },
        topWeaknesses: [],
        topStrengths: [],
        expertSummary: null,
      });
    }

    const totalScore = attempts.reduce((sum, a) => sum + (a.totalScore || 0), 0);
    const avgScore = totalScore / attempts.length;

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
      totalAttempts: attempts.length,
      avgScore,
      levelCounts,
      topWeaknesses,
      topStrengths,
      attempts: attempts.map(a => ({
        userName: a.user.fullName,
        score: a.totalScore || 0,
        level: a.level || '',
        strengths: a.strengthsJson ? JSON.parse(a.strengthsJson) : [],
        weaknesses: a.weaknessesJson ? JSON.parse(a.weaknessesJson) : [],
        recommendations: a.recommendationsJson ? JSON.parse(a.recommendationsJson) : [],
      })),
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

    res.json({
      totalAttempts: attempts.length,
      avgScore: Math.round(avgScore * 10) / 10,
      levelCounts,
      topWeaknesses,
      topStrengths,
      expertSummary,
    });
  } catch (error) {
    console.error('Get summary error:', error);
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
    const useTunnel = config.miniAppUrl.includes('trycloudflare.com') || config.miniAppUrl.includes('loca.lt') || config.miniAppUrl.includes('localtunnel.me');
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

    if (!useHttp && certPath && keyPath) {
      const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
      const httpsServer = https.createServer(options, app);
      httpsServer.on('error', onError);
      httpsServer.listen(port, host, () => {
        console.log('[OK] HTTPS server: http://localhost:' + port);
        console.log('     Mini App URL: ' + config.miniAppUrl);
        console.log('     (Self-signed cert - Telegram may show warning)');
        onListen();
      });
    } else {
      const httpServer = http.createServer(app);
      httpServer.on('error', onError);
      httpServer.listen(port, host, () => {
        console.log('[OK] HTTP server: http://localhost:' + port);
        console.log('     Open in browser: http://localhost:' + port);
        console.log('     Health: http://localhost:' + port + '/health');
        if (useTunnel) {
          console.log('     Tunnel will provide HTTPS for Telegram.');
        }
        onListen();
      });
    }
  });
}
