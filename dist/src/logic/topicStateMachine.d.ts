export type TopicStatus = 'none' | 'asked' | 'answered' | 'clarified' | 'closed';
export declare const TOPIC_CODES: readonly ["intro", "salon_name", "car_identification", "needs", "product_presentation", "credit", "trade_in", "objection", "next_step", "scheduling", "follow_up"];
export type TopicCode = (typeof TOPIC_CODES)[number];
export interface TopicState {
    status: TopicStatus;
    evasion_count: number;
}
export type TopicMap = Record<TopicCode, TopicState>;
export declare function createInitialTopicMap(): TopicMap;
export declare function advanceTopic(map: TopicMap, code: TopicCode, newStatus: TopicStatus): {
    map: TopicMap;
    valid: boolean;
};
export declare function recordEvasion(map: TopicMap, code: TopicCode): TopicMap;
export interface EvasionCheckResult {
    shouldFail: boolean;
    failedTopic: TopicCode | null;
}
export declare function checkCriticalEvasions(map: TopicMap): EvasionCheckResult;
export declare function isTopicClosed(map: TopicMap, code: TopicCode): boolean;
export declare function canReopenTopic(map: TopicMap, code: TopicCode, reason: 'ignored' | 'contradiction' | 'misinformation'): boolean;
//# sourceMappingURL=topicStateMachine.d.ts.map