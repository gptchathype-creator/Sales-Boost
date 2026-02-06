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

export interface DialogHealth {
  patience: number;   // 0..100
  trust: number;      // 0..100
  confusion: number;  // 0..100
  irritation: number; // 0..100
}

export interface TopicLifecycleState {
  asked: boolean;
  clarified: boolean;
  closed: boolean;
}

export type TopicKey =
  | 'credit'
  | 'trade_in'
  | 'visit_time'
  | 'address_logistics'
  | 'assortment'
  | 'inspection_place';

export type TopicLifecycle = Record<TopicKey, TopicLifecycleState>;

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
}

export interface StrictnessState {
  strictness: 'low' | 'medium' | 'high';
  max_client_turns: number;
}

export interface DialogState {
  stage: Stage;
  checklist: Checklist;
  notes: string;
  client_turns: number;
  dialog_health: DialogHealth;
  topic_lifecycle: TopicLifecycle;
  loop_guard: LoopGuard;
  strictnessState: StrictnessState;
  fact_context: FactContext;
}

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

const initialTopicLifecycleState: TopicLifecycleState = {
  asked: false,
  clarified: false,
  closed: false,
};

const initialTopicLifecycle: TopicLifecycle = {
  credit: { ...initialTopicLifecycleState },
  trade_in: { ...initialTopicLifecycleState },
  visit_time: { ...initialTopicLifecycleState },
  address_logistics: { ...initialTopicLifecycleState },
  assortment: { ...initialTopicLifecycleState },
  inspection_place: { ...initialTopicLifecycleState },
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
};

export function getDefaultState(): DialogState {
  return {
    stage: 'opening',
    checklist: { ...initialChecklist },
    notes: '',
    client_turns: 0,
    dialog_health: { ...initialDialogHealth },
    topic_lifecycle: { ...initialTopicLifecycle },
    loop_guard: { ...initialLoopGuard },
    strictnessState: { ...initialStrictnessState },
    fact_context: { ...initialFactContext },
  };
}
