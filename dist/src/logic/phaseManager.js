"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHASE_ORDER = void 0;
exports.canTransitionPhase = canTransitionPhase;
exports.inferPhaseFromTopics = inferPhaseFromTopics;
exports.createInitialPhaseChecks = createInitialPhaseChecks;
exports.getPhaseTopics = getPhaseTopics;
exports.PHASE_ORDER = [
    'first_contact',
    'needs_discovery',
    'product_presentation',
    'money_and_objections',
    'closing_attempt',
];
const PHASE_INDEX = {
    first_contact: 0,
    needs_discovery: 1,
    product_presentation: 2,
    money_and_objections: 3,
    closing_attempt: 4,
};
function canTransitionPhase(current, next) {
    const ci = PHASE_INDEX[current];
    const ni = PHASE_INDEX[next];
    return ni >= ci && ni <= ci + 2;
}
const PHASE_TOPIC_REQUIREMENTS = {
    first_contact: ['intro', 'salon_name', 'car_identification'],
    needs_discovery: ['needs'],
    product_presentation: ['product_presentation'],
    money_and_objections: ['credit', 'trade_in', 'objection'],
    closing_attempt: ['next_step', 'scheduling', 'follow_up'],
};
function inferPhaseFromTopics(topics) {
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
function createInitialPhaseChecks() {
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
function getPhaseTopics(phase) {
    return PHASE_TOPIC_REQUIREMENTS[phase] ?? [];
}
//# sourceMappingURL=phaseManager.js.map