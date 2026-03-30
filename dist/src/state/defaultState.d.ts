import type { ConversationPhase, PhaseChecks } from '../logic/phaseManager';
import type { TopicMap } from '../logic/topicStateMachine';
import type { ClientProfile, ObjectionType } from '../logic/clientProfile';
export type ChecklistValue = 'unknown' | 'done' | 'missed';
export declare const CHECKLIST_KEYS: readonly ["greeted_and_introduced", "asked_about_specific_car", "presented_car_benefits", "invited_to_visit_today", "mentioned_underground_mall_inspection", "mentioned_wide_assortment", "offered_trade_in_buyout", "explained_financing_8_banks", "agreed_exact_visit_datetime", "agreed_next_contact_datetime", "discussed_address_and_how_to_get"];
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];
export type Checklist = Record<ChecklistKey, ChecklistValue>;
export type Stage = 'opening' | 'car_interest' | 'value_questions' | 'objections' | 'visit_scheduling' | 'logistics' | 'wrap_up';
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
export interface CommunicationMonitor {
    tone: 'positive' | 'neutral' | 'negative' | 'hostile';
    engagement: 'active' | 'passive' | 'disengaged';
    filler_total: number;
    profanity_detected: boolean;
    prohibited_phrases: string[];
}
export interface DialogState {
    phase: ConversationPhase;
    topics: TopicMap;
    client_profile: ClientProfile;
    phase_checks: PhaseChecks;
    communication: CommunicationMonitor;
    low_effort_streak: number;
    objection_triggered: ObjectionType | null;
    client_turns: number;
    dialog_health: DialogHealth;
    loop_guard: LoopGuard;
    fact_context: FactContext;
    strictnessState: StrictnessState;
    stage: Stage;
    checklist: Checklist;
    notes: string;
}
export type TopicLifecycleState = {
    asked: boolean;
    clarified: boolean;
    closed: boolean;
};
export type TopicKey = 'credit' | 'trade_in' | 'visit_time' | 'address_logistics' | 'assortment' | 'inspection_place';
export type TopicLifecycle = Record<TopicKey, TopicLifecycleState>;
export declare function getDefaultState(profile?: ClientProfile): DialogState;
/**
 * Safely merge raw JSON (from DB) over defaults, handling missing v2 fields
 * for sessions that started before the upgrade.
 */
export declare function mergeStateFromJson(raw: Record<string, any>, profile?: ClientProfile): DialogState;
//# sourceMappingURL=defaultState.d.ts.map