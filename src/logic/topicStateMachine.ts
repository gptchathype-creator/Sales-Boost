export type TopicStatus = 'none' | 'asked' | 'answered' | 'clarified' | 'closed';

export const TOPIC_CODES = [
  'intro',
  'salon_name',
  'car_identification',
  'needs',
  'product_presentation',
  'credit',
  'trade_in',
  'objection',
  'next_step',
  'scheduling',
  'follow_up',
] as const;

export type TopicCode = (typeof TOPIC_CODES)[number];

export interface TopicState {
  status: TopicStatus;
  evasion_count: number;
}

export type TopicMap = Record<TopicCode, TopicState>;

const CRITICAL_TOPICS: TopicCode[] = [
  'intro',
  'car_identification',
  'needs',
  'next_step',
];

export function createInitialTopicMap(): TopicMap {
  const map = {} as TopicMap;
  for (const code of TOPIC_CODES) {
    map[code] = { status: 'none', evasion_count: 0 };
  }
  return map;
}

const VALID_TRANSITIONS: Record<TopicStatus, TopicStatus[]> = {
  none: ['asked'],
  asked: ['answered', 'asked'],
  answered: ['clarified', 'closed'],
  clarified: ['closed'],
  closed: [],
};

export function advanceTopic(
  map: TopicMap,
  code: TopicCode,
  newStatus: TopicStatus
): { map: TopicMap; valid: boolean } {
  const topic = map[code];
  if (!topic) return { map, valid: false };

  const allowed = VALID_TRANSITIONS[topic.status];
  if (!allowed.includes(newStatus)) {
    return { map, valid: false };
  }

  return {
    map: {
      ...map,
      [code]: { ...topic, status: newStatus },
    },
    valid: true,
  };
}

export function recordEvasion(map: TopicMap, code: TopicCode): TopicMap {
  const topic = map[code];
  if (!topic) return map;
  return {
    ...map,
    [code]: { ...topic, evasion_count: topic.evasion_count + 1 },
  };
}

export interface EvasionCheckResult {
  shouldFail: boolean;
  failedTopic: TopicCode | null;
}

export function checkCriticalEvasions(map: TopicMap): EvasionCheckResult {
  for (const code of CRITICAL_TOPICS) {
    const topic = map[code];
    if (topic && topic.evasion_count >= 2) {
      return { shouldFail: true, failedTopic: code };
    }
  }
  return { shouldFail: false, failedTopic: null };
}

export function isTopicClosed(map: TopicMap, code: TopicCode): boolean {
  return map[code]?.status === 'closed';
}

export function canReopenTopic(
  map: TopicMap,
  code: TopicCode,
  reason: 'ignored' | 'contradiction' | 'misinformation'
): boolean {
  const topic = map[code];
  if (!topic) return false;
  if (topic.status !== 'closed') return true;
  return reason === 'contradiction' || reason === 'misinformation';
}
