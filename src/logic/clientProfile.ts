export type ClientProfile = 'normal' | 'thorough' | 'pressure';

export interface ProfileConfig {
  min_turns: number;
  max_turns: number;
  clarification_probability: number;
  double_check_credit_tradein: boolean;
  provocation_level: 'none' | 'mild' | 'high';
  objection_types: ObjectionType[];
  patience_base: number;
  trust_base: number;
}

export type ObjectionType = 'credit' | 'trade_in' | 'price' | 'competitor';

const PROFILE_CONFIGS: Record<ClientProfile, ProfileConfig> = {
  normal: {
    min_turns: 6,
    max_turns: 10,
    clarification_probability: 0.2,
    double_check_credit_tradein: false,
    provocation_level: 'none',
    objection_types: ['price'],
    patience_base: 70,
    trust_base: 60,
  },
  thorough: {
    min_turns: 8,
    max_turns: 14,
    clarification_probability: 0.5,
    double_check_credit_tradein: true,
    provocation_level: 'mild',
    objection_types: ['credit', 'trade_in', 'price'],
    patience_base: 80,
    trust_base: 50,
  },
  pressure: {
    min_turns: 6,
    max_turns: 12,
    clarification_probability: 0.4,
    double_check_credit_tradein: true,
    provocation_level: 'high',
    objection_types: ['price', 'competitor', 'credit'],
    patience_base: 50,
    trust_base: 40,
  },
};

export function getProfileConfig(profile: ClientProfile): ProfileConfig {
  return PROFILE_CONFIGS[profile] ?? PROFILE_CONFIGS.normal;
}

export function pickRandomObjection(profile: ClientProfile): ObjectionType {
  const config = getProfileConfig(profile);
  const types = config.objection_types;
  return types[Math.floor(Math.random() * types.length)];
}

export function profileToPromptDescription(profile: ClientProfile): string {
  switch (profile) {
    case 'normal':
      return `You are a NORMAL buyer: practical, goal-oriented, asking direct questions. 
You are not picky. You want basic info and to schedule a visit if things sound right. 
Minimal clarifications. Don't linger on topics. Move the conversation forward briskly.`;
    case 'thorough':
      return `You are a THOROUGH buyer: careful, detail-oriented, wants to understand everything.
You double-check credit terms and trade-in conditions. You ask follow-up questions.
You compare options. You need to feel confident before committing.
Still reasonable — not aggressive, just meticulous.`;
    case 'pressure':
      return `You are a PRESSURE buyer: demanding, tests the manager's composure.
You challenge the price. You mention competitors offering better deals.
You express doubt about the car's condition. You push for discounts.
You are not rude — but you are tough and skeptical. You test professionalism.`;
  }
}
