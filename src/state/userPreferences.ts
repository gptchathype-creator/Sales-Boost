export type ReplyMode = 'text' | 'voice';
export type TtsVoice = 'male' | 'female';

export interface UserPreferences {
  replyMode: ReplyMode;
  ttsVoice: TtsVoice;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  replyMode: 'voice',
  ttsVoice: 'male',
};

export function parsePreferences(json: string | null): UserPreferences {
  if (!json?.trim()) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(json) as Partial<UserPreferences>;
    return {
      replyMode: parsed.replyMode === 'voice' ? 'voice' : 'text',
      ttsVoice: parsed.ttsVoice === 'female' ? 'female' : 'male',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function serializePreferences(prefs: UserPreferences): string {
  return JSON.stringify(prefs);
}
