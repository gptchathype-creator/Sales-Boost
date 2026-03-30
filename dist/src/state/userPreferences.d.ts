export type ReplyMode = 'text' | 'voice';
export type TtsVoice = 'male' | 'female';
export interface UserPreferences {
    replyMode: ReplyMode;
    ttsVoice: TtsVoice;
}
export declare const DEFAULT_PREFERENCES: UserPreferences;
export declare function parsePreferences(json: string | null): UserPreferences;
export declare function serializePreferences(prefs: UserPreferences): string;
//# sourceMappingURL=userPreferences.d.ts.map