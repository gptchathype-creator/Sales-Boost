"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const topicStateMachine_1 = require("../logic/topicStateMachine");
(0, vitest_1.describe)('topicStateMachine', () => {
    (0, vitest_1.describe)('createInitialTopicMap', () => {
        (0, vitest_1.it)('creates all topics with status=none and evasion_count=0', () => {
            const map = (0, topicStateMachine_1.createInitialTopicMap)();
            (0, vitest_1.expect)(map.intro.status).toBe('none');
            (0, vitest_1.expect)(map.intro.evasion_count).toBe(0);
            (0, vitest_1.expect)(map.credit.status).toBe('none');
            (0, vitest_1.expect)(map.follow_up.status).toBe('none');
        });
    });
    (0, vitest_1.describe)('advanceTopic', () => {
        (0, vitest_1.it)('advances none → asked', () => {
            const map = (0, topicStateMachine_1.createInitialTopicMap)();
            const result = (0, topicStateMachine_1.advanceTopic)(map, 'intro', 'asked');
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.map.intro.status).toBe('asked');
        });
        (0, vitest_1.it)('advances asked → answered', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'asked').map;
            const result = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'answered');
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.map.credit.status).toBe('answered');
        });
        (0, vitest_1.it)('advances answered → clarified', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.advanceTopic)(map, 'needs', 'asked').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'needs', 'answered').map;
            const result = (0, topicStateMachine_1.advanceTopic)(map, 'needs', 'clarified');
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.map.needs.status).toBe('clarified');
        });
        (0, vitest_1.it)('advances clarified → closed', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.advanceTopic)(map, 'needs', 'asked').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'needs', 'answered').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'needs', 'clarified').map;
            const result = (0, topicStateMachine_1.advanceTopic)(map, 'needs', 'closed');
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.map.needs.status).toBe('closed');
        });
        (0, vitest_1.it)('rejects invalid transition none → answered', () => {
            const map = (0, topicStateMachine_1.createInitialTopicMap)();
            const result = (0, topicStateMachine_1.advanceTopic)(map, 'intro', 'answered');
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.map.intro.status).toBe('none');
        });
        (0, vitest_1.it)('rejects re-opening a closed topic', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'asked').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'answered').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'closed').map;
            const result = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'asked');
            (0, vitest_1.expect)(result.valid).toBe(false);
        });
    });
    (0, vitest_1.describe)('recordEvasion', () => {
        (0, vitest_1.it)('increments evasion_count', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.recordEvasion)(map, 'intro');
            (0, vitest_1.expect)(map.intro.evasion_count).toBe(1);
            map = (0, topicStateMachine_1.recordEvasion)(map, 'intro');
            (0, vitest_1.expect)(map.intro.evasion_count).toBe(2);
        });
    });
    (0, vitest_1.describe)('checkCriticalEvasions', () => {
        (0, vitest_1.it)('returns shouldFail=false when no evasions', () => {
            const map = (0, topicStateMachine_1.createInitialTopicMap)();
            (0, vitest_1.expect)((0, topicStateMachine_1.checkCriticalEvasions)(map).shouldFail).toBe(false);
        });
        (0, vitest_1.it)('returns shouldFail=true when critical topic evaded >= 2 times', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.recordEvasion)(map, 'intro');
            map = (0, topicStateMachine_1.recordEvasion)(map, 'intro');
            const result = (0, topicStateMachine_1.checkCriticalEvasions)(map);
            (0, vitest_1.expect)(result.shouldFail).toBe(true);
            (0, vitest_1.expect)(result.failedTopic).toBe('intro');
        });
        (0, vitest_1.it)('does not trigger on non-critical topics', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.recordEvasion)(map, 'credit');
            map = (0, topicStateMachine_1.recordEvasion)(map, 'credit');
            map = (0, topicStateMachine_1.recordEvasion)(map, 'credit');
            (0, vitest_1.expect)((0, topicStateMachine_1.checkCriticalEvasions)(map).shouldFail).toBe(false);
        });
        (0, vitest_1.it)('triggers on car_identification', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.recordEvasion)(map, 'car_identification');
            map = (0, topicStateMachine_1.recordEvasion)(map, 'car_identification');
            (0, vitest_1.expect)((0, topicStateMachine_1.checkCriticalEvasions)(map).shouldFail).toBe(true);
        });
    });
    (0, vitest_1.describe)('isTopicClosed', () => {
        (0, vitest_1.it)('returns false for none', () => {
            (0, vitest_1.expect)((0, topicStateMachine_1.isTopicClosed)((0, topicStateMachine_1.createInitialTopicMap)(), 'intro')).toBe(false);
        });
        (0, vitest_1.it)('returns true for closed', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.advanceTopic)(map, 'intro', 'asked').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'intro', 'answered').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'intro', 'closed').map;
            (0, vitest_1.expect)((0, topicStateMachine_1.isTopicClosed)(map, 'intro')).toBe(true);
        });
    });
    (0, vitest_1.describe)('canReopenTopic', () => {
        (0, vitest_1.it)('allows reopen of non-closed topics', () => {
            const map = (0, topicStateMachine_1.createInitialTopicMap)();
            (0, vitest_1.expect)((0, topicStateMachine_1.canReopenTopic)(map, 'intro', 'ignored')).toBe(true);
        });
        (0, vitest_1.it)('blocks reopen of closed topic for ignored reason', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.advanceTopic)(map, 'intro', 'asked').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'intro', 'answered').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'intro', 'closed').map;
            (0, vitest_1.expect)((0, topicStateMachine_1.canReopenTopic)(map, 'intro', 'ignored')).toBe(false);
        });
        (0, vitest_1.it)('allows reopen of closed topic for contradiction', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'asked').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'answered').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'closed').map;
            (0, vitest_1.expect)((0, topicStateMachine_1.canReopenTopic)(map, 'credit', 'contradiction')).toBe(true);
        });
        (0, vitest_1.it)('allows reopen of closed topic for misinformation', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'asked').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'answered').map;
            map = (0, topicStateMachine_1.advanceTopic)(map, 'credit', 'closed').map;
            (0, vitest_1.expect)((0, topicStateMachine_1.canReopenTopic)(map, 'credit', 'misinformation')).toBe(true);
        });
    });
});
//# sourceMappingURL=topicStateMachine.test.js.map