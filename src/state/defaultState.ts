import type { ConversationPhase, PhaseChecks } from '../logic/phaseManager';
import { createInitialPhaseChecks } from '../logic/phaseManager';
import type { TopicMap } from '../logic/topicStateMachine';
import { createInitialTopicMap } from '../logic/topicStateMachine';
import type { ClientProfile, ObjectionType } from '../logic/clientProfile';

// ── Legacy types (kept for backward compatibility) ──

export type ChecklistValue = 'unknown' | 'done' | 'missed';

export const CHECKLIST_KEYS = [
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

export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];
export type Checklist = Record<ChecklistKey, ChecklistValue>;

export type Stage =
  | 'opening'
  | 'car_interest'
  | 'value_questions'
  | 'objections'
  | 'visit_scheduling'
  | 'logistics'
  | 'wrap_up';

// ── Shared sub-state types ──

export interface DialogHealth {
  patience: number;
  trust: number;
  confusion: number;
  irritation: number;
}

export interface LoopGuard {
  last_client_intent: string;
  repeated_intent_count: number;
  unanswered_question_streak: number;
}

export interface FactContext {
  buyer_knows: {
    inspection_place_known: boolean;
    address_known: boolean;
  };
  misinformation_detected: boolean;
}

export interface StrictnessState {
  strictness: 'low' | 'medium' | 'high';
  max_client_turns: number;
}

// ── V2 Diagnostic State (new fields) ──

export interface CommunicationMonitor {
  tone: 'positive' | 'neutral' | 'negative' | 'hostile';
  engagement: 'active' | 'passive' | 'disengaged';
  filler_total: number;
  profanity_detected: boolean;
  prohibited_phrases: string[];
}

// ── Full Dialog State (V2 with backward compat) ──

export interface DialogState {
  // V2 diagnostic fields
  phase: ConversationPhase;
  topics: TopicMap;
  client_profile: ClientProfile;
  phase_checks: PhaseChecks;
  communication: CommunicationMonitor;
  low_effort_streak: number;
  objection_triggered: ObjectionType | null;

  // Shared
  client_turns: number;
  dialog_health: DialogHealth;
  loop_guard: LoopGuard;
  fact_context: FactContext;
  strictnessState: StrictnessState;

  // Legacy (maintained for backward compat with existing sessions)
  stage: Stage;
  checklist: Checklist;
  notes: string;
}

// ── Legacy types re-exported for old imports ──

export type TopicLifecycleState = { asked: boolean; clarified: boolean; closed: boolean };
export type TopicKey = 'credit' | 'trade_in' | 'visit_time' | 'address_logistics' | 'assortment' | 'inspection_place';
export type TopicLifecycle = Record<TopicKey, TopicLifecycleState>;

// ── Defaults ──

const initialChecklist: Checklist = {
  greeted_and_introduced: 'unknown',
  asked_about_specific_car: 'unknown',
  presented_car_benefits: 'unknown',
  invited_to_visit_today: 'unknown',
  mentioned_underground_mall_inspection: 'unknown',
  mentioned_wide_assortment: 'unknown',
  offered_trade_in_buyout: 'unknown',
  explained_financing_8_banks: 'unknown',
  agreed_exact_visit_datetime: 'unknown',
  agreed_next_contact_datetime: 'unknown',
  discussed_address_and_how_to_get: 'unknown',
};

const initialDialogHealth: DialogHealth = {
  patience: 70,
  trust: 60,
  confusion: 0,
  irritation: 0,
};

const initialLoopGuard: LoopGuard = {
  last_client_intent: '',
  repeated_intent_count: 0,
  unanswered_question_streak: 0,
};

const initialStrictnessState: StrictnessState = {
  strictness: 'medium',
  max_client_turns: 10,
};

const initialFactContext: FactContext = {
  buyer_knows: {
    inspection_place_known: false,
    address_known: false,
  },
  misinformation_detected: false,
};

const initialCommunication: CommunicationMonitor = {
  tone: 'neutral',
  engagement: 'active',
  filler_total: 0,
  profanity_detected: false,
  prohibited_phrases: [],
};

export function getDefaultState(profile: ClientProfile = 'normal'): DialogState {
  return {
    phase: 'first_contact',
    topics: createInitialTopicMap(),
    client_profile: profile,
    phase_checks: createInitialPhaseChecks(),
    communication: { ...initialCommunication },
    low_effort_streak: 0,
    objection_triggered: null,

    client_turns: 0,
    dialog_health: { ...initialDialogHealth },
    loop_guard: { ...initialLoopGuard },
    strictnessState: { ...initialStrictnessState },
    fact_context: { ...initialFactContext },

    stage: 'opening',
    checklist: { ...initialChecklist },
    notes: '',
  };
}

/**
 * Safely merge raw JSON (from DB) over defaults, handling missing v2 fields
 * for sessions that started before the upgrade.
 */
export function mergeStateFromJson(raw: Record<string, any>, profile: ClientProfile = 'normal'): DialogState {
  const base = getDefaultState(profile);
  return {
    phase: raw.phase ?? base.phase,
    topics: raw.topics ? { ...base.topics, ...raw.topics } : base.topics,
    client_profile: raw.client_profile ?? raw.clientProfile ?? profile,
    phase_checks: raw.phase_checks
      ? deepMerge(base.phase_checks, raw.phase_checks)
      : base.phase_checks,
    communication: raw.communication
      ? { ...base.communication, ...raw.communication }
      : base.communication,
    low_effort_streak: raw.low_effort_streak ?? 0,
    objection_triggered: raw.objection_triggered ?? null,

    client_turns: raw.client_turns ?? base.client_turns,
    dialog_health: { ...base.dialog_health, ...(raw.dialog_health ?? {}) },
    loop_guard: { ...base.loop_guard, ...(raw.loop_guard ?? {}) },
    strictnessState: {
      ...base.strictnessState,
      ...(raw.strictnessState ?? {}),
    },
    fact_context: raw.fact_context
      ? deepMerge(base.fact_context, raw.fact_context)
      : base.fact_context,

    stage: raw.stage ?? base.stage,
    checklist: { ...base.checklist, ...(raw.checklist ?? {}) },
    notes: raw.notes ?? base.notes,
  };
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
