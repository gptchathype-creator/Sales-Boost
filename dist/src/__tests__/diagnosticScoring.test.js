"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const diagnosticScoring_1 = require("../logic/diagnosticScoring");
function makeChecklist(overrides = {}) {
    return (0, diagnosticScoring_1.buildChecklistFromLLMClassification)(Object.entries(diagnosticScoring_1.CHECKLIST_WEIGHTS).map(([code]) => ({
        code,
        status: (overrides[code] ?? 'YES'),
        evidence: [],
        comment: '',
    })));
}
const defaultOptions = {
    earlyFail: false,
    misinformationDetected: false,
    noNextStep: false,
    passiveStyle: false,
    passiveSeverity: 'mild',
};
(0, vitest_1.describe)('diagnosticScoring', () => {
    (0, vitest_1.describe)('computeDeterministicScore', () => {
        (0, vitest_1.it)('returns 100 for all YES', () => {
            const checklist = makeChecklist();
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, defaultOptions);
            (0, vitest_1.expect)(score).toBe(100);
        });
        (0, vitest_1.it)('returns 0 for all NO', () => {
            const checklist = makeChecklist(Object.fromEntries(Object.keys(diagnosticScoring_1.CHECKLIST_WEIGHTS).map((k) => [k, 'NO'])));
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, defaultOptions);
            (0, vitest_1.expect)(score).toBe(0);
        });
        (0, vitest_1.it)('returns ~50 for all PARTIAL', () => {
            const checklist = makeChecklist(Object.fromEntries(Object.keys(diagnosticScoring_1.CHECKLIST_WEIGHTS).map((k) => [k, 'PARTIAL'])));
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, defaultOptions);
            (0, vitest_1.expect)(score).toBe(50);
        });
        (0, vitest_1.it)('handles NA items by excluding them', () => {
            const checklist = makeChecklist({
                CREDIT_EXPLANATION: 'NA',
                TRADEIN_OFFER: 'NA',
                OBJECTION_HANDLING: 'NA',
            });
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, defaultOptions);
            (0, vitest_1.expect)(score).toBe(100);
        });
        (0, vitest_1.it)('caps score at 40 for earlyFail', () => {
            const checklist = makeChecklist();
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, {
                ...defaultOptions,
                earlyFail: true,
            });
            (0, vitest_1.expect)(score).toBe(40);
        });
        (0, vitest_1.it)('deducts 15 for misinformation', () => {
            const checklist = makeChecklist();
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, {
                ...defaultOptions,
                misinformationDetected: true,
            });
            (0, vitest_1.expect)(score).toBe(85);
        });
        (0, vitest_1.it)('deducts 10 for noNextStep', () => {
            const checklist = makeChecklist();
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, {
                ...defaultOptions,
                noNextStep: true,
            });
            (0, vitest_1.expect)(score).toBe(90);
        });
        (0, vitest_1.it)('deducts 5 for mild passive style', () => {
            const checklist = makeChecklist();
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, {
                ...defaultOptions,
                passiveStyle: true,
                passiveSeverity: 'mild',
            });
            (0, vitest_1.expect)(score).toBe(95);
        });
        (0, vitest_1.it)('deducts 10 for strong passive style', () => {
            const checklist = makeChecklist();
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, {
                ...defaultOptions,
                passiveStyle: true,
                passiveSeverity: 'strong',
            });
            (0, vitest_1.expect)(score).toBe(90);
        });
        (0, vitest_1.it)('compounds penalties correctly', () => {
            const checklist = makeChecklist({ INTRODUCTION: 'NO' });
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, {
                ...defaultOptions,
                misinformationDetected: true,
                noNextStep: true,
            });
            // base: (100-8)/100*100 = 92, minus 15 = 77, minus 10 = 67
            (0, vitest_1.expect)(score).toBe(67);
        });
        (0, vitest_1.it)('never goes below 0', () => {
            const checklist = makeChecklist(Object.fromEntries(Object.keys(diagnosticScoring_1.CHECKLIST_WEIGHTS).map((k) => [k, 'NO'])));
            const { score } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, {
                earlyFail: true,
                misinformationDetected: true,
                noNextStep: true,
                passiveStyle: true,
                passiveSeverity: 'strong',
            });
            (0, vitest_1.expect)(score).toBe(0);
        });
    });
    (0, vitest_1.describe)('dimension scores', () => {
        (0, vitest_1.it)('computes per-dimension scores', () => {
            const checklist = makeChecklist({
                INTRODUCTION: 'YES',
                SALON_NAME: 'NO',
                CAR_IDENTIFICATION: 'YES',
                INITIATIVE: 'PARTIAL',
                COMMUNICATION_TONE: 'YES',
            });
            const { dimensions } = (0, diagnosticScoring_1.computeDeterministicScore)(checklist, defaultOptions);
            (0, vitest_1.expect)(dimensions.first_contact).toBeGreaterThan(0);
            (0, vitest_1.expect)(dimensions.first_contact).toBeLessThan(100);
            (0, vitest_1.expect)(dimensions.communication).toBe(100);
        });
    });
    (0, vitest_1.describe)('buildChecklistFromLLMClassification', () => {
        (0, vitest_1.it)('returns all 13 items', () => {
            const checklist = (0, diagnosticScoring_1.buildChecklistFromLLMClassification)([]);
            (0, vitest_1.expect)(checklist).toHaveLength(13);
        });
        (0, vitest_1.it)('defaults to NA for missing codes', () => {
            const checklist = (0, diagnosticScoring_1.buildChecklistFromLLMClassification)([]);
            (0, vitest_1.expect)(checklist[0].status).toBe('NA');
        });
        (0, vitest_1.it)('maps valid statuses', () => {
            const checklist = (0, diagnosticScoring_1.buildChecklistFromLLMClassification)([
                { code: 'INTRODUCTION', status: 'YES', evidence: ['Менеджер: Здравствуйте, меня зовут...'], comment: 'OK' },
            ]);
            const intro = checklist.find((c) => c.code === 'INTRODUCTION');
            (0, vitest_1.expect)(intro?.status).toBe('YES');
            (0, vitest_1.expect)(intro?.evidence).toHaveLength(1);
        });
        (0, vitest_1.it)('normalizes invalid status to NO', () => {
            const checklist = (0, diagnosticScoring_1.buildChecklistFromLLMClassification)([
                { code: 'SALON_NAME', status: 'MAYBE', evidence: [], comment: '' },
            ]);
            const salon = checklist.find((c) => c.code === 'SALON_NAME');
            (0, vitest_1.expect)(salon?.status).toBe('NO');
        });
    });
    (0, vitest_1.describe)('detectIssuesFromChecklist', () => {
        (0, vitest_1.it)('detects NO_INTRO', () => {
            const checklist = makeChecklist({ INTRODUCTION: 'NO' });
            const issues = (0, diagnosticScoring_1.detectIssuesFromChecklist)(checklist, {
                profanity: false,
                misinformation: false,
                passiveStyle: false,
                lowEngagement: false,
                redirectToWebsite: false,
                badTone: false,
            });
            (0, vitest_1.expect)(issues.some((i) => i.issue_type === 'NO_INTRO')).toBe(true);
        });
        (0, vitest_1.it)('detects profanity signal', () => {
            const checklist = makeChecklist();
            const issues = (0, diagnosticScoring_1.detectIssuesFromChecklist)(checklist, {
                profanity: true,
                misinformation: false,
                passiveStyle: false,
                lowEngagement: false,
                redirectToWebsite: false,
                badTone: false,
            });
            (0, vitest_1.expect)(issues.some((i) => i.issue_type === 'PROFANITY')).toBe(true);
            (0, vitest_1.expect)(issues.find((i) => i.issue_type === 'PROFANITY')?.severity).toBe('HIGH');
        });
        (0, vitest_1.it)('detects multiple issues', () => {
            const checklist = makeChecklist({
                INTRODUCTION: 'NO',
                NEXT_STEP_PROPOSAL: 'NO',
                NEEDS_DISCOVERY: 'NO',
            });
            const issues = (0, diagnosticScoring_1.detectIssuesFromChecklist)(checklist, {
                profanity: false,
                misinformation: true,
                passiveStyle: true,
                lowEngagement: false,
                redirectToWebsite: false,
                badTone: false,
            });
            (0, vitest_1.expect)(issues.length).toBeGreaterThanOrEqual(4);
            (0, vitest_1.expect)(issues.some((i) => i.issue_type === 'NO_INTRO')).toBe(true);
            (0, vitest_1.expect)(issues.some((i) => i.issue_type === 'NO_NEXT_STEP')).toBe(true);
            (0, vitest_1.expect)(issues.some((i) => i.issue_type === 'NO_NEEDS_DISCOVERY')).toBe(true);
            (0, vitest_1.expect)(issues.some((i) => i.issue_type === 'MISINFORMATION')).toBe(true);
        });
    });
});
//# sourceMappingURL=diagnosticScoring.test.js.map