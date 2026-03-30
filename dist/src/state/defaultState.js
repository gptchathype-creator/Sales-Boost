"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHECKLIST_KEYS = void 0;
exports.getDefaultState = getDefaultState;
exports.mergeStateFromJson = mergeStateFromJson;
const phaseManager_1 = require("../logic/phaseManager");
const topicStateMachine_1 = require("../logic/topicStateMachine");
exports.CHECKLIST_KEYS = [
    'greeted_and_introduced',
    'asked_about_specific_car',
    'presented_car_benefits',
    'invited_to_visit_today',
    'mentioned_underground_mall_inspection',
    'mentioned_wide_assortment',
    'offered_trade_in_buyout',
    'explained_financing_8_banks',
    'agreed_exact_visit_datetime',
    'agreed_next_contact_datetime',
    'discussed_address_and_how_to_get',
];
// ── Defaults ──
const initialChecklist = {
    greeted_and_introduced: 'unknown',
    asked_about_specific_car: 'unknown',
    presented_car_benefits: 'unknown',
    invited_to_visit_today: 'unknown',
    mentioned_underground_mall_inspection: 'unknown',
    mentioned_wide_assortment: 'unknown',
    offered_trade_in_buyout: 'unknown',
    explained_financing_8_banks: 'unknown',
    agreed_exact_visit_datetime: 'unknown',
    agreed_next_contact_datetime: 'unknown',
    discussed_address_and_how_to_get: 'unknown',
};
const initialDialogHealth = {
    patience: 70,
    trust: 60,
    confusion: 0,
    irritation: 0,
};
const initialLoopGuard = {
    last_client_intent: '',
    repeated_intent_count: 0,
    unanswered_question_streak: 0,
};
const initialStrictnessState = {
    strictness: 'medium',
    max_client_turns: 10,
};
const initialFactContext = {
    buyer_knows: {
        inspection_place_known: false,
        address_known: false,
    },
    misinformation_detected: false,
};
const initialCommunication = {
    tone: 'neutral',
    engagement: 'active',
    filler_total: 0,
    profanity_detected: false,
    prohibited_phrases: [],
};
function getDefaultState(profile = 'normal') {
    return {
        phase: 'first_contact',
        topics: (0, topicStateMachine_1.createInitialTopicMap)(),
        client_profile: profile,
        phase_checks: (0, phaseManager_1.createInitialPhaseChecks)(),
        communication: { ...initialCommunication },
        low_effort_streak: 0,
        objection_triggered: null,
        client_turns: 0,
        dialog_health: { ...initialDialogHealth },
        loop_guard: { ...initialLoopGuard },
        strictnessState: { ...initialStrictnessState },
        fact_context: { ...initialFactContext },
        stage: 'opening',
        checklist: { ...initialChecklist },
        notes: '',
    };
}
/**
 * Safely merge raw JSON (from DB) over defaults, handling missing v2 fields
 * for sessions that started before the upgrade.
 */
function mergeStateFromJson(raw, profile = 'normal') {
    const base = getDefaultState(profile);
    return {
        phase: raw.phase ?? base.phase,
        topics: raw.topics ? { ...base.topics, ...raw.topics } : base.topics,
        client_profile: raw.client_profile ?? raw.clientProfile ?? profile,
        phase_checks: raw.phase_checks
            ? deepMerge(base.phase_checks, raw.phase_checks)
            : base.phase_checks,
        communication: raw.communication
            ? { ...base.communication, ...raw.communication }
            : base.communication,
        low_effort_streak: raw.low_effort_streak ?? 0,
        objection_triggered: raw.objection_triggered ?? null,
        client_turns: raw.client_turns ?? base.client_turns,
        dialog_health: { ...base.dialog_health, ...(raw.dialog_health ?? {}) },
        loop_guard: { ...base.loop_guard, ...(raw.loop_guard ?? {}) },
        strictnessState: {
            ...base.strictnessState,
            ...(raw.strictnessState ?? {}),
        },
        fact_context: raw.fact_context
            ? deepMerge(base.fact_context, raw.fact_context)
            : base.fact_context,
        stage: raw.stage ?? base.stage,
        checklist: { ...base.checklist, ...(raw.checklist ?? {}) },
        notes: raw.notes ?? base.notes,
    };
}
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key]) &&
            target[key] &&
            typeof target[key] === 'object') {
            result[key] = deepMerge(target[key], source[key]);
        }
        else {
            result[key] = source[key];
        }
    }
    return result;
}
//# sourceMappingURL=defaultState.js.map