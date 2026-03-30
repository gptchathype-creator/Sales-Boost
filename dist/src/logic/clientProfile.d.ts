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
export declare function getProfileConfig(profile: ClientProfile): ProfileConfig;
export declare function pickRandomObjection(profile: ClientProfile): ObjectionType;
export declare function profileToPromptDescription(profile: ClientProfile): string;
//# sourceMappingURL=clientProfile.d.ts.map