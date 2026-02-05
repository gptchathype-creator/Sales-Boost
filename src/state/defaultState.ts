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

export interface DialogState {
  stage: Stage;
  checklist: Checklist;
  notes: string;
  client_turns: number;
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

export function getDefaultState(): DialogState {
  return {
    stage: 'opening',
    checklist: { ...initialChecklist },
    notes: '',
    client_turns: 0,
  };
}
