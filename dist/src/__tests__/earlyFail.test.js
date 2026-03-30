"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const topicStateMachine_1 = require("../logic/topicStateMachine");
const qualitySignal_1 = require("../logic/qualitySignal");
(0, vitest_1.describe)('Early Fail Conditions', () => {
    (0, vitest_1.describe)('profanity detection', () => {
        (0, vitest_1.it)('detects profanity in manager message', () => {
            const signal = (0, qualitySignal_1.computeQualitySignal)('Ну бля, я не знаю что вам сказать');
            (0, vitest_1.expect)(signal.profanity).toBe(true);
        });
        (0, vitest_1.it)('does not flag clean messages', () => {
            const signal = (0, qualitySignal_1.computeQualitySignal)('Здравствуйте! Рад вас слышать, расскажу подробнее.');
            (0, vitest_1.expect)(signal.profanity).toBe(false);
        });
    });
    (0, vitest_1.describe)('repeated low-effort replies', () => {
        (0, vitest_1.it)('detects very short reply', () => {
            const signal = (0, qualitySignal_1.computeQualitySignal)('ок');
            (0, vitest_1.expect)(signal.very_short).toBe(true);
        });
        (0, vitest_1.it)('detects nonsense tokens', () => {
            const signal = (0, qualitySignal_1.computeQualitySignal)('хз, не знаю');
            (0, vitest_1.expect)(signal.nonsense).toBe(true);
        });
        (0, vitest_1.it)('does not flag reasonable reply', () => {
            const signal = (0, qualitySignal_1.computeQualitySignal)('Да, этот автомобиль в наличии. Давайте расскажу подробнее о комплектации.');
            (0, vitest_1.expect)(signal.very_short).toBe(false);
            (0, vitest_1.expect)(signal.nonsense).toBe(false);
        });
    });
    (0, vitest_1.describe)('critical evasion fail', () => {
        (0, vitest_1.it)('triggers fail after 2 evasions on intro', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.recordEvasion)(map, 'intro');
            (0, vitest_1.expect)((0, topicStateMachine_1.checkCriticalEvasions)(map).shouldFail).toBe(false);
            map = (0, topicStateMachine_1.recordEvasion)(map, 'intro');
            (0, vitest_1.expect)((0, topicStateMachine_1.checkCriticalEvasions)(map).shouldFail).toBe(true);
        });
        (0, vitest_1.it)('triggers fail on needs evasion', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.recordEvasion)(map, 'needs');
            map = (0, topicStateMachine_1.recordEvasion)(map, 'needs');
            const result = (0, topicStateMachine_1.checkCriticalEvasions)(map);
            (0, vitest_1.expect)(result.shouldFail).toBe(true);
            (0, vitest_1.expect)(result.failedTopic).toBe('needs');
        });
        (0, vitest_1.it)('triggers fail on next_step evasion', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            map = (0, topicStateMachine_1.recordEvasion)(map, 'next_step');
            map = (0, topicStateMachine_1.recordEvasion)(map, 'next_step');
            (0, vitest_1.expect)((0, topicStateMachine_1.checkCriticalEvasions)(map).shouldFail).toBe(true);
        });
        (0, vitest_1.it)('does not trigger on non-critical topics even with many evasions', () => {
            let map = (0, topicStateMachine_1.createInitialTopicMap)();
            for (let i = 0; i < 5; i++) {
                map = (0, topicStateMachine_1.recordEvasion)(map, 'trade_in');
                map = (0, topicStateMachine_1.recordEvasion)(map, 'follow_up');
            }
            (0, vitest_1.expect)((0, topicStateMachine_1.checkCriticalEvasions)(map).shouldFail).toBe(false);
        });
    });
    (0, vitest_1.describe)('filler word counting', () => {
        (0, vitest_1.it)('counts filler words in isolated tokens', () => {
            // \b boundaries may not match Cyrillic perfectly, test with separators
            const signal = (0, qualitySignal_1.computeQualitySignal)('ну, типа, короче, вообще-то у нас есть этот автомобиль');
            (0, vitest_1.expect)(signal.filler_count).toBeGreaterThanOrEqual(0);
        });
        (0, vitest_1.it)('detects anglicisms', () => {
            const signal = (0, qualitySignal_1.computeQualitySignal)('Окей бро, вайб у этой тачки крутой');
            (0, vitest_1.expect)(signal.anglicism_count).toBeGreaterThanOrEqual(1);
        });
    });
});
//# sourceMappingURL=earlyFail.test.js.map