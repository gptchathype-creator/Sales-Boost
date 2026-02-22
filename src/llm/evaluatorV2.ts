import { openai } from '../lib/openaiClient';
import type { Car } from '../data/carLoader';
import type { DialogState } from '../state/defaultState';
import {
  type ChecklistItem,
  type EvaluationIssue,
  type EvaluationResult,
  type ScoringOptions,
  CHECKLIST_CODE,
  CHECKLIST_WEIGHTS,
  buildChecklistFromLLMClassification,
  computeDeterministicScore,
  detectIssuesFromChecklist,
} from '../logic/diagnosticScoring';
import type { BehaviorSignal } from '../logic/behaviorClassifier';

// ── Types ──

export interface EvaluatorInput {
  dialogHistory: Array<{ role: 'client' | 'manager'; content: string }>;
  car: Car;
  state: DialogState;
  earlyFail: boolean;
  failureReason?: string;
  behaviorSignals?: BehaviorSignal[];
}

export interface EvaluatorOutput {
  evaluation: EvaluationResult;
  formattedText: string;
}

// ── LLM classification schema (what we ask the LLM to return) ──

interface LLMClassification {
  checklist: Array<{
    code: string;
    status: 'YES' | 'PARTIAL' | 'NO' | 'NA';
    evidence: string[];
    comment: string;
  }>;
  extra_signals: {
    profanity: boolean;
    misinformation: boolean;
    passive_style: boolean;
    passive_severity: 'mild' | 'strong';
    low_engagement: boolean;
    redirect_to_website: boolean;
    bad_tone: boolean;
  };
  recommendations: string[];
}

// ── System prompt for the Evaluator Agent ──

const EVALUATOR_SYSTEM_PROMPT = `Ты — СТРОГИЙ профессиональный оценщик разговоров менеджеров автосалона с клиентами.
Ты анализируешь диалог между менеджером и виртуальным клиентом и формируешь детальную оценку качества.

ВАЖНО: ВЕСЬ твой вывод — evidence, comment, recommendations — ТОЛЬКО НА РУССКОМ ЯЗЫКЕ. Никакого английского текста.

=== ТВОЯ РОЛЬ ===
- Ты — EvaluatorAgent. Ты ТОЛЬКО анализируешь — никогда не участвуешь в диалоге.
- Будь СТРОГИМ. НЕ завышай оценки. Если что-то не было сделано — ставь NO.
- Всегда указывай ДОКАЗАТЕЛЬСТВА: прямые цитаты из диалога НА РУССКОМ.
- Если пункт чеклиста был неприменим (например, trade-in не обсуждался) — ставь NA.

=== ПУНКТЫ ЧЕКЛИСТА ===
По каждому пункту выставь: YES (полностью выполнено), PARTIAL (попытка, но неполная), NO (не выполнено), NA (неприменимо).
Укажи цитаты-доказательства и краткий комментарий НА РУССКОМ.

INTRODUCTION (вес: 8) — Представился ли менеджер по имени?
SALON_NAME (вес: 6) — Назвал ли менеджер автосалон?
CAR_IDENTIFICATION (вес: 7) — Уточнил ли менеджер, какой именно автомобиль интересует?
NEEDS_DISCOVERY (вес: 8) — Задавал ли менеджер вопросы о потребностях клиента?
INITIATIVE (вес: 7) — Проявлял ли менеджер инициативу (предлагал варианты, вёл диалог)?
PRODUCT_PRESENTATION (вес: 10) — Провёл ли менеджер структурированную презентацию автомобиля с привязкой к потребностям клиента?
CREDIT_EXPLANATION (вес: 8) — Объяснил ли менеджер кредитные условия? (NA если тема не поднималась)
TRADEIN_OFFER (вес: 8) — Предложил ли менеджер trade-in? (NA если тема не поднималась)
OBJECTION_HANDLING (вес: 10) — Обработал ли менеджер возражения профессионально? (NA если возражений не было)
NEXT_STEP_PROPOSAL (вес: 10) — Предложил ли менеджер конкретный следующий шаг (визит, тест-драйв, звонок)?
DATE_FIXATION (вес: 8) — Зафиксировал ли менеджер конкретную дату и время?
FOLLOW_UP_AGREEMENT (вес: 5) — Договорился ли менеджер о повторном контакте?
COMMUNICATION_TONE (вес: 5) — Был ли тон общения профессиональным и уместным?

=== ДОПОЛНИТЕЛЬНЫЕ СИГНАЛЫ ===
Определи булевы сигналы:
- profanity: Была ли ненормативная лексика от менеджера?
- misinformation: Сообщал ли менеджер неверные факты об автомобиле?
- passive_style: Был ли менеджер пассивен (ждал вопросов вместо инициативы)?
- passive_severity: "mild" или "strong"
- low_engagement: Проявил ли менеджер низкую вовлечённость?
- redirect_to_website: Перенаправлял ли менеджер на сайт вместо ответа?
- bad_tone: Был ли тон непрофессиональным, холодным или пренебрежительным?

=== РЕКОМЕНДАЦИИ ===
Дай 3–5 конкретных, практичных рекомендаций для менеджера НА РУССКОМ ЯЗЫКЕ.

=== ФОРМАТ ВЫВОДА (СТРОГИЙ JSON) ===
Верни ТОЛЬКО валидный JSON:
{
  "checklist": [
    {
      "code": "INTRODUCTION",
      "status": "YES|PARTIAL|NO|NA",
      "evidence": ["цитата из диалога на русском"],
      "comment": "Краткая оценка на русском"
    },
    ...по каждому из 13 кодов
  ],
  "extra_signals": {
    "profanity": false,
    "misinformation": false,
    "passive_style": false,
    "passive_severity": "mild",
    "low_engagement": false,
    "redirect_to_website": false,
    "bad_tone": false
  },
  "recommendations": ["рекомендация 1", "рекомендация 2", ...]
}

=== ПРАВИЛА ===
- evidence ДОЛЖНЫ быть прямыми цитатами из диалога НА РУССКОМ.
- Если цитату найти невозможно, поставь evidence: [] и объясни в comment.
- ВСЕ тексты (evidence, comment, recommendations) СТРОГО НА РУССКОМ ЯЗЫКЕ.
- НЕ угадывай — оценивай только то, что есть в стенограмме.
- НИКАКОГО английского текста в выводе.`;

// ── Main evaluator function ──

export async function evaluateSessionV2(input: EvaluatorInput): Promise<EvaluatorOutput> {
  const historyStr = input.dialogHistory
    .map((m) => (m.role === 'client' ? `Клиент: ${m.content}` : `Менеджер: ${m.content}`))
    .join('\n\n');

  const carContext = [
    `Автомобиль: ${input.car.title}`,
    `Цена: ${input.car.price_rub} руб.`,
    `Год: ${input.car.year}, Пробег: ${input.car.mileage_km} км`,
    `Марка: ${input.car.brand}, Модель: ${input.car.model}`,
  ].join('\n');

  const failContext = input.earlyFail
    ? `\n\nВАЖНО: Сессия была ДОСРОЧНО ЗАВЕРШЕНА системой. Причина: ${input.failureReason ?? 'unknown'}. Учитывай это при оценке — менеджер не смог завершить диалог нормально.`
    : '';

  // Build behavior evidence summary from code-side classifier
  let behaviorEvidence = '';
  if (input.behaviorSignals && input.behaviorSignals.length > 0) {
    const toxicCount = input.behaviorSignals.filter((s) => s.toxic).length;
    const lowEffortCount = input.behaviorSignals.filter((s) => s.low_effort).length;
    const evasionCount = input.behaviorSignals.filter((s) => s.evasion).length;
    const allProhibited = input.behaviorSignals.flatMap((s) => s.prohibited_phrase_hits);
    const uniqueProhibited = [...new Set(allProhibited)];
    const highSeverityCount = input.behaviorSignals.filter((s) => s.severity === 'HIGH').length;

    const lines: string[] = ['\n=== ПОВЕДЕНЧЕСКИЕ СИГНАЛЫ (от системы, использовать как факты) ==='];
    lines.push(`Всего сообщений менеджера: ${input.behaviorSignals.length}`);
    if (toxicCount > 0) lines.push(`Токсичных сообщений: ${toxicCount} (ФАКТ — учесть при оценке COMMUNICATION_TONE)`);
    if (lowEffortCount > 0) lines.push(`Некачественных/пустых ответов: ${lowEffortCount} из ${input.behaviorSignals.length}`);
    if (evasionCount > 0) lines.push(`Уходов от вопроса: ${evasionCount}`);
    if (uniqueProhibited.length > 0) lines.push(`Запрещённые фразы: ${uniqueProhibited.join(', ')}`);
    if (highSeverityCount > 0) lines.push(`Сообщений с высокой серьёзностью (HIGH): ${highSeverityCount}`);
    lines.push('Эти данные — объективные факты из кода. Используй их как дополнительные доказательства.');
    behaviorEvidence = lines.join('\n');
  }

  const userPrompt = `=== АВТОМОБИЛЬ ===
${carContext}

=== ДИАЛОГ ===${failContext}
${historyStr}
${behaviorEvidence}

=== ЗАДАНИЕ ===
Оцени каждый пункт чеклиста. Верни JSON.`;

  let classification: LLMClassification;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EVALUATOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty evaluator response');
    classification = JSON.parse(text) as LLMClassification;
  } catch (err) {
    console.error('[evaluatorV2] LLM error:', err instanceof Error ? err.message : err);
    classification = buildFallbackClassification(input);
  }

  // Normalize + build typed checklist
  const checklist = buildChecklistFromLLMClassification(
    Array.isArray(classification.checklist) ? classification.checklist : []
  );

  const extra = classification.extra_signals ?? {
    profanity: false,
    misinformation: false,
    passive_style: false,
    passive_severity: 'mild' as const,
    low_engagement: false,
    redirect_to_website: false,
    bad_tone: false,
  };

  // Override from code-side detection (behavior classifier is truth)
  if (input.state.communication?.profanity_detected) {
    extra.profanity = true;
  }
  if (input.state.fact_context?.misinformation_detected) {
    extra.misinformation = true;
  }
  if (input.behaviorSignals && input.behaviorSignals.length > 0) {
    if (input.behaviorSignals.some((s) => s.toxic)) extra.profanity = true;
    const prohibHits = input.behaviorSignals.flatMap((s) => s.prohibited_phrase_hits);
    if (prohibHits.some((h) => h.includes('сайт') || h.includes('объявлени'))) {
      extra.redirect_to_website = true;
    }
    const lowEffortRatio = input.behaviorSignals.filter((s) => s.low_effort).length / input.behaviorSignals.length;
    if (lowEffortRatio > 0.4) extra.low_engagement = true;
    if (lowEffortRatio > 0.6) {
      extra.passive_style = true;
      extra.passive_severity = 'strong';
    }
  }

  const noNextStep = checklist.find((c) => c.code === 'NEXT_STEP_PROPOSAL')?.status === 'NO';

  const scoringOptions: ScoringOptions = {
    earlyFail: input.earlyFail,
    misinformationDetected: extra.misinformation,
    noNextStep: noNextStep ?? false,
    passiveStyle: extra.passive_style,
    passiveSeverity: extra.passive_severity === 'strong' ? 'strong' : 'mild',
  };

  const { score, dimensions } = computeDeterministicScore(checklist, scoringOptions);

  const issues = detectIssuesFromChecklist(checklist, {
    profanity: extra.profanity,
    misinformation: extra.misinformation,
    passiveStyle: extra.passive_style,
    lowEngagement: extra.low_engagement,
    redirectToWebsite: extra.redirect_to_website,
    badTone: extra.bad_tone,
  });

  const recommendations = Array.isArray(classification.recommendations)
    ? classification.recommendations.filter(Boolean)
    : [];

  const evaluation: EvaluationResult = {
    overall_score_0_100: score,
    dimension_scores: dimensions,
    checklist,
    issues,
    recommendations,
  };

  const formattedText = formatEvaluation(evaluation, input.earlyFail, input.failureReason);

  return { evaluation, formattedText };
}

// ── Fallback when LLM fails ──

function buildFallbackClassification(input: EvaluatorInput): LLMClassification {
  const checklist = CHECKLIST_CODE.map((code) => ({
    code,
    status: 'NO' as const,
    evidence: [] as string[],
    comment: 'Оценка не получена от модели.',
  }));

  return {
    checklist,
    extra_signals: {
      profanity: input.state.communication?.profanity_detected ?? false,
      misinformation: input.state.fact_context?.misinformation_detected ?? false,
      passive_style: false,
      passive_severity: 'mild',
      low_engagement: false,
      redirect_to_website: false,
      bad_tone: false,
    },
    recommendations: [
      'Представиться и назвать салон в начале разговора.',
      'Задать уточняющие вопросы о потребностях клиента.',
      'Предложить конкретный следующий шаг и зафиксировать дату.',
    ],
  };
}

// ── Human-readable format for Telegram ──

function formatEvaluation(
  evaluation: EvaluationResult,
  earlyFail: boolean,
  failureReason?: string
): string {
  const parts: string[] = [];

  if (earlyFail) {
    const reasonMap: Record<string, string> = {
      PROFANITY: 'недопустимая лексика',
      BAD_TONE: 'грубый / враждебный тон',
      IGNORED_QUESTIONS: 'игнорирование вопросов клиента',
      POOR_COMMUNICATION: 'низкое качество коммуникации',
      REPEATED_LOW_EFFORT: 'повторные некачественные ответы',
      rude_language: 'недопустимая лексика',
      ignored_questions: 'игнорирование вопросов клиента',
      poor_communication: 'низкое качество коммуникации',
      repeated_low_effort: 'повторные некачественные ответы',
    };
    const base = (failureReason ?? '').split(':')[0];
    const reasonText = reasonMap[base]
      ?? (base === 'CRITICAL_EVASION' || base === 'critical_evasion'
        ? `критический вопрос проигнорирован (${(failureReason ?? '').split(':')[1] ?? ''})`
        : failureReason ?? 'системное прерывание');
    parts.push(`⚠️ Тренировка досрочно прервана: ${reasonText}`);
    parts.push('');
  }

  parts.push(`📊 Общий балл: ${evaluation.overall_score_0_100}/100`);
  parts.push('');

  const d = evaluation.dimension_scores;
  parts.push('📋 По направлениям:');
  parts.push(`  Первый контакт: ${d.first_contact}/100`);
  parts.push(`  Продукт и продажи: ${d.product_and_sales}/100`);
  parts.push(`  Закрытие: ${d.closing_commitment}/100`);
  parts.push(`  Коммуникация: ${d.communication}/100`);
  parts.push('');

  if (evaluation.issues.length > 0) {
    parts.push('⚠️ Проблемы:');
    for (const issue of evaluation.issues.slice(0, 5)) {
      const sevIcon = issue.severity === 'HIGH' ? '🔴' : issue.severity === 'MEDIUM' ? '🟡' : '🟢';
      parts.push(`${sevIcon} ${issue.recommendation}`);
    }
    parts.push('');
  }

  if (evaluation.recommendations.length > 0) {
    parts.push('💡 Рекомендации:');
    for (const rec of evaluation.recommendations.slice(0, 5)) {
      parts.push(`• ${rec}`);
    }
  }

  return parts.join('\n').trim();
}

// ── Legacy bridge: convert V2 evaluation to old assessment format ──

export function evaluationToLegacyAssessment(evaluation: EvaluationResult): {
  score: number;
  quality: string;
  improvements: string[];
  mistakes: string[];
  steps?: Array<{ step_order: number; step_score: number; feedback?: string; better_example?: string }>;
} {
  const qualityTag =
    evaluation.overall_score_0_100 < 50
      ? 'Плохо'
      : evaluation.overall_score_0_100 < 76
        ? 'Средне'
        : 'Хорошо';

  return {
    score: evaluation.overall_score_0_100,
    quality: `${qualityTag}. Балл: ${evaluation.overall_score_0_100}/100.`,
    improvements: evaluation.recommendations,
    mistakes: evaluation.issues.map((i) => i.recommendation),
  };
}
