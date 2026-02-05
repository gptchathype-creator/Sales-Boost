import { z } from 'zod';
import { openai } from '../lib/openaiClient';
import type { Car } from '../data/carLoader';
import type { DialogState } from '../state/defaultState';

const CHECKLIST_KEYS = [
  'greeted_and_introduced',
  'asked_about_specific_car',
  'presented_car_benefits',
  'invited_to_visit_today',
  'mentioned_underground_mall_inspection',
  'mentioned_wide_assortment',
  'offered_trade_in_buyout',
  'explained_financing_8_banks',
  'agreed_exact_visit_datetime',
  'agreed_next_contact_datetime',
  'discussed_address_and_how_to_get',
] as const;

type ChecklistValue = 'unknown' | 'done' | 'missed';

function normalizeChecklist(raw: unknown): Record<string, ChecklistValue> {
  const out: Record<string, ChecklistValue> = {};
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  for (const key of CHECKLIST_KEYS) {
    const v = obj[key];
    out[key] = v === 'done' || v === 'missed' ? v : 'unknown';
  }
  return out;
}

export interface VirtualClientOutput {
  client_message: string;
  end_conversation: boolean;
  reason: string;
  update_state: {
    stage: string;
    checklist: Record<string, ChecklistValue>;
    notes: string;
    client_turns: number;
  };
}

export const VirtualClientOutputSchema = z.object({
  client_message: z.string(),
  end_conversation: z.boolean(),
  reason: z.string(),
  update_state: z.object({
    stage: z.string(),
    checklist: z.record(z.string(), z.enum(['unknown', 'done', 'missed'])),
    notes: z.string(),
    client_turns: z.number(),
  }),
});

export type Strictness = 'low' | 'medium' | 'high';

export interface VirtualClientInput {
  car: Car;
  dealership: string;
  state: DialogState;
  manager_last_message: string;
  dialog_history: Array<{ role: 'client' | 'manager'; content: string }>;
  /** low=fast/practical, medium=balanced, high=attentive */
  strictness?: Strictness;
  /** End dialog when client_turns >= this (default 14) */
  max_client_turns?: number;
}

const SYSTEM_PROMPT = `You are a virtual customer communicating with a car dealership sales manager.
Your task is to conduct a NATURAL, realistic conversation about buying a car.

This is NOT a test, NOT an interview, and NOT a checklist conversation.
You must sound like a real person who remembers what has already been discussed.

--------------------------------
CORE BEHAVIOR PRINCIPLES
--------------------------------

1. NATURAL MEMORY
You MUST remember what the manager already said.
If a topic was discussed, you must not return to it in the same form again.

You MAY:
- ask a clarifying follow-up if the previous answer was incomplete or vague
- deepen the topic once, from a new angle

You MUST NOT:
- repeat the same question
- ask the same thing using different wording multiple times
- circle around one topic more than twice total

If something is already clear enough — MOVE FORWARD.

--------------------------------
NO MANAGER GUIDANCE
--------------------------------

- Do NOT give hints, suggestions, or feedback to the manager.
- Do NOT ask the manager to clarify or "answer in more detail".
- Accept any manager reply as-is, regardless of length or quality.

Your job is to RESPOND and MOVE THE DIALOG FORWARD, not to train directly.

--------------------------------
DIALOG FLOW LOGIC
--------------------------------

You control the pacing and direction of the conversation.

Conversation stages:
opening -> car_interest -> value_questions -> objections -> visit_scheduling -> logistics -> wrap_up

Rules:
- Each new message must introduce NEW information, intent, or progression.
- Never regress to earlier stages unless absolutely necessary.
- Never stay on one stage for too long.
- The dialog must feel like a real phone/chat conversation.

--------------------------------
TOPIC HANDLING RULES (VERY IMPORTANT)
--------------------------------

For each topic below:

- You may INITIATE it once.
- You may CLARIFY it once if needed.
- After that, the topic is CLOSED.

Topics:
- credit / banks
- trade-in / buyout
- visit timing
- address / location / parking
- other cars / assortment
- inspection conditions

If a topic is closed, do NOT return to it again.

--------------------------------
OBJECTIONS
--------------------------------

You may use at most ONE objection per dialog.
Choose only ONE:
- price concern
- trust / mileage concern
- competitor mention
- hesitation about credit

After the objection is addressed, MOVE ON.
Do not escalate or repeat objections.

--------------------------------
STRICTNESS & DIALOG LENGTH
--------------------------------

You will receive:
- strictness: "low" | "medium" | "high"
- max_client_turns: number

Behavior by strictness:
- low: fast, practical, goal-oriented
- medium: balanced, curious, realistic
- high: attentive, asks clarifying questions, but still reasonable

Regardless of strictness:
- When client_turns >= max_client_turns → END the dialog.
- When a visit OR next contact time is agreed → END the dialog.

--------------------------------
END CONDITIONS
--------------------------------

End the conversation when ANY is true:
1) Exact visit date/time is agreed and logistics discussed
2) Next contact date/time is agreed
3) client_turns reaches max_client_turns
4) The conversation naturally reaches a conclusion

--------------------------------
OUTPUT FORMAT (STRICT JSON ONLY)
--------------------------------

Return ONLY valid JSON:

{
  "client_message": "string",
  "end_conversation": false,
  "reason": "string",
  "update_state": {
    "stage": "string",
    "checklist": {
      "greeted_and_introduced": "unknown|done|missed",
      "asked_about_specific_car": "unknown|done|missed",
      "presented_car_benefits": "unknown|done|missed",
      "invited_to_visit_today": "unknown|done|missed",
      "mentioned_underground_mall_inspection": "unknown|done|missed",
      "mentioned_wide_assortment": "unknown|done|missed",
      "offered_trade_in_buyout": "unknown|done|missed",
      "explained_financing_8_banks": "unknown|done|missed",
      "agreed_exact_visit_datetime": "unknown|done|missed",
      "agreed_next_contact_datetime": "unknown|done|missed",
      "discussed_address_and_how_to_get": "unknown|done|missed"
    },
    "notes": "string",
    "client_turns": number
  }
}

--------------------------------
LANGUAGE & STYLE
--------------------------------

- Language: Russian
- Tone: human, calm, realistic
- Length: 1–3 sentences per message
- No emojis
- No meta-commentary

--------------------------------
FIRST MESSAGE
--------------------------------

Start as a real customer who saw the specific car and wants to check availability and basic details.
Do not overload the first message.`;

function buildDealershipContext(car: Car): string {
  const loc = car.location as { city?: string; address?: string; inspection_place?: string };
  const terms = car.deal_terms as { credit?: { banks_count?: number } };
  const banks = terms?.credit?.banks_count ?? 8;
  const inspection = loc?.inspection_place ?? 'подземная парковка ТЦ';
  const city = loc?.city ?? 'город';
  const address = loc?.address ?? '';
  return `Автосалон в ${city}${address ? `, ${address}` : ''}. Осмотр: ${inspection}. Кредит: ${banks} банков-партнёров.`;
}

/** Short car summary to reduce tokens and latency */
function carSummary(car: Car): string {
  const loc = car.location as { city?: string; address?: string; inspection_place?: string };
  const terms = car.deal_terms as { credit?: { banks_count?: number }; trade_in?: boolean; buyout?: boolean };
  return [
    `id: ${car.id}`,
    `title: ${car.title}`,
    `price_rub: ${car.price_rub}`,
    `brand: ${car.brand}, model: ${car.model}, year: ${car.year}, mileage_km: ${car.mileage_km}`,
    `location: ${loc?.city ?? ''}, ${loc?.address ?? ''}, осмотр: ${loc?.inspection_place ?? 'подземная парковка ТЦ'}`,
    `credit: ${terms?.credit?.banks_count ?? 8} банков, trade_in: ${terms?.trade_in ?? false}, buyout: ${terms?.buyout ?? false}`,
  ].join('\n');
}

const HISTORY_LIMIT = 6;
const MAX_RESPONSE_TOKENS = 300;

const FALLBACK_CLIENT_MESSAGE = 'Хорошо, давайте уточним детали. Когда удобно приехать на осмотр?';

/** Try to extract client_message from raw text when JSON is invalid */
function extractMessageFromRaw(raw: string): string {
  const cleaned = raw.trim();
  const jsonMatch = cleaned.match(/"client_message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (jsonMatch && jsonMatch[1]) {
    return jsonMatch[1].replace(/\\"/g, '"').trim() || FALLBACK_CLIENT_MESSAGE;
  }
  const firstLine = cleaned.split('\n')[0]?.trim() || '';
  if (firstLine.length > 5 && firstLine.length < 500 && !firstLine.startsWith('{')) {
    return firstLine;
  }
  return FALLBACK_CLIENT_MESSAGE;
}

/**
 * Parse LLM response defensively: only require client_message; build update_state from whatever we get.
 * Never throws: uses fallback message if JSON invalid or client_message missing.
 */
function parseVirtualClientOutput(raw: string, currentState: DialogState): VirtualClientOutput {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim();
  let parsed: unknown;
  let msg = '';
  let endConv = false;
  let reason = '';
  let us: Record<string, unknown> = {};

  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.warn('Virtual client: JSON.parse failed, using fallback. Raw (first 300):', cleaned.slice(0, 300));
    msg = extractMessageFromRaw(cleaned);
    return {
      client_message: msg,
      end_conversation: false,
      reason: '',
      update_state: {
        stage: currentState.stage,
        checklist: normalizeChecklist({}),
        notes: currentState.notes ?? '',
        client_turns: (currentState.client_turns ?? 0) + 1,
      },
    };
  }

  const o = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  msg = typeof o.client_message === 'string' ? o.client_message : '';
  if (!msg.trim()) {
    console.warn('Virtual client: missing client_message, using fallback. Raw (first 300):', cleaned.slice(0, 300));
    msg = extractMessageFromRaw(cleaned);
  }
  endConv = o.end_conversation === true;
  reason = typeof o.reason === 'string' ? o.reason : '';
  us = o.update_state && typeof o.update_state === 'object' ? (o.update_state as Record<string, unknown>) : {};
  const stage = typeof us.stage === 'string' ? us.stage : currentState.stage;
  const notes = typeof us.notes === 'string' ? us.notes : (currentState.notes ?? '');
  const ct = us.client_turns;
  const client_turns =
    typeof ct === 'number' && Number.isFinite(ct) ? ct : typeof ct === 'string' ? parseInt(String(ct), 10) || (currentState.client_turns ?? 0) + 1 : (currentState.client_turns ?? 0) + 1;

  return {
    client_message: msg.trim() || FALLBACK_CLIENT_MESSAGE,
    end_conversation: endConv,
    reason,
    update_state: {
      stage,
      checklist: normalizeChecklist(us.checklist),
      notes,
      client_turns,
    },
  };
}

/**
 * Call virtual client LLM; defensive parse so we never fail on structure. Fast model + short context.
 */
export async function getVirtualClientReply(input: VirtualClientInput): Promise<VirtualClientOutput> {
  const carStr = carSummary(input.car);
  const history = input.dialog_history.slice(-HISTORY_LIMIT);
  const historyStr = history
    .map((m) => `${m.role === 'client' ? 'Клиент' : 'Менеджер'}: ${m.content}`)
    .join('\n');

  const strictness = input.strictness ?? 'medium';
  const maxClientTurns = input.max_client_turns ?? 14;

  const userContent = `car:
${carStr}

dealership: ${input.dealership}

state: stage=${input.state.stage}, client_turns=${input.state.client_turns}
strictness: ${strictness}
max_client_turns: ${maxClientTurns}

manager_last_message: ${input.manager_last_message ? `"${input.manager_last_message}"` : '(first message)'}

${historyStr ? `Conversation:\n${historyStr}\n` : ''}
If client_turns >= ${maxClientTurns}, set end_conversation=true. Return ONLY valid JSON (client_message, end_conversation, reason, update_state with stage, checklist, notes, client_turns). Keep client_message 1-3 sentences.`;

  let content: string | null = null;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: MAX_RESPONSE_TOKENS,
    });
    content = response.choices[0]?.message?.content ?? null;
  } catch (apiErr) {
    const err = apiErr as { status?: number; code?: string; message?: string };
    const status = err?.status;
    const code = err?.code;
    const errMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
    console.error('[virtualClient] OpenAI API error:', { status, code, message: errMsg });
    if (status === 401 || code === 'invalid_api_key') {
      throw new Error('OpenAI: неверный API ключ. Проверьте OPENAI_API_KEY в .env');
    }
    if (status === 429 || code === 'insufficient_quota' || (typeof errMsg === 'string' && errMsg.toLowerCase().includes('quota'))) {
      throw new Error('OpenAI: закончился баланс или лимит. Пополните счёт на platform.openai.com');
    }
    if (status === 403 && code === 'unsupported_country_region_territory') {
      throw new Error(
        'OpenAI: API недоступен в вашем регионе. Используйте VPN/прокси: добавьте HTTPS_PROXY в .env (например HTTPS_PROXY=http://127.0.0.1:7890) и перезапустите бота.'
      );
    }
    if (status === 403) {
      throw new Error('OpenAI: доступ запрещён (баланс или права на модель).');
    }
    throw new Error(`OpenAI API: ${errMsg}`);
  }

  if (!content || !content.trim()) {
    console.warn('Virtual client: empty response, using fallback');
    return parseVirtualClientOutput(
      JSON.stringify({ client_message: FALLBACK_CLIENT_MESSAGE, end_conversation: false, reason: '', update_state: { stage: input.state.stage, checklist: {}, notes: '', client_turns: (input.state.client_turns ?? 0) + 1 } }),
      input.state
    );
  }

  return parseVirtualClientOutput(content, input.state);
}

export function buildDealershipFromCar(car: Car): string {
  return buildDealershipContext(car);
}
