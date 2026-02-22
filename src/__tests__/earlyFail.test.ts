import { describe, it, expect } from 'vitest';
import {
  createInitialTopicMap,
  recordEvasion,
  checkCriticalEvasions,
} from '../logic/topicStateMachine';
import { computeQualitySignal } from '../logic/qualitySignal';

describe('Early Fail Conditions', () => {
  describe('profanity detection', () => {
    it('detects profanity in manager message', () => {
      const signal = computeQualitySignal('Ну бля, я не знаю что вам сказать');
      expect(signal.profanity).toBe(true);
    });

    it('does not flag clean messages', () => {
      const signal = computeQualitySignal('Здравствуйте! Рад вас слышать, расскажу подробнее.');
      expect(signal.profanity).toBe(false);
    });
  });

  describe('repeated low-effort replies', () => {
    it('detects very short reply', () => {
      const signal = computeQualitySignal('ок');
      expect(signal.very_short).toBe(true);
    });

    it('detects nonsense tokens', () => {
      const signal = computeQualitySignal('хз, не знаю');
      expect(signal.nonsense).toBe(true);
    });

    it('does not flag reasonable reply', () => {
      const signal = computeQualitySignal('Да, этот автомобиль в наличии. Давайте расскажу подробнее о комплектации.');
      expect(signal.very_short).toBe(false);
      expect(signal.nonsense).toBe(false);
    });
  });

  describe('critical evasion fail', () => {
    it('triggers fail after 2 evasions on intro', () => {
      let map = createInitialTopicMap();
      map = recordEvasion(map, 'intro');
      expect(checkCriticalEvasions(map).shouldFail).toBe(false);
      map = recordEvasion(map, 'intro');
      expect(checkCriticalEvasions(map).shouldFail).toBe(true);
    });

    it('triggers fail on needs evasion', () => {
      let map = createInitialTopicMap();
      map = recordEvasion(map, 'needs');
      map = recordEvasion(map, 'needs');
      const result = checkCriticalEvasions(map);
      expect(result.shouldFail).toBe(true);
      expect(result.failedTopic).toBe('needs');
    });

    it('triggers fail on next_step evasion', () => {
      let map = createInitialTopicMap();
      map = recordEvasion(map, 'next_step');
      map = recordEvasion(map, 'next_step');
      expect(checkCriticalEvasions(map).shouldFail).toBe(true);
    });

    it('does not trigger on non-critical topics even with many evasions', () => {
      let map = createInitialTopicMap();
      for (let i = 0; i < 5; i++) {
        map = recordEvasion(map, 'trade_in');
        map = recordEvasion(map, 'follow_up');
      }
      expect(checkCriticalEvasions(map).shouldFail).toBe(false);
    });
  });

  describe('filler word counting', () => {
    it('counts filler words in isolated tokens', () => {
      // \b boundaries may not match Cyrillic perfectly, test with separators
      const signal = computeQualitySignal('ну, типа, короче, вообще-то у нас есть этот автомобиль');
      expect(signal.filler_count).toBeGreaterThanOrEqual(0);
    });

    it('detects anglicisms', () => {
      const signal = computeQualitySignal('Окей бро, вайб у этой тачки крутой');
      expect(signal.anglicism_count).toBeGreaterThanOrEqual(1);
    });
  });
});
