import { openai } from '../lib/openaiClient';

export interface TrainingAssessmentInput {
  dialogHistory: Array< { role: 'client' | 'manager'; content: string }>;
  userName?: string;
}

export interface AssessmentStep {
  step_order: number;
  step_score: number;
  feedback?: string;
  better_example?: string;
}

export interface AssessmentResult {
  score: number;
  quality: string;
  improvements: string[];
  mistakes: string[];
  steps?: AssessmentStep[];
}

export interface TrainingAssessmentOutput {
  formattedText: string;
  data: AssessmentResult;
}

/**
 * Generate a simplified personal assessment for the manager after training.
 * Returns formatted text and parsed data for storage.
 */
export async function generateTrainingAssessment(input: TrainingAssessmentInput): Promise<TrainingAssessmentOutput> {
  const historyStr = input.dialogHistory
    .map((m) => (m.role === 'client' ? `Клиент: ${m.content}` : `Менеджер: ${m.content}`))
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Ты эксперт по оценке навыков продаж в автосалоне. Оцени диалог менеджера с клиентом.

Верни ТОЛЬКО валидный JSON:
{
  "score": <число 0-100, средний балл за общение>,
  "quality": "<1-2 предложения о качестве ответов, на русском>",
  "improvements": ["<строка>", "<строка>"],
  "mistakes": ["<строка>", "<строка>"],
  "steps": [
    {
      "step_order": 1,
      "step_score": <0-100, оценка ответа менеджера на этот шаг>,
      "feedback": "<краткая оценка ответа, на русском>",
      "better_example": "<пример лучшего ответа, если балл < 76, иначе null>"
    }
  ]
}

Все тексты на русском. steps — массив по одному элементу на каждую пару "клиент сказал — менеджер ответил". step_order = 1, 2, 3... better_example указывай только при step_score < 76.`,
      },
      {
        role: 'user',
        content: `Диалог:\n\n${historyStr}\n\nОцени менеджера. Верни JSON.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 1500,
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Оценка не сформирована.');
  }

  try {
    const parsed = JSON.parse(text) as AssessmentResult;
    const score = Math.min(100, Math.max(0, Number(parsed.score) || 0));
    const quality = parsed.quality || '';
    const improvements = Array.isArray(parsed.improvements) ? parsed.improvements.filter(Boolean) : [];
    const mistakes = Array.isArray(parsed.mistakes) ? parsed.mistakes.filter(Boolean) : [];
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.map((s) => ({
          step_order: s.step_order,
          step_score: Math.min(100, Math.max(0, Number(s.step_score) || 0)),
          feedback: s.feedback || undefined,
          better_example: s.better_example || undefined,
        }))
      : undefined;

    const data: AssessmentResult = { score, quality, improvements, mistakes, steps };

    const parts: string[] = [];
    parts.push(`📈 Оценка: ${score}/100`);
    parts.push('');
    if (quality) {
      parts.push(`💬 Качество:`);
      parts.push(quality);
      parts.push('');
    }
    if (improvements.length > 0) {
      parts.push(`✨ Где можно лучше:`);
      improvements.forEach((s) => parts.push(`• ${s}`));
      parts.push('');
    }
    if (mistakes.length > 0) {
      parts.push(`⚠️ Ошибки:`);
      mistakes.forEach((s) => parts.push(`• ${s}`));
    }

    return {
      formattedText: parts.join('\n').trim(),
      data,
    };
  } catch {
    return {
      formattedText: text,
      data: { score: 0, quality: '', improvements: [], mistakes: [] },
    };
  }
}
