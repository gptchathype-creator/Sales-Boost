"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPIC_CODES = void 0;
exports.createInitialTopicMap = createInitialTopicMap;
exports.advanceTopic = advanceTopic;
exports.recordEvasion = recordEvasion;
exports.checkCriticalEvasions = checkCriticalEvasions;
exports.isTopicClosed = isTopicClosed;
exports.canReopenTopic = canReopenTopic;
exports.TOPIC_CODES = [
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
];
const CRITICAL_TOPICS = [
    'intro',
    'car_identification',
    'needs',
    'next_step',
];
function createInitialTopicMap() {
    const map = {};
    for (const code of exports.TOPIC_CODES) {
        map[code] = { status: 'none', evasion_count: 0 };
    }
    return map;
}
const VALID_TRANSITIONS = {
    none: ['asked'],
    asked: ['answered', 'asked'],
    answered: ['clarified', 'closed'],
    clarified: ['closed'],
    closed: [],
};
function advanceTopic(map, code, newStatus) {
    const topic = map[code];
    if (!topic)
        return { map, valid: false };
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
function recordEvasion(map, code) {
    const topic = map[code];
    if (!topic)
        return map;
    return {
        ...map,
        [code]: { ...topic, evasion_count: topic.evasion_count + 1 },
    };
}
function checkCriticalEvasions(map) {
    for (const code of CRITICAL_TOPICS) {
        const topic = map[code];
        if (topic && topic.evasion_count >= 2) {
            return { shouldFail: true, failedTopic: code };
        }
    }
    return { shouldFail: false, failedTopic: null };
}
function isTopicClosed(map, code) {
    return map[code]?.status === 'closed';
}
function canReopenTopic(map, code, reason) {
    const topic = map[code];
    if (!topic)
        return false;
    if (topic.status !== 'closed')
        return true;
    return reason === 'contradiction' || reason === 'misinformation';
}
//# sourceMappingURL=topicStateMachine.js.map