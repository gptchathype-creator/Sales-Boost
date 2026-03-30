"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDealershipCallTargets = listDealershipCallTargets;
exports.getCallSourceInfo = getCallSourceInfo;
const callHistory_1 = require("./callHistory");
const dealershipDirectory_1 = require("../super-admin/dealershipDirectory");
function normalizePhone(v) {
    const digits = String(v || '').replace(/\D/g, '');
    return digits ? `+${digits}` : '';
}
function getCallSourceMode() {
    const raw = String(process.env.CALL_SOURCE_MODE || 'mock').trim().toLowerCase();
    return raw === 'real' ? 'real' : 'mock';
}
function buildMockTargets() {
    const dealerships = (0, dealershipDirectory_1.getDealershipDirectory)();
    const numbers = (0, callHistory_1.getTestNumbers)();
    if (numbers.length === 0)
        return [];
    let idx = 0;
    return dealerships.map((d) => {
        const phone = normalizePhone(numbers[idx % numbers.length]);
        idx += 1;
        return {
            dealershipId: d.id,
            dealershipName: d.name,
            city: d.city,
            workStartHour: d.workStartHour,
            workEndHour: d.workEndHour,
            phone,
        };
    });
}
function buildRealTargets() {
    // Real source is intentionally disabled for now.
    // We'll switch to DB/CRM-backed dealerships when real entities are added.
    return [];
}
function listDealershipCallTargets() {
    const mode = getCallSourceMode();
    if (mode === 'real')
        return buildRealTargets();
    return buildMockTargets();
}
function getCallSourceInfo() {
    const mode = getCallSourceMode();
    const targets = listDealershipCallTargets();
    return {
        mode,
        targetsAvailable: targets.length,
        usingMockFallback: mode !== 'real',
    };
}
//# sourceMappingURL=dealershipCallSource.js.map