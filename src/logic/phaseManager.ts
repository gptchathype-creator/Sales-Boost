import type { TopicMap, TopicCode } from './topicStateMachine';

export type ConversationPhase =
  | 'first_contact'
  | 'needs_discovery'
  | 'product_presentation'
  | 'money_and_objections'
  | 'closing_attempt';

export const PHASE_ORDER: ConversationPhase[] = [
  'first_contact',
  'needs_discovery',
  'product_presentation',
  'money_and_objections',
  'closing_attempt',
];

const PHASE_INDEX: Record<ConversationPhase, number> = {
  first_contact: 0,
  needs_discovery: 1,
  product_presentation: 2,
  money_and_objections: 3,
  closing_attempt: 4,
};

export function canTransitionPhase(
  current: ConversationPhase,
  next: ConversationPhase
): boolean {
  const ci = PHASE_INDEX[current];
  const ni = PHASE_INDEX[next];
  return ni >= ci && ni <= ci + 2;
}

const PHASE_TOPIC_REQUIREMENTS: Record<ConversationPhase, TopicCode[]> = {
  first_contact: ['intro', 'salon_name', 'car_identification'],
  needs_discovery: ['needs'],
  product_presentation: ['product_presentation'],
  money_and_objections: ['credit', 'trade_in', 'objection'],
  closing_attempt: ['next_step', 'scheduling', 'follow_up'],
};

export function inferPhaseFromTopics(topics: TopicMap): ConversationPhase {
  const closingTopics = PHASE_TOPIC_REQUIREMENTS.closing_attempt;
  if (closingTopics.some((t) => topics[t]?.status === 'asked' || topics[t]?.status === 'answered')) {
    return 'closing_attempt';
  }

  const moneyTopics = PHASE_TOPIC_REQUIREMENTS.money_and_objections;
  if (moneyTopics.some((t) => topics[t]?.status === 'asked' || topics[t]?.status === 'answered')) {
    return 'money_and_objections';
  }

  const presentTopics = PHASE_TOPIC_REQUIREMENTS.product_presentation;
  if (presentTopics.some((t) => topics[t]?.status === 'asked' || topics[t]?.status === 'answered')) {
    return 'product_presentation';
  }

  const needsTopics = PHASE_TOPIC_REQUIREMENTS.needs_discovery;
  if (needsTopics.some((t) => topics[t]?.status === 'asked' || topics[t]?.status === 'answered')) {
    return 'needs_discovery';
  }

  return 'first_contact';
}

export interface PhaseChecks {
  first_contact: {
    introduced: boolean;
    named_salon: boolean;
    clarified_car: boolean;
    took_initiative: boolean;
  };
  needs_discovery: {
    asked_clarifying_questions: boolean;
    jumped_to_specs: boolean;
  };
  product_presentation: {
    structured: boolean;
    connected_to_needs: boolean;
    misinformation: boolean;
  };
  money_and_objections: {
    shut_down_client: boolean;
    eco_handled: boolean;
    objection_type: string | null;
  };
  closing_attempt: {
    proposed_next_step: boolean;
    suggested_visit: boolean;
    fixed_date_time: boolean;
    suggested_follow_up: boolean;
  };
}

export function createInitialPhaseChecks(): PhaseChecks {
  return {
    first_contact: {
      introduced: false,
      named_salon: false,
      clarified_car: false,
      took_initiative: false,
    },
    needs_discovery: {
      asked_clarifying_questions: false,
      jumped_to_specs: false,
    },
    product_presentation: {
      structured: false,
      connected_to_needs: false,
      misinformation: false,
    },
    money_and_objections: {
      shut_down_client: false,
      eco_handled: false,
      objection_type: null,
    },
    closing_attempt: {
      proposed_next_step: false,
      suggested_visit: false,
      fixed_date_time: false,
      suggested_follow_up: false,
    },
  };
}

export function getPhaseTopics(phase: ConversationPhase): TopicCode[] {
  return PHASE_TOPIC_REQUIREMENTS[phase] ?? [];
}
