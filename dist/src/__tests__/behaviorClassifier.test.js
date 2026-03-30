"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const behaviorClassifier_1 = require("../logic/behaviorClassifier");
const normalCtx = { isClientWaitingAnswer: true };
const firstMsgCtx = { isClientWaitingAnswer: false };
(0, vitest_1.describe)('BehaviorClassifier', () => {
    (0, vitest_1.describe)('toxic detection', () => {
        (0, vitest_1.it)('detects profanity stems', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Ну бля, я не знаю что вам сказать', normalCtx);
            (0, vitest_1.expect)(r.toxic).toBe(true);
            (0, vitest_1.expect)(r.severity).toBe('HIGH');
        });
        (0, vitest_1.it)('detects hostile phrases', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Да отстань ты уже, надоел', normalCtx);
            (0, vitest_1.expect)(r.toxic).toBe(true);
        });
        (0, vitest_1.it)('detects "пошёл на" hostile pattern', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Да пошёл ты, мне не до тебя', normalCtx);
            (0, vitest_1.expect)(r.toxic).toBe(true);
            (0, vitest_1.expect)(r.severity).toBe('HIGH');
        });
        (0, vitest_1.it)('does not flag clean professional message', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Здравствуйте! Рад вас слышать, расскажу подробнее о комплектации.', normalCtx);
            (0, vitest_1.expect)(r.toxic).toBe(false);
            (0, vitest_1.expect)(r.severity).toBe('LOW');
        });
    });
    (0, vitest_1.describe)('low_effort detection', () => {
        (0, vitest_1.it)('detects very short answer', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('ок', normalCtx);
            (0, vitest_1.expect)(r.low_effort).toBe(true);
        });
        (0, vitest_1.it)('detects "хз"', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('хз', normalCtx);
            (0, vitest_1.expect)(r.low_effort).toBe(true);
        });
        (0, vitest_1.it)('detects "не знаю"', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('не знаю', normalCtx);
            (0, vitest_1.expect)(r.low_effort).toBe(true);
        });
        (0, vitest_1.it)('detects one-word filler "ладно"', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('ладно', normalCtx);
            (0, vitest_1.expect)(r.low_effort).toBe(true);
        });
        (0, vitest_1.it)('does not flag detailed answer', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Да, этот автомобиль в наличии. Chery Arrizo 8 2023 года, пробег 97 тысяч. Давайте расскажу подробнее о комплектации.', normalCtx);
            (0, vitest_1.expect)(r.low_effort).toBe(false);
        });
    });
    (0, vitest_1.describe)('evasion detection', () => {
        (0, vitest_1.it)('detects evasion when client is waiting and manager gives low effort', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('норм', { isClientWaitingAnswer: true });
            (0, vitest_1.expect)(r.evasion).toBe(true);
        });
        (0, vitest_1.it)('detects evasion with dismissive phrase', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Не моя проблема, звоните куда-нибудь', { isClientWaitingAnswer: true });
            (0, vitest_1.expect)(r.evasion).toBe(true);
        });
        (0, vitest_1.it)('does not flag evasion on first message', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('ок', { isClientWaitingAnswer: false });
            (0, vitest_1.expect)(r.evasion).toBe(false);
        });
    });
    (0, vitest_1.describe)('prohibited phrase detection', () => {
        (0, vitest_1.it)('detects "посмотрите на сайте"', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Все данные есть, посмотрите на сайте', normalCtx);
            (0, vitest_1.expect)(r.prohibited_phrase_hits).toContain('посмотрите на сайте');
        });
        (0, vitest_1.it)('detects "перезвоните"', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Перезвоните попозже, я сейчас занят', normalCtx);
            (0, vitest_1.expect)(r.prohibited_phrase_hits).toContain('перезвоните');
        });
        (0, vitest_1.it)('detects "я не знаю"', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Я не знаю, спросите у кого-нибудь ещё', normalCtx);
            (0, vitest_1.expect)(r.prohibited_phrase_hits).toContain('я не знаю');
        });
        (0, vitest_1.it)('detects dismissive "сами разбирайтесь"', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Сами разбирайтесь, мне некогда', normalCtx);
            (0, vitest_1.expect)(r.prohibited_phrase_hits).toContain('сами разбирайтесь');
        });
        (0, vitest_1.it)('returns empty for clean message', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Конечно, давайте расскажу подробнее. Этот автомобиль отлично подойдёт для города.', normalCtx);
            (0, vitest_1.expect)(r.prohibited_phrase_hits).toHaveLength(0);
        });
    });
    (0, vitest_1.describe)('severity levels', () => {
        (0, vitest_1.it)('HIGH for profanity', () => {
            (0, vitest_1.expect)((0, behaviorClassifier_1.classifyBehavior)('пиздец какой-то', normalCtx).severity).toBe('HIGH');
        });
        (0, vitest_1.it)('MEDIUM for dismissive + evasion combo', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Не в курсе, сами разбирайтесь', { isClientWaitingAnswer: true });
            (0, vitest_1.expect)(r.severity).toBe('MEDIUM');
        });
        (0, vitest_1.it)('LOW for simple short answer without waiting context', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('да', firstMsgCtx);
            (0, vitest_1.expect)(r.severity).toBe('LOW');
        });
    });
    (0, vitest_1.describe)('composite scenarios', () => {
        (0, vitest_1.it)('toxic + prohibited + low_effort all at once', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('бля, не знаю', { isClientWaitingAnswer: true });
            (0, vitest_1.expect)(r.toxic).toBe(true);
            (0, vitest_1.expect)(r.low_effort).toBe(true);
            (0, vitest_1.expect)(r.evasion).toBe(true);
            (0, vitest_1.expect)(r.severity).toBe('HIGH');
        });
        (0, vitest_1.it)('perfect professional message has no flags', () => {
            const r = (0, behaviorClassifier_1.classifyBehavior)('Добрый день! Меня зовут Алексей, автосалон АвтоМир. Да, Chery Arrizo 8 доступен. Какие у вас пожелания по комплектации?', normalCtx);
            (0, vitest_1.expect)(r.toxic).toBe(false);
            (0, vitest_1.expect)(r.low_effort).toBe(false);
            (0, vitest_1.expect)(r.evasion).toBe(false);
            (0, vitest_1.expect)(r.prohibited_phrase_hits).toHaveLength(0);
            (0, vitest_1.expect)(r.rationale).toBe('no issues detected');
        });
    });
});
//# sourceMappingURL=behaviorClassifier.test.js.map