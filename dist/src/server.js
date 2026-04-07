"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBHOOK_PATH = void 0;
exports.registerTelegramWebhook = registerTelegramWebhook;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const ws_1 = require("ws");
const db_1 = require("./db");
const config_1 = require("./config");
const path_1 = __importDefault(require("path"));
const voiceDialog_1 = require("./voice/voiceDialog");
const voiceStream_1 = require("./voice/voiceStream");
const callHistory_1 = require("./voice/callHistory");
const startVoiceCall_1 = require("./voice/startVoiceCall");
const voiceCallSession_1 = require("./voice/voiceCallSession");
const demoExampleEvaluation_1 = require("./voice/demoExampleEvaluation");
const uiDimensionScores_1 = require("./voice/uiDimensionScores");
const callBatchOrchestrator_1 = require("./voice/callBatchOrchestrator");
const defaultState_1 = require("./state/defaultState");
const virtualClient_1 = require("./llm/virtualClient");
const carLoader_1 = require("./data/carLoader");
const virtualClient_2 = require("./llm/virtualClient");
const tts_1 = require("./voice/tts");
const stt_1 = require("./voice/stt");
const behaviorClassifier_1 = require("./logic/behaviorClassifier");
const dealershipDirectory_1 = require("./super-admin/dealershipDirectory");
const http_2 = require("./auth/http");
const organizationManagement_1 = require("./auth/organizationManagement");
const userManagement_1 = require("./auth/userManagement");
const topicStateMachine_1 = require("./logic/topicStateMachine");
const ANALYTICS_TTL_MS = 5 * 60 * 1000; // 5 minutes
let teamSummaryCache = {
    data: null,
    expiresAt: 0,
};
let voiceDashboardCache = {
    data: null,
    expiresAt: 0,
};
const tunnel_1 = require("./tunnel");
const dealershipCallSource_1 = require("./voice/dealershipCallSource");
const app = (0, express_1.default)();
/** Path for Telegram webhook (production). Call registerTelegramWebhook(bot) before startServer(). */
exports.WEBHOOK_PATH = '/telegram-webhook';
function registerTelegramWebhook(bot) {
    app.post(exports.WEBHOOK_PATH, async (req, res) => {
        try {
            if (!req.body) {
                console.error('[WEBHOOK] No body');
                return res.status(400).end();
            }
            await bot.handleUpdate(req.body, res);
        }
        catch (err) {
            console.error('[WEBHOOK] Error:', err);
            res.status(500).end();
        }
    });
}
app.use(express_1.default.json({ limit: '12mb' }));
const webTrainingSessions = new Map();
function createWebSessionId() {
    return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function normalizeRu(text) {
    return text.toLowerCase().replace(/[ё]/g, 'е').replace(/\s+/g, ' ').trim();
}
const HARD_RUDE_PATTERNS = [
    'пошел на',
    'пошел ты',
    'пошла ты',
    'да пошел ты',
    'иди на',
    'заткнись',
    'отвали',
    'мне насрать',
    'мне плевать',
    'сами разбирайтесь',
    'закрой рот',
    'не твое дело',
    'достал',
    'задолбал',
];
function isHardRude(text) {
    const n = normalizeRu(text);
    return HARD_RUDE_PATTERNS.some((p) => n.includes(p));
}
function shouldForceConversationEnd(clientMessage) {
    const n = normalizeRu(clientMessage);
    return (n.includes('не готов продолжать разговор') ||
        n.includes('на этом, пожалуй, закончим') ||
        n.includes('видимо, сейчас не лучшее время') ||
        n.includes('пожалуй, обращусь в другой салон') ||
        n.includes('всего доброго') ||
        n.includes('до свидания'));
}
async function runWebTrainingTurn(params) {
    const { sessionId, message, replyMode, ttsVoice } = params;
    const sess = webTrainingSessions.get(sessionId);
    if (!sess) {
        throw new Error('SESSION_NOT_FOUND');
    }
    const { car, strictness } = sess;
    const state = { ...sess.state };
    const historyBefore = [...sess.dialogHistory];
    const history = [...historyBefore, { role: 'manager', content: message }];
    const max_client_turns = state.strictnessState?.max_client_turns ?? 12;
    const behavior = (0, behaviorClassifier_1.classifyBehavior)(message, {
        lastClientQuestion: [...historyBefore].reverse().find((m) => m.role === 'client')?.content,
        isClientWaitingAnswer: true,
    });
    const hardRude = isHardRude(message);
    const behaviorSignals = [...sess.behaviorSignals, behavior];
    if (behavior.toxic || hardRude || behavior.disengaging) {
        const toxicReply = behavior.disengaging
            ? 'Понимаю. Не буду больше отвлекать. Спасибо за время, всего доброго.'
            : behavior.severity === 'HIGH' || hardRude
                ? 'Извините, но я не готов продолжать разговор в таком тоне. Всего доброго.'
                : 'Мне бы хотелось более уважительного общения. На этом, пожалуй, закончим.';
        const newHistory = [...history, { role: 'client', content: toxicReply }];
        const result = buildWebTrainingResult(state, newHistory, behaviorSignals, true, behavior.disengaging ? 'DISENGAGEMENT' : 'BAD_TONE');
        webTrainingSessions.delete(sessionId);
        return { clientMessage: toxicReply, endConversation: true, audioBase64: null, result };
    }
    if (behavior.low_effort)
        state.low_effort_streak = (state.low_effort_streak ?? 0) + 1;
    else
        state.low_effort_streak = 0;
    const lowQualityStreak = behaviorSignals.reduce((acc, s) => (s.low_quality ? acc + 1 : 0), 0);
    if ((state.low_effort_streak ?? 0) >= 3 || lowQualityStreak >= 2) {
        const failReply = 'Я задаю конкретные вопросы и хотел бы получать развёрнутые ответы. Видимо, сейчас не лучшее время. До свидания.';
        const newHistory = [...history, { role: 'client', content: failReply }];
        const result = buildWebTrainingResult(state, newHistory, behaviorSignals, true, lowQualityStreak >= 2 ? 'REPEATED_LOW_QUALITY' : 'REPEATED_LOW_EFFORT');
        webTrainingSessions.delete(sessionId);
        return { clientMessage: failReply, endConversation: true, audioBase64: null, result };
    }
    const out = await (0, virtualClient_2.getVirtualClientReply)({
        car,
        dealership: (0, virtualClient_1.buildDealershipFromCar)(car),
        state,
        manager_last_message: message,
        dialog_history: history,
        strictness,
        max_client_turns,
        behaviorSignal: behavior,
        maxResponseTokens: 220,
    });
    state.phase = out.diagnostics.current_phase;
    let topicMap = { ...state.topics };
    for (const code of out.diagnostics.topics_addressed) {
        if (!topicMap[code])
            continue;
        const currentStatus = topicMap[code].status;
        const next = currentStatus === 'none' ? 'asked' : currentStatus === 'asked' ? 'answered' : currentStatus;
        const result = (0, topicStateMachine_1.advanceTopic)(topicMap, code, next);
        if (result.valid)
            topicMap = result.map;
    }
    for (const code of out.diagnostics.topics_evaded) {
        if (!topicMap[code])
            continue;
        topicMap = (0, topicStateMachine_1.recordEvasion)(topicMap, code);
    }
    state.topics = topicMap;
    const nextState = {
        ...state,
        stage: out.update_state.stage,
        checklist: { ...state.checklist, ...out.update_state.checklist },
        notes: out.update_state.notes,
        client_turns: out.update_state.client_turns,
    };
    const newHistory = [...history, { role: 'client', content: out.client_message }];
    const evasionCheck = (0, topicStateMachine_1.checkCriticalEvasions)(topicMap);
    if (evasionCheck.shouldFail) {
        const evasionReply = 'Я дважды задал важный вопрос и не получил ответа. Пожалуй, обращусь в другой салон.';
        const failHistory = [...history, { role: 'client', content: evasionReply }];
        const result = buildWebTrainingResult(nextState, failHistory, behaviorSignals, true, `CRITICAL_EVASION:${evasionCheck.failedTopic}`);
        webTrainingSessions.delete(sessionId);
        return { clientMessage: evasionReply, endConversation: true, audioBase64: null, result };
    }
    const endConversation = Boolean(out.end_conversation) || shouldForceConversationEnd(out.client_message);
    const result = endConversation
        ? buildWebTrainingResult(nextState, newHistory, behaviorSignals, false, null)
        : null;
    if (endConversation) {
        webTrainingSessions.delete(sessionId);
    }
    else {
        webTrainingSessions.set(sessionId, {
            ...sess,
            state: nextState,
            dialogHistory: newHistory,
            behaviorSignals,
        });
    }
    let audioBase64 = null;
    if (replyMode === 'text+voice' && out.client_message.trim()) {
        try {
            const buf = await (0, tts_1.generateSpeechBuffer)(out.client_message, ttsVoice);
            if (buf.length)
                audioBase64 = buf.toString('base64');
        }
        catch (e) {
            console.error('[web-training] TTS turn error:', e);
        }
    }
    return {
        clientMessage: out.client_message,
        endConversation,
        audioBase64,
        result,
    };
}
function buildWebTrainingResult(state, history, behaviorSignals, forcedFail, reasonCode) {
    const toxicCount = behaviorSignals.filter((s) => s.toxic).length;
    const lowEffortCount = behaviorSignals.filter((s) => s.low_effort).length;
    const evasionCount = behaviorSignals.filter((s) => s.evasion).length;
    const highSeverityCount = behaviorSignals.filter((s) => s.severity === 'HIGH').length;
    const prohibitedUnique = new Set(behaviorSignals.flatMap((s) => s.prohibited_phrase_hits)).size;
    const turns = history.filter((m) => m.role === 'manager').length;
    const criticalEvasion = behaviorSignals.some((s) => s.evasion) && String(reasonCode || '').startsWith('CRITICAL_EVASION');
    let score = 82;
    score -= toxicCount * 28;
    score -= lowEffortCount * 12;
    score -= evasionCount * 10;
    score -= highSeverityCount * 10;
    score -= prohibitedUnique * 6;
    if (turns >= 4)
        score += 5;
    if (turns >= 7)
        score += 3;
    if (forcedFail)
        score = Math.min(score, toxicCount > 0 ? 18 : criticalEvasion ? 28 : 35);
    score = Math.max(0, Math.min(100, Math.round(score)));
    const verdict = forcedFail || score < 60 ? 'fail' : 'pass';
    const qualityTag = score >= 80 ? 'Хорошо' : score >= 60 ? 'Средне' : 'Нужно улучшить';
    const strengths = [];
    if (toxicCount === 0)
        strengths.push('Корректный тон общения');
    if (lowEffortCount <= 1)
        strengths.push('Ответы в основном содержательные');
    if (evasionCount === 0)
        strengths.push('Не уходили от ключевых вопросов клиента');
    if (!strengths.length)
        strengths.push('Диалог состоялся, можно улучшать качество обработки возражений');
    const weaknesses = [];
    if (lowEffortCount > 0)
        weaknesses.push(`Короткие/слабые ответы: ${lowEffortCount}`);
    if (evasionCount > 0)
        weaknesses.push(`Уход от вопросов клиента: ${evasionCount}`);
    if (prohibitedUnique > 0)
        weaknesses.push('Использовались нежелательные формулировки');
    if (toxicCount > 0)
        weaknesses.push('Нарушен тон коммуникации');
    if (!weaknesses.length)
        weaknesses.push('Существенных провалов в коммуникации не обнаружено');
    const recommendations = [];
    if (lowEffortCount > 0)
        recommendations.push('Давать развёрнутый ответ на каждый вопрос клиента');
    if (evasionCount > 0)
        recommendations.push('Не уходить от прямых вопросов, сначала закрывать их');
    if (prohibitedUnique > 0)
        recommendations.push('Убрать фразы вроде "посмотрите на сайте"/"я не знаю"');
    if (toxicCount > 0)
        recommendations.push('Сохранять вежливый и уважительный тон в любых ситуациях');
    if (!recommendations.length)
        recommendations.push('Поддерживать текущий уровень и фокусироваться на закрытии на следующий шаг');
    const summary = verdict === 'pass'
        ? 'Тестирование завершено успешно. Менеджер удержал диалог и дал приемлемые ответы.'
        : 'Тестирование завершено с отрицательным результатом. Качество ответов и ведения диалога требует улучшения.';
    return {
        verdict,
        totalScore: score,
        qualityTag,
        summary,
        strengths,
        weaknesses,
        recommendations,
        reasonCode,
    };
}
// Resolve absolute path to public/index.html (works for tsx and compiled)
function getIndexPath() {
    const candidates = [
        path_1.default.resolve(process.cwd(), 'public', 'index.html'),
        path_1.default.resolve(__dirname, '..', 'public', 'index.html'),
        path_1.default.resolve(__dirname, '..', '..', 'public', 'index.html'),
    ];
    for (const p of candidates) {
        if (fs_1.default.existsSync(p))
            return p;
    }
    return null;
}
const INDEX_HTML_PATH = getIndexPath();
/** Only show attempts that were properly evaluated (have score, evaluation result, or error) — excludes empty force-closed sessions */
const completedWithDataWhere = {
    status: 'completed',
    OR: [
        { totalScore: { not: null } },
        { evaluationResultJson: { not: null } },
        { evaluationError: { not: null } },
    ],
};
if (!INDEX_HTML_PATH) {
    console.error('[ERROR] public/index.html not found. Checked:', path_1.default.resolve(process.cwd(), 'public'), path_1.default.resolve(__dirname, '..', 'public'));
}
else {
    console.log('[OK] Mini App index:', INDEX_HTML_PATH);
}
// Static files
const publicPath = path_1.default.resolve(process.cwd(), 'public');
const publicPathAlt = path_1.default.resolve(__dirname, '..', 'public');
app.use(express_1.default.static(publicPath));
if (publicPathAlt !== publicPath) {
    app.use(express_1.default.static(publicPathAlt));
}
// Friendly error page (Russian)
function sendErrorHtml(res, status, title, message) {
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
function buildVoiceCallDetailResponse(session) {
    const transcript = session.transcriptJson
        ? JSON.parse(session.transcriptJson)
        : [];
    let evaluation = null;
    if (session.evaluationJson) {
        try {
            evaluation = JSON.parse(session.evaluationJson);
        }
        catch (_) { }
    }
    const callSummary = evaluation && evaluation.call_summary && typeof evaluation.call_summary === 'object'
        ? evaluation.call_summary
        : null;
    const replyImprovements = evaluation && Array.isArray(evaluation.reply_improvements)
        ? evaluation.reply_improvements
        : null;
    const score = session.totalScore ?? (evaluation && typeof evaluation.overall_score_0_100 === 'number'
        ? evaluation.overall_score_0_100
        : null);
    const checklist = evaluation && Array.isArray(evaluation.checklist) ? evaluation.checklist : [];
    const issues = evaluation && Array.isArray(evaluation.issues) ? evaluation.issues : [];
    const recommendations = evaluation && Array.isArray(evaluation.recommendations) ? evaluation.recommendations : [];
    const dimensionScoresRaw = evaluation && evaluation.dimension_scores ? evaluation.dimension_scores : null;
    const dimensionScores = Array.isArray(checklist) && checklist.length > 0
        ? (0, uiDimensionScores_1.computeUiDimensionScoresFromChecklist)(checklist, dimensionScoresRaw)
        : dimensionScoresRaw;
    const qualityTag = score != null ? (score >= 76 ? 'Хорошо' : score >= 50 ? 'Средне' : 'Плохо') : null;
    const ended = !!session.endedAt;
    const hasEval = !!session.evaluationJson;
    const endedAtMs = session.endedAt ? session.endedAt.getTime() : null;
    const ageSec = endedAtMs != null ? (Date.now() - endedAtMs) / 1000 : null;
    const isRecent = ageSec != null && ageSec >= 0 && ageSec < 120;
    const isProcessing = ended && !hasEval && !session.failureReason && (transcript.length >= 2 || isRecent);
    const processingStage = !ended || hasEval || !isProcessing ? null : (transcript.length >= 2 ? 'evaluation' : 'transcript');
    return {
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
        isProcessing,
        processingStage,
        processingError: session.failureReason,
        totalScore: score,
        qualityTag,
        dimensionScores,
        checklist,
        issues,
        recommendations,
        callSummary,
        replyImprovements,
        strengths: checklist.filter((c) => c.status === 'YES').map((c) => c.comment || c.code),
        weaknesses: issues.map((i) => (i.recommendation || i.issue_type) || ''),
    };
}
// Health check: verify server is running (e.g. curl http://localhost:3000/health)
app.get('/health', (_req, res) => {
    res.json({ ok: true, message: 'Sales Boost server is running' });
});
// Voice call dialog: Voximplant scenario sends ASR text here, we return LLM reply for TTS
app.post('/voice/dialog', (req, res) => {
    console.log('[voice/dialog] POST received');
    (0, voiceDialog_1.handleVoiceDialog)(req, res).catch((err) => {
        console.error('[voice/dialog] Unhandled:', err);
        res.status(500).json({ error: 'Internal error', reply_text: 'Здравствуйте, произошла ошибка. Попробуйте позже.', end_session: false });
    });
});
// ── Web training API: start session ──
app.post('/api/training/web/start', async (req, res) => {
    try {
        const body = req.body || {};
        const strictness = (body.strictness ?? 'medium');
        const profile = (body.profile ?? 'normal');
        const replyMode = (body.replyMode ?? 'text');
        const ttsVoice = (body.voice ?? 'male');
        const car = (0, carLoader_1.loadCar)();
        const baseState = (0, defaultState_1.getDefaultState)(profile);
        const max_client_turns = strictness === 'low' ? 8 : strictness === 'high' ? 14 : baseState.strictnessState.max_client_turns;
        const state = {
            ...baseState,
            strictnessState: { strictness, max_client_turns },
        };
        const sessionId = createWebSessionId();
        const dealership = (0, virtualClient_1.buildDealershipFromCar)(car);
        const out = await (0, virtualClient_2.getVirtualClientReply)({
            car,
            dealership,
            state,
            manager_last_message: '',
            dialog_history: [],
            strictness,
            max_client_turns,
        });
        const nextState = {
            ...state,
            stage: out.update_state.stage,
            checklist: { ...state.checklist, ...out.update_state.checklist },
            notes: out.update_state.notes,
            client_turns: out.update_state.client_turns,
        };
        webTrainingSessions.set(sessionId, {
            id: sessionId,
            strictness,
            profile,
            state: nextState,
            car,
            dialogHistory: [{ role: 'client', content: out.client_message }],
            behaviorSignals: [],
        });
        let audioBase64 = null;
        if (replyMode === 'text+voice' && out.client_message.trim()) {
            try {
                const buf = await (0, tts_1.generateSpeechBuffer)(out.client_message, ttsVoice);
                if (buf.length) {
                    audioBase64 = buf.toString('base64');
                }
            }
            catch (e) {
                console.error('[web-training] TTS start error:', e);
            }
        }
        res.json({
            sessionId,
            clientMessage: out.client_message,
            endConversation: out.end_conversation ?? false,
            audioBase64,
        });
    }
    catch (error) {
        console.error('[web-training] start error:', error);
        const msg = error instanceof Error ? error.message : String(error);
        // Максимально безопасный fallback: просто текст без внешних вызовов
        res.json({
            sessionId: null,
            clientMessage: 'Сейчас тренажёр недоступен локально (ошибка подключения к AI‑клиенту). ' +
                'Интерфейс работает, но диалог с клиентом мы сможем полностью включить уже на проде.',
            endConversation: true,
            audioBase64: null,
            warning: 'Локальный режим без OpenAI: запрос к виртуальному клиенту не выполнен. ' +
                'Подключим полноценного клиента на продакшене.',
            error: msg,
        });
    }
});
// ── Web training API: manager message ──
app.post('/api/training/web/message', async (req, res) => {
    try {
        const body = req.body || {};
        const { sessionId, message } = body;
        const replyMode = (body.replyMode ?? 'text');
        const ttsVoice = (body.voice ?? 'male');
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ error: 'sessionId обязателен' });
        }
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'Пустое сообщение' });
        }
        if (!webTrainingSessions.has(sessionId)) {
            return res.status(404).json({ error: 'Сессия не найдена или истекла' });
        }
        const out = await runWebTrainingTurn({
            sessionId,
            message,
            replyMode,
            ttsVoice,
        });
        res.json(out);
    }
    catch (error) {
        console.error('[web-training] message error:', error);
        const msg = error instanceof Error ? error.message : String(error);
        res.json({
            clientMessage: 'Диалог сейчас недоступен из‑за ошибки подключения к AI‑клиенту. ' +
                'Но интерфейс теста уже готов — в продакшене он будет работать как в Telegram.',
            endConversation: true,
            audioBase64: null,
            warning: 'Локальный режим без OpenAI: сообщения не обрабатываются. ' +
                'Полноценный диалог включим на боевом сервере.',
            error: msg,
        });
    }
});
// ── Web training API: manager voice message ──
app.post('/api/training/web/voice-message', async (req, res) => {
    try {
        const body = req.body || {};
        const { sessionId, audioBase64, mimeType } = body;
        const replyMode = (body.replyMode ?? 'text+voice');
        const ttsVoice = (body.voice ?? 'male');
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ error: 'sessionId обязателен' });
        }
        if (!audioBase64 || typeof audioBase64 !== 'string') {
            return res.status(400).json({ error: 'audioBase64 обязателен' });
        }
        if (!webTrainingSessions.has(sessionId)) {
            return res.status(404).json({ error: 'Сессия не найдена или истекла' });
        }
        const ext = mimeType?.includes('ogg') ? 'ogg' : mimeType?.includes('mp4') ? 'm4a' : 'webm';
        const tmpPath = path_1.default.join(os_1.default.tmpdir(), `web-voice-${Date.now()}.${ext}`);
        const buf = Buffer.from(audioBase64, 'base64');
        await fs_1.default.promises.writeFile(tmpPath, buf);
        let managerText = '';
        try {
            managerText = await (0, stt_1.transcribeVoice)(tmpPath);
        }
        finally {
            fs_1.default.promises.unlink(tmpPath).catch(() => { });
        }
        if (!managerText.trim()) {
            return res.status(400).json({ error: 'Не удалось распознать голосовое сообщение' });
        }
        const out = await runWebTrainingTurn({
            sessionId,
            message: managerText,
            replyMode,
            ttsVoice,
        });
        res.json({ ...out, managerTranscript: managerText });
    }
    catch (error) {
        console.error('[web-training] voice-message error:', error);
        const msg = error instanceof Error ? error.message : String(error);
        res.json({
            clientMessage: 'Сейчас не удалось обработать голос на локальном стенде, но интерфейс работает. ' +
                'В продакшене ответ будет как в Telegram.',
            endConversation: true,
            audioBase64: null,
            warning: 'Локальный fallback: проверьте доступ к OpenAI/STT (VPN/прокси). ' +
                'Диалог завершён, чтобы избежать повторных ошибок.',
            error: msg || 'Ошибка обработки голосового сообщения',
        });
    }
});
// Prevent caching of index.html so users always get latest app after deploy/refresh
function sendIndexHtml(res) {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
    });
    return res.sendFile(INDEX_HTML_PATH);
}
// Explicit root: always serve Mini App
app.get('/', (req, res) => {
    if (INDEX_HTML_PATH) {
        try {
            return sendIndexHtml(res);
        }
        catch (err) {
            console.error('Error sending index.html:', err);
            sendErrorHtml(res, 500, 'Ошибка загрузки', 'Не удалось отдать страницу приложения. См. логи сервера.');
            return;
        }
    }
    sendErrorHtml(res, 404, 'Файл не найден', 'Файл public/index.html не найден. Убедитесь, что папка public и index.html есть в проекте.');
});
app.post('/api/auth/login', (req, res) => {
    (0, http_2.handleAuthLogin)(req, res).catch((error) => {
        console.error('Auth login error:', error);
        res.status(500).json({ error: 'Ошибка авторизации. Попробуйте позже.' });
    });
});
app.get('/api/auth/me', (req, res) => {
    (0, http_2.handleAuthMe)(req, res).catch((error) => {
        console.error('Auth me error:', error);
        res.status(500).json({ error: 'Ошибка проверки сессии. Попробуйте позже.' });
    });
});
// API endpoint to verify admin and get data
app.get('/api/admin/verify', async (req, res) => {
    try {
        if (req.get('authorization')?.startsWith('Bearer ')) {
            await (0, http_2.handleAuthMe)(req, res);
            return;
        }
        const { initData } = req.query;
        const isLocalhost = ['127.0.0.1', '::1', 'localhost'].includes(req.ip || '') ||
            (req.get('host') || '').startsWith('localhost');
        // Dev bypass: on localhost with ALLOW_DEV_ADMIN=true, allow without Telegram
        if (!initData && config_1.config.allowDevAdmin && isLocalhost) {
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
        const params = new URLSearchParams(initData);
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
        const isAdmin = config_1.config.adminIdentifiers.includes(telegramId) ||
            (username && (config_1.config.adminIdentifiers.includes(username) ||
                config_1.config.adminIdentifiers.includes(`@${username}`)));
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
    }
    catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ error: 'Ошибка сервера. Попробуйте позже.' });
    }
});
app.use('/api/admin', (req, res, next) => {
    (0, http_2.adminApiAuthMiddleware)(req, res, next).catch((error) => {
        console.error('Admin API auth error:', error);
        res.status(500).json({ error: 'Ошибка проверки доступа. Попробуйте позже.' });
    });
});
app.get('/api/admin/rbac/meta', (req, res) => {
    (0, userManagement_1.handleRbacMeta)(req, res).catch((error) => {
        console.error('RBAC meta error:', error);
        res.status(500).json({ error: 'Не удалось загрузить RBAC-метаданные.' });
    });
});
app.get('/api/admin/holdings', (req, res) => {
    (0, organizationManagement_1.handleListHoldings)(req, res).catch((error) => {
        console.error('List holdings error:', error);
        res.status(500).json({ error: 'Не удалось загрузить холдинги.' });
    });
});
app.post('/api/admin/holdings', (req, res) => {
    (0, organizationManagement_1.handleCreateHolding)(req, res).catch((error) => {
        console.error('Create holding route error:', error);
        res.status(500).json({ error: 'Не удалось создать холдинг.' });
    });
});
app.patch('/api/admin/holdings/:holdingId', (req, res) => {
    (0, organizationManagement_1.handleUpdateHolding)(req, res).catch((error) => {
        console.error('Update holding route error:', error);
        res.status(500).json({ error: 'Не удалось обновить холдинг.' });
    });
});
app.delete('/api/admin/holdings/:holdingId', (req, res) => {
    (0, organizationManagement_1.handleDeleteHolding)(req, res).catch((error) => {
        console.error('Delete holding route error:', error);
        res.status(500).json({ error: 'Не удалось удалить холдинг.' });
    });
});
app.get('/api/admin/dealerships', (req, res) => {
    (0, organizationManagement_1.handleListDealerships)(req, res).catch((error) => {
        console.error('List dealerships error:', error);
        res.status(500).json({ error: 'Не удалось загрузить автосалоны.' });
    });
});
app.post('/api/admin/dealerships', (req, res) => {
    (0, organizationManagement_1.handleCreateDealership)(req, res).catch((error) => {
        console.error('Create dealership route error:', error);
        res.status(500).json({ error: 'Не удалось создать автосалон.' });
    });
});
app.patch('/api/admin/dealerships/:dealershipId', (req, res) => {
    (0, organizationManagement_1.handleUpdateDealership)(req, res).catch((error) => {
        console.error('Update dealership route error:', error);
        res.status(500).json({ error: 'Не удалось обновить автосалон.' });
    });
});
app.delete('/api/admin/dealerships/:dealershipId', (req, res) => {
    (0, organizationManagement_1.handleDeleteDealership)(req, res).catch((error) => {
        console.error('Delete dealership route error:', error);
        res.status(500).json({ error: 'Не удалось удалить автосалон.' });
    });
});
app.post('/api/admin/organization/sync-mock', (req, res) => {
    (0, organizationManagement_1.handleSyncMockOrganization)(req, res).catch((error) => {
        console.error('Sync mock organization route error:', error);
        res.status(500).json({ error: 'Не удалось синхронизировать оргструктуру.' });
    });
});
app.get('/api/admin/users', (req, res) => {
    (0, userManagement_1.handleListUsers)(req, res).catch((error) => {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Не удалось загрузить пользователей.' });
    });
});
app.post('/api/admin/users', (req, res) => {
    (0, userManagement_1.handleCreateUser)(req, res).catch((error) => {
        console.error('Create user route error:', error);
        res.status(500).json({ error: 'Не удалось создать пользователя.' });
    });
});
app.patch('/api/admin/users/:accountId', (req, res) => {
    (0, userManagement_1.handleUpdateUser)(req, res).catch((error) => {
        console.error('Update user route error:', error);
        res.status(500).json({ error: 'Не удалось обновить пользователя.' });
    });
});
app.delete('/api/admin/users/:accountId', (req, res) => {
    (0, userManagement_1.handleDeleteUser)(req, res).catch((error) => {
        console.error('Delete user route error:', error);
        res.status(500).json({ error: 'Не удалось удалить пользователя.' });
    });
});
app.get('/api/admin/permission-templates', (req, res) => {
    (0, userManagement_1.handleListPermissionTemplates)(req, res).catch((error) => {
        console.error('List permission templates error:', error);
        res.status(500).json({ error: 'Не удалось загрузить шаблоны прав.' });
    });
});
app.post('/api/admin/permission-templates', (req, res) => {
    (0, userManagement_1.handleCreatePermissionTemplate)(req, res).catch((error) => {
        console.error('Create permission template error:', error);
        res.status(500).json({ error: 'Не удалось создать шаблон прав.' });
    });
});
app.patch('/api/admin/permission-templates/:templateId', (req, res) => {
    (0, userManagement_1.handleUpdatePermissionTemplate)(req, res).catch((error) => {
        console.error('Update permission template error:', error);
        res.status(500).json({ error: 'Не удалось обновить шаблон прав.' });
    });
});
app.delete('/api/admin/permission-templates/:templateId', (req, res) => {
    (0, userManagement_1.handleDeletePermissionTemplate)(req, res).catch((error) => {
        console.error('Delete permission template error:', error);
        res.status(500).json({ error: 'Не удалось удалить шаблон прав.' });
    });
});
// Get training session details (V2 evaluation-aware)
app.get('/api/admin/training-sessions/:sessionId', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.sessionId);
        const session = await db_1.prisma.trainingSession.findUnique({
            where: { id: sessionId },
            include: {
                user: true,
                messages: { orderBy: { createdAt: 'asc' } },
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
        const conversationPairs = [];
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
        let behaviorSummary = null;
        if (managerMsgs.length > 0) {
            let toxicCount = 0;
            let lowEffortCount = 0;
            let evasionCount = 0;
            const allProhibited = [];
            for (const m of managerMsgs) {
                try {
                    const sig = JSON.parse(m.qualitySignalJson);
                    if (sig.toxic)
                        toxicCount++;
                    if (sig.low_effort)
                        lowEffortCount++;
                    if (sig.evasion)
                        evasionCount++;
                    if (Array.isArray(sig.prohibited_phrase_hits))
                        allProhibited.push(...sig.prohibited_phrase_hits);
                }
                catch { /* skip */ }
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
            const evalData = JSON.parse(session.evaluationJson);
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
                    criteriaScores: {},
                };
            });
            return res.json({
                type: 'training',
                id: session.id,
                userName: session.user.fullName,
                testTitle: 'Тренировка с виртуальным клиентом',
                clientProfile: session.clientProfile ?? 'normal',
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
                    .filter((c) => c.status === 'YES')
                    .map((c) => c.comment || c.code),
                weaknesses: issues.map((i) => i.recommendation || i.issue_type),
                recommendations,
                behaviorSummary,
                steps,
            });
        }
        // ── Legacy assessment fallback ──
        const data = hasLegacyAssessment ? JSON.parse(session.assessmentJson) : {};
        const score = hasLegacyAssessment ? session.assessmentScore : 0;
        const level = hasLegacyAssessment ? scoreToLevel(score) : null;
        const qualityTag = isFailed ? 'Плохо' : scoreToQualityTag(score);
        const assessmentSteps = (data.steps || []);
        const globalImprovements = Array.isArray(data.improvements)
            ? data.improvements
            : [];
        const steps = conversationPairs.map((p) => {
            const stepData = assessmentSteps.find((s) => s.step_order === p.order);
            if (!stepData) {
                const genericImprovement = globalImprovements[0] ||
                    'Ответить подробнее и сфокусироваться на пользе для клиента и следующем шаге.';
                return {
                    order: p.order,
                    customerMessage: p.customerMessage,
                    answer: p.answer,
                    score: 0,
                    feedback: 'Этот ответ не был отдельно оценён моделью. ' +
                        `Общая рекомендация: ${genericImprovement}`,
                    betterExample: genericImprovement,
                    criteriaScores: {},
                };
            }
            return {
                order: p.order,
                customerMessage: p.customerMessage,
                answer: p.answer,
                score: stepData.step_score ?? 0,
                feedback: stepData.feedback ?? null,
                betterExample: stepData.better_example ?? null,
                criteriaScores: {},
            };
        });
        res.json({
            type: 'training',
            id: session.id,
            userName: session.user.fullName,
            testTitle: 'Тренировка с виртуальным клиентом',
            clientProfile: session.clientProfile ?? 'normal',
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
    }
    catch (error) {
        console.error('Get training session error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get single attempt details with full feedback (must come before /api/admin/attempts)
app.get('/api/admin/attempts/:attemptId', async (req, res) => {
    try {
        const attemptId = parseInt(req.params.attemptId);
        const attempt = await db_1.prisma.attempt.findUnique({
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
        const hasData = attempt.totalScore != null ||
            attempt.evaluationResultJson != null ||
            attempt.evaluationError != null;
        if (!hasData) {
            return res.status(404).json({ error: 'Attempt has no evaluation data' });
        }
        let steps;
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
        }
        else if (attempt.evaluationResultJson && attempt.conversationHistoryJson) {
            const history = JSON.parse(attempt.conversationHistoryJson);
            const evalResult = JSON.parse(attempt.evaluationResultJson);
            const pairs = [];
            for (let i = 0; i + 1 < history.length; i += 2) {
                if (history[i].role === 'client' && history[i + 1].role === 'manager') {
                    pairs.push({ customerMessage: history[i].text, answer: history[i + 1].text });
                }
            }
            steps = (evalResult.steps || []).map((s, idx) => {
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
        }
        else {
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
    }
    catch (error) {
        console.error('Get attempt details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Helper: derive level from score (for backward compatibility)
function scoreToLevel(score) {
    if (score < 40)
        return 'Junior';
    if (score < 70)
        return 'Middle';
    return 'Senior';
}
// Quality tag for conversation result (one word)
function scoreToQualityTag(score) {
    if (score < 50)
        return 'Плохо';
    if (score < 76)
        return 'Средне';
    return 'Хорошо';
}
function getFailureReasonLabel(reason) {
    if (!reason)
        return 'Тренировка досрочно завершена';
    const base = reason.split(':')[0];
    const map = {
        PROFANITY: 'Недопустимая лексика',
        BAD_TONE: 'Грубый / враждебный тон',
        IGNORED_QUESTIONS: 'Игнорирование вопросов клиента',
        POOR_COMMUNICATION: 'Низкое качество коммуникации',
        REPEATED_LOW_EFFORT: 'Повторные некачественные ответы',
        REPEATED_LOW_QUALITY: 'Повторные некачественные/формальные ответы',
        DISENGAGEMENT: 'Менеджер завершил коммуникацию / отказался от диалога',
        rude_language: 'Недопустимая лексика',
        ignored_questions: 'Игнорирование вопросов клиента',
        poor_communication: 'Низкое качество коммуникации',
        repeated_low_effort: 'Повторные некачественные ответы',
        repeated_low_quality: 'Повторные некачественные/формальные ответы',
        disengagement: 'Менеджер завершил коммуникацию / отказался от диалога',
    };
    if (map[base])
        return map[base];
    if (base === 'CRITICAL_EVASION' || base === 'critical_evasion') {
        const topic = reason.split(':')[1] ?? '';
        return `Критический вопрос проигнорирован (${topic})`;
    }
    return 'Тренировка досрочно завершена';
}
// Short summary for card (from assessment or built from strengths/weaknesses)
function buildCardSummary(type, data) {
    if (type === 'training' && data.quality?.trim()) {
        return data.quality;
    }
    const parts = [];
    if (data.strengths?.length)
        parts.push(data.strengths[0]);
    if (data.weaknesses?.length)
        parts.push(data.weaknesses[0]);
    if (data.mistakes?.length)
        parts.push(data.mistakes[0]);
    if (data.recommendations?.length && parts.length < 2)
        parts.push(data.recommendations[0]);
    if (data.improvements?.length && parts.length < 2)
        parts.push(data.improvements[0]);
    return parts.slice(0, 2).join('. ') || 'Краткая оценка диалога.';
}
// Get attempts + training sessions merged (for Employees tab)
app.get('/api/admin/attempts', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 1000;
        const [attempts, trainingSessions] = await Promise.all([
            db_1.prisma.attempt.findMany({
                where: completedWithDataWhere,
                include: {
                    user: true,
                    test: true,
                    answers: {
                        include: { step: true },
                        orderBy: { step: { order: 'asc' } },
                    },
                },
                orderBy: { finishedAt: 'desc' },
            }),
            db_1.prisma.trainingSession.findMany({
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
                type: 'attempt',
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
            let weaknesses = [];
            let recommendations = [];
            let dimensionScores = null;
            if (hasV2Eval) {
                const evalData = JSON.parse(s.evaluationJson);
                score = evalData.overall_score_0_100 ?? s.totalScore ?? 0;
                weaknesses = Array.isArray(evalData.issues)
                    ? evalData.issues.map((i) => i.recommendation || i.issue_type)
                    : [];
                recommendations = Array.isArray(evalData.recommendations) ? evalData.recommendations : [];
                dimensionScores = evalData.dimension_scores ?? null;
            }
            else if (hasLegacyAssessment) {
                const data = JSON.parse(s.assessmentJson);
                score = s.assessmentScore;
                weaknesses = Array.isArray(data.mistakes) ? data.mistakes : [];
                recommendations = Array.isArray(data.improvements) ? data.improvements : [];
            }
            const failReasonLabels = {
                rude_language: 'Досрочно завершена: недопустимая лексика.',
                ignored_questions: 'Досрочно завершена: менеджер игнорировал вопросы.',
                poor_communication: 'Досрочно завершена: низкое качество коммуникации.',
                repeated_low_effort: 'Досрочно завершена: повторные некачественные ответы.',
                PROFANITY: 'Досрочно завершена: недопустимая лексика.',
                BAD_TONE: 'Досрочно завершена: грубый / враждебный тон.',
                IGNORED_QUESTIONS: 'Досрочно завершена: менеджер игнорировал вопросы.',
                POOR_COMMUNICATION: 'Досрочно завершена: низкое качество коммуникации.',
                REPEATED_LOW_EFFORT: 'Досрочно завершена: повторные некачественные ответы.',
                REPEATED_LOW_QUALITY: 'Досрочно завершена: формальные/некачественные ответы.',
                DISENGAGEMENT: 'Досрочно завершена: менеджер отказался продолжать диалог.',
            };
            const baseReason = (s.failureReason ?? '').split(':')[0];
            let summary;
            if (isFailed) {
                summary = failReasonLabels[baseReason]
                    ?? (baseReason === 'critical_evasion' || baseReason === 'CRITICAL_EVASION'
                        ? `Досрочно завершена: критический вопрос проигнорирован (${(s.failureReason ?? '').split(':')[1] ?? ''}).`
                        : 'Тренировка досрочно завершена системой.');
            }
            else if (hasV2Eval) {
                summary = `Балл: ${score}/100`;
            }
            else {
                const data = hasLegacyAssessment ? JSON.parse(s.assessmentJson) : {};
                summary = buildCardSummary('training', {
                    quality: data.quality,
                    mistakes: data.mistakes,
                    improvements: data.improvements,
                });
            }
            return {
                type: 'training',
                id: `t-${s.id}`,
                sessionId: s.id,
                userName: s.user.fullName,
                testTitle: 'Тренировка с виртуальным клиентом',
                clientProfile: s.clientProfile ?? 'normal',
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
    }
    catch (error) {
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
            db_1.prisma.attempt.findMany({
                where: { status: 'completed', totalScore: { not: null } },
                include: {
                    user: true,
                },
            }),
            db_1.prisma.trainingSession.findMany({
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
            const empty = {
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
            if (s.totalScore != null)
                return sum + s.totalScore;
            if (s.evaluationJson != null) {
                try {
                    const evalData = JSON.parse(s.evaluationJson);
                    if (typeof evalData.overall_score_0_100 === 'number')
                        return sum + evalData.overall_score_0_100;
                }
                catch { /* skip */ }
            }
            if (s.assessmentScore != null)
                return sum + s.assessmentScore;
            if (s.status === 'failed')
                return sum;
            return sum;
        }, 0);
        const totalScore = totalScoreAttempts + totalScoreTrainings;
        const avgScore = totalItems > 0 ? totalScore / totalItems : 0;
        const levelCounts = {
            Junior: 0,
            Middle: 0,
            Senior: 0,
        };
        const allWeaknesses = {};
        const allStrengths = {};
        attempts.forEach((attempt) => {
            if (attempt.level) {
                levelCounts[attempt.level]++;
            }
            if (attempt.weaknessesJson) {
                const weaknesses = JSON.parse(attempt.weaknessesJson);
                weaknesses.forEach((w) => {
                    allWeaknesses[w] = (allWeaknesses[w] || 0) + 1;
                });
            }
            if (attempt.strengthsJson) {
                const strengths = JSON.parse(attempt.strengthsJson);
                strengths.forEach((s) => {
                    allStrengths[s] = (allStrengths[s] || 0) + 1;
                });
            }
        });
        trainingSessions.forEach((s) => {
            const hasV2Eval = s.evaluationJson != null;
            if (hasV2Eval) {
                try {
                    const evalData = JSON.parse(s.evaluationJson);
                    const issues = Array.isArray(evalData.issues) ? evalData.issues : [];
                    const recs = Array.isArray(evalData.recommendations) ? evalData.recommendations : [];
                    const checklistItems = Array.isArray(evalData.checklist) ? evalData.checklist : [];
                    issues.forEach((i) => {
                        const text = i.recommendation || i.issue_type || '';
                        if (text)
                            allWeaknesses[text] = (allWeaknesses[text] || 0) + 1;
                    });
                    recs.forEach((r) => {
                        if (r)
                            allStrengths[r] = (allStrengths[r] || 0) + 1;
                    });
                    checklistItems
                        .filter((c) => c.status === 'YES')
                        .forEach((c) => {
                        const text = c.comment || c.code;
                        if (text)
                            allStrengths[text] = (allStrengths[text] || 0) + 1;
                    });
                }
                catch { /* skip malformed JSON */ }
            }
            else if (s.assessmentJson) {
                const data = JSON.parse(s.assessmentJson);
                const mistakes = Array.isArray(data.mistakes) ? data.mistakes : [];
                const improvements = Array.isArray(data.improvements) ? data.improvements : [];
                mistakes.forEach((w) => {
                    allWeaknesses[w] = (allWeaknesses[w] || 0) + 1;
                });
                improvements.forEach((r) => {
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
                    let weaknesses = [];
                    let recommendations = [];
                    let strengths = [];
                    if (s.evaluationJson) {
                        try {
                            const evalData = JSON.parse(s.evaluationJson);
                            score = evalData.overall_score_0_100 ?? s.totalScore ?? s.assessmentScore ?? 0;
                            weaknesses = Array.isArray(evalData.issues)
                                ? evalData.issues.map((i) => i.recommendation || i.issue_type)
                                : [];
                            recommendations = Array.isArray(evalData.recommendations) ? evalData.recommendations : [];
                            strengths = Array.isArray(evalData.checklist)
                                ? evalData.checklist.filter((c) => c.status === 'YES').map((c) => c.comment || c.code)
                                : [];
                        }
                        catch { /* skip */ }
                    }
                    else if (s.assessmentJson) {
                        const data = JSON.parse(s.assessmentJson);
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
            const { generateExpertTeamSummary } = await Promise.resolve().then(() => __importStar(require('./team-summary')));
            expertSummary = await generateExpertTeamSummary(teamData);
        }
        catch (error) {
            console.error('Error generating expert summary:', error);
            // Continue without expert summary if generation fails
        }
        const payload = {
            totalAttempts: totalItems,
            avgScore: Math.round(avgScore * 10) / 10,
            levelCounts,
            topWeaknesses,
            topStrengths,
            expertSummary,
        };
        teamSummaryCache = { data: payload, expiresAt: now + ANALYTICS_TTL_MS };
        res.json(payload);
    }
    catch (error) {
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
        const calls = await db_1.prisma.voiceCallSession.findMany();
        if (!calls.length) {
            const empty = {
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
        const breakdown = {
            completed: 0,
            no_answer: 0,
            busy: 0,
            failed: 0,
            disconnected: 0,
        };
        let totalDuration = 0;
        let durationCount = 0;
        for (const c of calls) {
            const key = (c.outcome || 'disconnected');
            if (breakdown[key] !== undefined) {
                breakdown[key] += 1;
            }
            else {
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
        const payload = {
            totalCalls: total,
            answeredPercent,
            missedPercent,
            avgDurationSec,
            outcomeBreakdown: breakdown,
        };
        voiceDashboardCache = { data: payload, expiresAt: now + ANALYTICS_TTL_MS };
        res.json(payload);
    }
    catch (error) {
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
        let error = null;
        try {
            const https = await Promise.resolve().then(() => __importStar(require('https')));
            const response = await new Promise((resolve, reject) => {
                const url = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}&limit=31`;
                const apiKey = config_1.config.openaiApiKey;
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
            }
            else {
                try {
                    const errJson = response.data ? JSON.parse(response.data) : {};
                    error = errJson.error?.message || `API returned ${response.statusCode}`;
                }
                catch {
                    error = `API returned ${response.statusCode}`;
                }
            }
        }
        catch (e) {
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
    }
    catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get managers list
app.get('/api/admin/managers', async (req, res) => {
    try {
        const managers = await db_1.prisma.user.findMany({
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
    }
    catch (error) {
        console.error('Get managers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get manager attempts
app.get('/api/admin/managers/:managerId/attempts', async (req, res) => {
    try {
        const managerId = parseInt(req.params.managerId);
        const attempts = await db_1.prisma.attempt.findMany({
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
    }
    catch (error) {
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
    const tunnelLive = !!(0, tunnel_1.getTunnelUrl)()?.trim();
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
        const numbers = (0, callHistory_1.getTestNumbers)();
        res.json({ numbers });
    }
    catch (err) {
        console.error('test-numbers error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Admin: start voice call (Voximplant)
app.post('/api/admin/start-voice-call', async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const toRaw = body.to != null ? String(body.to).trim() : null;
        const numbers = (0, callHistory_1.getTestNumbers)();
        const defaultTo = numbers.length > 0 ? numbers[0] : null;
        const to = toRaw || defaultTo;
        if (!to) {
            return res.status(400).json({
                error: 'Укажите номер (to) или задайте VOX_TEST_TO / VOX_TEST_NUMBERS в .env.',
            });
        }
        const scenario = (body.scenario === 'realtime' || body.scenario === 'realtime_pure' || body.scenario === 'dialog') ? body.scenario : 'realtime_pure';
        const result = await (0, startVoiceCall_1.startVoiceCall)(to, { scenario });
        if ('error' in result) {
            return res.status(400).json({ error: result.error });
        }
        (0, callHistory_1.addCall)(result.callId, to);
        const toNormalized = '+' + String(to).replace(/\D/g, '');
        try {
            await db_1.prisma.voiceCallSession.create({
                data: {
                    callId: result.callId,
                    to: toNormalized,
                    scenario: result.scenario ?? 'dialog',
                    startedAt: new Date(result.startedAt),
                },
            });
        }
        catch (e) {
            console.warn('[voice] VoiceCallSession create (may already exist):', e instanceof Error ? e.message : e);
        }
        res.json({ callId: result.callId, startedAt: result.startedAt, to, scenario: result.scenario });
    }
    catch (err) {
        console.error('start-voice-call error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/api/public/demo-call/start', async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const toRaw = body.to != null ? String(body.to).trim() : '';
        if (!toRaw) {
            return res.status(400).json({ error: 'Введите номер телефона.' });
        }
        const scenario = body.scenario === 'dialog' || body.scenario === 'realtime'
            ? body.scenario
            : 'realtime_pure';
        const result = await (0, startVoiceCall_1.startVoiceCall)(toRaw, { scenario });
        if ('error' in result) {
            return res.status(400).json({ error: result.error });
        }
        (0, callHistory_1.addCall)(result.callId, toRaw);
        const toNormalized = '+' + String(toRaw).replace(/\D/g, '');
        try {
            await db_1.prisma.voiceCallSession.create({
                data: {
                    callId: result.callId,
                    to: toNormalized,
                    scenario: result.scenario ?? 'realtime_pure',
                    startedAt: new Date(result.startedAt),
                },
            });
        }
        catch (e) {
            console.warn('[demo-call] VoiceCallSession create (may already exist):', e instanceof Error ? e.message : e);
        }
        res.json({ callId: result.callId, startedAt: result.startedAt, to: toRaw, scenario: result.scenario });
    }
    catch (err) {
        console.error('public demo-call/start error:', err);
        res.status(500).json({ error: 'Не удалось запустить звонок.' });
    }
});
/** Пример отчёта на странице /demo-call: полная оценка стенограммы (evaluatorV2 + LLM-сводка и улучшения ответов). */
app.post('/api/public/demo-call/evaluate-example', async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const raw = body.transcript;
        if (!Array.isArray(raw)) {
            return res.status(400).json({ error: 'Ожидается массив transcript: [{ role, text }].' });
        }
        const transcript = raw
            .map((row) => row && typeof row === 'object'
            ? {
                role: String(row.role ?? ''),
                text: String(row.text ?? ''),
            }
            : null)
            .filter((x) => !!x);
        const result = await (0, demoExampleEvaluation_1.evaluateDemoExampleFromTranscript)(transcript);
        res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось оценить пример.';
        console.error('public demo-call/evaluate-example error:', err);
        res.status(500).json({ error: message });
    }
});
app.get('/api/public/demo-call/:callId', async (req, res) => {
    try {
        const callId = String(req.params.callId || '').trim();
        if (!callId) {
            return res.status(400).json({ error: 'Missing callId.' });
        }
        const session = await db_1.prisma.voiceCallSession.findUnique({ where: { callId } });
        if (!session) {
            return res.status(404).json({ error: 'Звонок не найден.' });
        }
        res.json(buildVoiceCallDetailResponse(session));
    }
    catch (err) {
        console.error('public demo-call/:callId error:', err);
        res.status(500).json({ error: 'Не удалось получить статус звонка.' });
    }
});
// Admin: create batch call orchestration job
app.post('/api/admin/call-batches', async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const jobsRaw = Array.isArray(body.jobs) ? (body.jobs) : [];
        const jobs = jobsRaw
            .map((j) => (j && typeof j === 'object' ? j : null))
            .filter((j) => !!j)
            .map((j) => ({
            phone: j.phone != null ? String(j.phone) : '',
            dealershipId: j.dealershipId != null ? String(j.dealershipId) : null,
            dealershipName: j.dealershipName != null ? String(j.dealershipName) : null,
        }));
        const out = await (0, callBatchOrchestrator_1.createCallBatch)({
            mode: body.mode ?? 'manual',
            title: body.title,
            jobs,
            maxConcurrency: Number(body.maxConcurrency ?? 10),
            startIntervalMs: Number(body.startIntervalMs ?? 250),
            maxAttempts: Number(body.maxAttempts ?? 3),
            scenario: body.scenario ?? 'realtime_pure',
            testMode: !!body.testMode,
        });
        res.json({ ok: true, ...out });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось создать батч.';
        res.status(400).json({ error: message });
    }
});
app.get('/api/admin/call-batches/:id', async (req, res) => {
    try {
        const { batch, jobsPreview, dealershipSummary } = await (0, callBatchOrchestrator_1.getCallBatch)(req.params.id);
        res.json({ batch, jobsPreview, dealershipSummary });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Батч не найден.';
        res.status(404).json({ error: message });
    }
});
app.get('/api/admin/call-batches', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
        const modeRaw = String(req.query.mode ?? 'all').trim();
        const allowedModes = new Set(['all', 'manual', 'single_dealership', 'all_dealerships', 'auto_daily']);
        const mode = allowedModes.has(modeRaw) ? modeRaw : 'all';
        const items = await (0, callBatchOrchestrator_1.listCallBatches)(limit, mode);
        res.json({ items });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось получить список batch';
        res.status(400).json({ error: message });
    }
});
app.get('/api/admin/super-admin/dealership-schedules', async (_req, res) => {
    try {
        const schedules = (0, dealershipDirectory_1.getDealershipDirectory)().map((d) => ({
            id: d.id,
            name: d.name,
            city: d.city,
            workStartHour: d.workStartHour,
            workEndHour: d.workEndHour,
        }));
        res.json({ schedules });
    }
    catch (err) {
        console.error('super-admin/dealership-schedules error:', err);
        res.json({ schedules: [] });
    }
});
app.get('/api/admin/super-admin/call-orchestrator-config', async (_req, res) => {
    try {
        const callSource = (0, dealershipCallSource_1.getCallSourceInfo)();
        res.json({
            callSource,
            autoDailyEnabled: process.env.AUTO_DAILY_CALLS_ENABLED === 'true' || process.env.AUTO_DAILY_CALLS_ENABLED === '1',
            batchTestModeEnabled: process.env.CALL_BATCH_TEST_MODE === 'true' || process.env.CALL_BATCH_TEST_MODE === '1',
            sourceMode: process.env.CALL_SOURCE_MODE || 'mock',
        });
    }
    catch (err) {
        console.error('super-admin/call-orchestrator-config error:', err);
        res.json({
            callSource: { mode: 'mock', targetsAvailable: 0, usingMockFallback: true },
            autoDailyEnabled: false,
            batchTestModeEnabled: false,
            sourceMode: 'mock',
        });
    }
});
app.get('/api/admin/call-batches/:id/jobs', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);
        const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
        const statusRaw = String(req.query.status ?? '').trim();
        const allowedStatuses = new Set(['queued', 'dialing', 'in_progress', 'retry_wait', 'completed', 'failed', 'cancelled']);
        const status = allowedStatuses.has(statusRaw) ? statusRaw : undefined;
        const out = await (0, callBatchOrchestrator_1.getCallBatchJobs)(req.params.id, limit, offset, status);
        res.json(out);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось получить jobs батча.';
        res.status(400).json({ error: message });
    }
});
app.post('/api/admin/call-batches/:id/pause', async (req, res) => {
    try {
        await (0, callBatchOrchestrator_1.pauseCallBatch)(req.params.id);
        res.json({ ok: true });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось поставить батч на паузу.';
        res.status(400).json({ error: message });
    }
});
app.post('/api/admin/call-batches/:id/resume', async (req, res) => {
    try {
        await (0, callBatchOrchestrator_1.resumeCallBatch)(req.params.id);
        res.json({ ok: true });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось возобновить батч.';
        res.status(400).json({ error: message });
    }
});
app.post('/api/admin/call-batches/:id/cancel', async (req, res) => {
    try {
        await (0, callBatchOrchestrator_1.cancelCallBatch)(req.params.id);
        res.json({ ok: true });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось отменить батч.';
        res.status(400).json({ error: message });
    }
});
app.use('/webhooks/vox', (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : null;
    console.log('[webhooks/vox] request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
        contentType: req.get('content-type') || null,
        bodyKeys: body ? Object.keys(body) : [],
    });
    next();
});
app.get('/webhooks/vox', (_req, res) => {
    res.status(200).json({
        ok: true,
        message: 'Voximplant webhook endpoint is alive. Expected method: POST.',
    });
});
// Voximplant webhook: call events (disconnected, failed, no_answer, busy)
app.post('/webhooks/vox', async (req, res) => {
    res.status(200).end();
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const voxSessionIdRaw = payload.vox_session_id ??
        payload.vox_call_id ??
        payload.call_session_history_id ??
        null;
    const voxSessionId = (() => {
        if (typeof voxSessionIdRaw === 'number')
            return Number.isFinite(voxSessionIdRaw) && voxSessionIdRaw > 0 ? voxSessionIdRaw : null;
        if (typeof voxSessionIdRaw === 'string') {
            const parsed = Number.parseInt(voxSessionIdRaw, 10);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        }
        // Some payloads may send an object; try common shapes.
        if (voxSessionIdRaw && typeof voxSessionIdRaw === 'object') {
            const obj = voxSessionIdRaw;
            const nested = obj.call_session_history_id ?? obj.session_id ?? obj.id ?? null;
            if (typeof nested === 'number')
                return Number.isFinite(nested) && nested > 0 ? nested : null;
            if (typeof nested === 'string') {
                const parsed = Number.parseInt(nested, 10);
                return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
            }
        }
        return null;
    })();
    const normalizedPayload = voxSessionId != null
        ? { ...payload, vox_session_id: voxSessionId }
        : payload;
    const event = String(payload.event ?? payload.event_type ?? '');
    const hasTranscript = Array.isArray(normalizedPayload.transcript);
    const callIdStr = String(normalizedPayload.call_id ?? '');
    if (callIdStr && voxSessionId != null) {
        (0, callHistory_1.setVoxSessionId)(callIdStr, voxSessionId);
    }
    console.log('[webhooks/vox] received', {
        event,
        callId: normalizedPayload.call_id,
        to: normalizedPayload.to ?? null,
        voxSessionId: normalizedPayload.vox_session_id ?? null,
        voxSessionIdRaw: voxSessionIdRaw ?? null,
        keys: Object.keys(normalizedPayload),
        transcriptTurns: hasTranscript ? normalizedPayload.transcript.length : 0,
    });
    if (['disconnected', 'failed', 'no_answer', 'busy'].includes(event)) {
        (0, voiceCallSession_1.finalizeVoiceCallSession)(normalizedPayload).catch((err) => {
            console.error('[webhooks/vox] finalizeVoiceCallSession error:', err instanceof Error ? err.message : err);
        });
        (0, callBatchOrchestrator_1.onVoxBatchWebhook)(normalizedPayload).catch((err) => {
            console.error('[webhooks/vox] onVoxBatchWebhook error:', err instanceof Error ? err.message : err);
        });
    }
});
// Admin: call history from DB (persisted; same phone = multiple cards)
app.get('/api/admin/call-history', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const sessions = await db_1.prisma.voiceCallSession.findMany({
            orderBy: { startedAt: 'desc' },
            take: limit,
        });
        const calls = sessions.map((s) => {
            const transcript = s.transcriptJson
                ? JSON.parse(s.transcriptJson)
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
    }
    catch (err) {
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
        const session = await db_1.prisma.voiceCallSession.findFirst({
            where: { id },
        });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json(buildVoiceCallDetailResponse(session));
    }
    catch (err) {
        console.error('call-history/:id error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ─── Super Admin: platform-level data (no schema change) ─────────────────
// Merged audits: attempts + training sessions + voice calls (platform-wide list)
app.get('/api/admin/super-admin/audits', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const [attempts, trainingSessions, voiceSessions] = await Promise.all([
            db_1.prisma.attempt.findMany({
                where: { status: 'completed', totalScore: { not: null } },
                include: { user: true },
                orderBy: { id: 'desc' },
                take: limit,
            }),
            db_1.prisma.trainingSession.findMany({
                where: {
                    status: { in: ['completed', 'failed'] },
                    OR: [
                        { assessmentScore: { not: null } },
                        { failureReason: { not: null } },
                    ],
                },
                include: { user: true },
                orderBy: { id: 'desc' },
                take: limit,
            }),
            db_1.prisma.voiceCallSession.findMany({
                orderBy: { id: 'desc' },
                take: limit,
            }),
        ]);
        const auditFromAttempt = (a) => {
            const score = a.totalScore ?? 0;
            return {
                id: `attempt-${a.id}`,
                type: 'attempt',
                company: 'Platform',
                dealer: '—',
                date: a.finishedAt?.toISOString() ?? new Date().toISOString(),
                aiScore: Math.round(score * 10) / 10,
                status: score >= 76 ? 'Good' : score >= 50 ? 'Medium' : 'Bad',
                userName: a.user?.fullName ?? '—',
                detailId: a.id,
                detailType: 'attempt',
            };
        };
        const auditFromTraining = (s) => {
            let score = s.totalScore ?? 0;
            if (score === 0 && s.evaluationJson) {
                try {
                    const e = JSON.parse(s.evaluationJson);
                    score = e.overall_score_0_100 ?? s.assessmentScore ?? 0;
                }
                catch { /* skip */ }
            }
            if (score === 0 && s.assessmentScore != null)
                score = s.assessmentScore;
            return {
                id: `training-${s.id}`,
                type: 'training',
                company: 'Platform',
                dealer: '—',
                date: s.completedAt?.toISOString() ?? new Date().toISOString(),
                aiScore: Math.round(score * 10) / 10,
                status: score >= 76 ? 'Good' : score >= 50 ? 'Medium' : 'Bad',
                userName: s.user?.fullName ?? '—',
                detailId: s.id,
                detailType: 'training',
            };
        };
        const auditFromCall = (s) => {
            let score = s.totalScore ?? 0;
            if (score === 0 && s.evaluationJson) {
                try {
                    const e = JSON.parse(s.evaluationJson);
                    score = e.overall_score_0_100 ?? 0;
                }
                catch { /* skip */ }
            }
            return {
                id: `call-${s.id}`,
                type: 'call',
                company: 'Platform',
                dealer: s.to,
                date: s.startedAt.toISOString(),
                aiScore: Math.round(score * 10) / 10,
                status: score >= 76 ? 'Good' : score >= 50 ? 'Medium' : 'Bad',
                userName: null,
                detailId: s.id,
                detailType: 'call',
            };
        };
        const items = [
            ...attempts.map(auditFromAttempt),
            ...trainingSessions.map(auditFromTraining),
            ...voiceSessions.map(auditFromCall),
        ]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, limit);
        res.json({ audits: items });
    }
    catch (err) {
        console.error('super-admin/audits error:', err);
        res.json({ audits: [] });
    }
});
// Time-series: last 7 days avg AI score (for dashboard chart)
app.get('/api/admin/super-admin/time-series', async (_req, res) => {
    try {
        const days = 7;
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
        const [attempts, trainingSessions, voiceSessions] = await Promise.all([
            db_1.prisma.attempt.findMany({
                where: {
                    status: 'completed',
                    totalScore: { not: null },
                    finishedAt: { gte: start },
                },
                select: { finishedAt: true, totalScore: true },
            }),
            db_1.prisma.trainingSession.findMany({
                where: {
                    status: { in: ['completed', 'failed'] },
                    completedAt: { gte: start },
                    OR: [
                        { assessmentScore: { not: null } },
                        { evaluationJson: { not: null } },
                    ],
                },
                select: { completedAt: true, totalScore: true, evaluationJson: true, assessmentScore: true },
            }),
            db_1.prisma.voiceCallSession.findMany({
                where: {
                    startedAt: { gte: start },
                    OR: [
                        { totalScore: { not: null } },
                        { evaluationJson: { not: null } },
                    ],
                },
                select: { startedAt: true, totalScore: true, evaluationJson: true },
            }),
        ]);
        const byDay = {};
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            byDay[key] = { sum: 0, count: 0 };
        }
        const addScore = (date, score) => {
            if (!date)
                return;
            const key = new Date(date).toISOString().slice(0, 10);
            if (byDay[key]) {
                byDay[key].sum += score;
                byDay[key].count += 1;
            }
        };
        attempts.forEach((a) => addScore(a.finishedAt, a.totalScore));
        trainingSessions.forEach((s) => {
            let score = s.totalScore ?? s.assessmentScore ?? 0;
            if (score === 0 && s.evaluationJson) {
                try {
                    const e = JSON.parse(s.evaluationJson);
                    score = e.overall_score_0_100 ?? 0;
                }
                catch { /* skip */ }
                addScore(s.completedAt, score);
            }
            else if (score > 0) {
                addScore(s.completedAt, score);
            }
        });
        voiceSessions.forEach((s) => {
            let score = s.totalScore ?? 0;
            if (score === 0 && s.evaluationJson) {
                try {
                    const e = JSON.parse(s.evaluationJson);
                    score = e.overall_score_0_100 ?? 0;
                }
                catch { /* skip */ }
                addScore(s.startedAt, score);
            }
            else if (score > 0) {
                addScore(s.startedAt, score);
            }
        });
        const series = Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, { sum, count }]) => ({
            date,
            avgScore: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
            count,
        }));
        res.json({ series });
    }
    catch (err) {
        console.error('super-admin/time-series error:', err);
        res.json({ series: [] });
    }
});
// Mock companies & dealers for local/test (no DB entities for company/dealer)
app.get('/api/admin/super-admin/mock-entities', async (req, res) => {
    try {
        const isLocalhost = /localhost|127\.0\.0\.1/.test(req.get('host') || req.get('origin') || '');
        const useMock = !!(isLocalhost || config_1.config.allowDevAdmin || process.env.NODE_ENV !== 'production' || req.query.mock === '1');
        const companies = useMock
            ? [
                { id: 'corp-1', name: 'АвтоХолдинг Север', autodealers: 4, avgAiScore: 82.4, answerRate: 78, lastAudit: new Date(Date.now() - 86400000).toISOString().slice(0, 10), trend: 1 },
                { id: 'corp-2', name: 'Drive Group', autodealers: 3, avgAiScore: 75.1, answerRate: 71, lastAudit: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), trend: -1 },
                { id: 'corp-3', name: 'МоторСервис', autodealers: 5, avgAiScore: 88.2, answerRate: 85, lastAudit: new Date().toISOString().slice(0, 10), trend: 1 },
                { id: 'corp-4', name: 'Авто Плюс', autodealers: 2, avgAiScore: 69.3, answerRate: 62, lastAudit: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), trend: 0 },
                { id: 'corp-5', name: 'КарДилер', autodealers: 6, avgAiScore: 79.5, answerRate: 74, lastAudit: new Date(Date.now() - 86400000).toISOString().slice(0, 10), trend: -1 },
            ]
            : [];
        const dealers = useMock
            ? (0, dealershipDirectory_1.getDealershipDirectory)().map((d, idx) => ({
                id: d.id,
                name: d.name,
                city: d.city,
                avgScore: [84.2, 79.3, 87.6, 52.1, 91.2][idx] ?? 75,
                audits: [24, 18, 31, 12, 40][idx] ?? 15,
                bestEmployee: ['Иван П.', 'Мария К.', 'Алексей В.', 'Ольга С.', 'Дмитрий Л.'][idx] ?? '—',
                worstMetric: ['—', 'Answer time', '—', 'Script adherence', '—'][idx] ?? '—',
                workStartHour: d.workStartHour,
                workEndHour: d.workEndHour,
            }))
            : [];
        res.json({ companies, dealers });
    }
    catch (err) {
        console.error('super-admin/mock-entities error:', err);
        res.json({ companies: [], dealers: [] });
    }
});
// Settings (view-only): scripts count, phones count, language, telephony
app.get('/api/admin/super-admin/settings', async (_req, res) => {
    try {
        const [testCount, phoneResult] = await Promise.all([
            db_1.prisma.test.count(),
            db_1.prisma.voiceCallSession.findMany({ select: { to: true } }).then((sessions) => {
                const distinct = new Set(sessions.map((s) => s.to));
                return distinct.size;
            }),
        ]);
        res.json({
            totalScripts: testCount,
            totalPhones: phoneResult,
            platformLanguage: 'RU / KZ',
            telephonyProvider: 'Voximplant',
        });
    }
    catch (err) {
        console.error('super-admin/settings error:', err);
        res.json({
            totalScripts: 0,
            totalPhones: 0,
            platformLanguage: 'RU / KZ',
            telephonyProvider: '—',
        });
    }
});
// Fallback: for any non-API GET request, serve Mini App (so /index.html etc. work)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/'))
        return next();
    if (req.path.startsWith('/webhooks/'))
        return next();
    if (INDEX_HTML_PATH) {
        try {
            return sendIndexHtml(res);
        }
        catch (err) {
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
    if (req.path.startsWith('/webhooks/')) {
        return res.status(404).json({ error: 'Webhook route not found', path: req.path });
    }
    sendErrorHtml(res, 404, 'Страница не найдена', `Запрошенный адрес «${req.path}» не найден. Mini App открывается по корневому адресу (/) — проверьте URL в настройках бота.`);
});
function startServer() {
    return new Promise((resolve, reject) => {
        // Try multiple paths for certificates (dev and production)
        const possibleCertPaths = [
            path_1.default.join(process.cwd(), 'cert.pem'),
            path_1.default.join(__dirname, '../../cert.pem'),
            path_1.default.join(__dirname, '../cert.pem'),
        ];
        const possibleKeyPaths = [
            path_1.default.join(process.cwd(), 'key.pem'),
            path_1.default.join(__dirname, '../../key.pem'),
            path_1.default.join(__dirname, '../key.pem'),
        ];
        let certPath = null;
        let keyPath = null;
        for (const cp of possibleCertPaths) {
            if (fs_1.default.existsSync(cp)) {
                certPath = cp;
                break;
            }
        }
        for (const kp of possibleKeyPaths) {
            if (fs_1.default.existsSync(kp)) {
                keyPath = kp;
                break;
            }
        }
        // For tunnel (Cloudflare), always use HTTP - tunnel provides HTTPS
        // When miniAppUrl is localhost, always use HTTP so the site loads in browser immediately
        const useTunnel = config_1.config.miniAppUrl.includes('trycloudflare.com') || config_1.config.miniAppUrl.includes('loca.lt') || config_1.config.miniAppUrl.includes('localtunnel.me') || config_1.config.miniAppUrl.includes('serveo') || config_1.config.miniAppUrl.includes('lhr.life');
        const isLocalhost = config_1.config.miniAppUrl.includes('localhost') || config_1.config.miniAppUrl.includes('127.0.0.1');
        const useHttp = useTunnel || isLocalhost || !certPath || !keyPath || !config_1.config.miniAppUrl.startsWith('https://');
        const onListen = () => {
            (0, callBatchOrchestrator_1.startCallBatchOrchestrator)();
            resolve();
        };
        const host = '0.0.0.0'; // listen on all interfaces (Railway requires this)
        const port = parseInt(process.env.PORT || String(config_1.config.port), 10);
        const onError = (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error('[ERROR] Port ' + port + ' is already in use.');
                console.error('        Stop the other process or use another port: PORT=3002 npm run dev');
            }
            else {
                console.error('[ERROR] Server error:', err);
            }
            reject(err);
        };
        function attachVoiceStream(server) {
            const wss = new ws_1.WebSocketServer({ noServer: true });
            wss.on('connection', (ws, _req) => {
                console.log('[voice/stream] Client connected, waiting for message');
                ws.on('message', (data) => {
                    (0, voiceStream_1.handleVoiceStreamMessage)(ws, data.toString());
                });
            });
            server.on('upgrade', (request, socket, head) => {
                if (request.url?.startsWith('/voice/stream')) {
                    wss.handleUpgrade(request, socket, head, (ws) => {
                        wss.emit('connection', ws, request);
                    });
                }
                else {
                    socket.destroy();
                }
            });
        }
        if (!useHttp && certPath && keyPath) {
            const options = {
                key: fs_1.default.readFileSync(keyPath),
                cert: fs_1.default.readFileSync(certPath),
            };
            const httpsServer = https_1.default.createServer(options, app);
            attachVoiceStream(httpsServer);
            httpsServer.on('error', onError);
            httpsServer.listen(port, host, () => {
                console.log('[OK] HTTPS server: http://localhost:' + port);
                console.log('     Mini App URL: ' + config_1.config.miniAppUrl);
                console.log('     (Self-signed cert - Telegram may show warning)');
                onListen();
            });
        }
        else {
            const httpServer = http_1.default.createServer(app);
            attachVoiceStream(httpServer);
            httpServer.on('error', onError);
            httpServer.listen(port, host, () => {
                const voiceUrls = (0, startVoiceCall_1.resolveVoiceCallUrls)();
                console.log('[OK] HTTP server: http://localhost:' + port);
                console.log('     Open in browser: http://localhost:' + port);
                console.log('     Health: http://localhost:' + port + '/health');
                console.log('     Voice stream: ws://localhost:' + port + '/voice/stream');
                console.log('     Vox webhook event_url: ' + (voiceUrls.eventUrl || '(not resolved)'));
                if (useTunnel) {
                    console.log('     Tunnel will provide HTTPS for Telegram.');
                }
                onListen();
            });
        }
    });
}
//# sourceMappingURL=server.js.map