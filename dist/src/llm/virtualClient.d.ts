import type { Car } from '../data/carLoader';
import type { DialogState } from '../state/defaultState';
import type { ConversationPhase } from '../logic/phaseManager';
import type { TopicCode } from '../logic/topicStateMachine';
import type { BehaviorSignal } from '../logic/behaviorClassifier';
export type Strictness = 'low' | 'medium' | 'high';
export interface VirtualClientOutput {
    client_message: string;
    end_conversation: boolean;
    reason: string;
    diagnostics: {
        current_phase: ConversationPhase;
        topics_addressed: TopicCode[];
        topics_evaded: TopicCode[];
        manager_tone: 'positive' | 'neutral' | 'negative' | 'hostile';
        manager_engagement: 'active' | 'passive' | 'disengaged';
        misinformation_detected: boolean;
        phase_checks_update: Record<string, boolean>;
    };
    update_state: {
        stage: string;
        checklist: Record<string, 'unknown' | 'done' | 'missed'>;
        notes: string;
        client_turns: number;
    };
}
export interface VirtualClientInput {
    car: Car;
    dealership: string;
    state: DialogState;
    manager_last_message: string;
    dialog_history: Array<{
        role: 'client' | 'manager';
        content: string;
    }>;
    strictness?: Strictness;
    max_client_turns?: number;
    behaviorSignal?: BehaviorSignal;
    /** For voice: use lower max_tokens so the model answers shorter and faster. */
    maxResponseTokens?: number;
}
export declare function buildDealershipFromCar(car: Car): string;
export declare function getVirtualClientReply(input: VirtualClientInput): Promise<VirtualClientOutput>;
//# sourceMappingURL=virtualClient.d.ts.map