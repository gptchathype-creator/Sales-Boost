"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PREFERENCES = void 0;
exports.parsePreferences = parsePreferences;
exports.serializePreferences = serializePreferences;
exports.DEFAULT_PREFERENCES = {
    replyMode: 'voice',
    ttsVoice: 'male',
};
function parsePreferences(json) {
    if (!json?.trim())
        return exports.DEFAULT_PREFERENCES;
    try {
        const parsed = JSON.parse(json);
        return {
            replyMode: parsed.replyMode === 'voice' ? 'voice' : 'text',
            ttsVoice: parsed.ttsVoice === 'female' ? 'female' : 'male',
        };
    }
    catch {
        return exports.DEFAULT_PREFERENCES;
    }
}
function serializePreferences(prefs) {
    return JSON.stringify(prefs);
}
//# sourceMappingURL=userPreferences.js.map