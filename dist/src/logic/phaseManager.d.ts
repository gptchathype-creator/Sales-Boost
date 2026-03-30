import type { TopicMap, TopicCode } from './topicStateMachine';
export type ConversationPhase = 'first_contact' | 'needs_discovery' | 'product_presentation' | 'money_and_objections' | 'closing_attempt';
export declare const PHASE_ORDER: ConversationPhase[];
export declare function canTransitionPhase(current: ConversationPhase, next: ConversationPhase): boolean;
export declare function inferPhaseFromTopics(topics: TopicMap): ConversationPhase;
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
export declare function createInitialPhaseChecks(): PhaseChecks;
export declare function getPhaseTopics(phase: ConversationPhase): TopicCode[];
//# sourceMappingURL=phaseManager.d.ts.map