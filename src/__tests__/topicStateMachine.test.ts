import { describe, it, expect } from 'vitest';
import {
  createInitialTopicMap,
  advanceTopic,
  recordEvasion,
  checkCriticalEvasions,
  isTopicClosed,
  canReopenTopic,
} from '../logic/topicStateMachine';

describe('topicStateMachine', () => {
  describe('createInitialTopicMap', () => {
    it('creates all topics with status=none and evasion_count=0', () => {
      const map = createInitialTopicMap();
      expect(map.intro.status).toBe('none');
      expect(map.intro.evasion_count).toBe(0);
      expect(map.credit.status).toBe('none');
      expect(map.follow_up.status).toBe('none');
    });
  });

  describe('advanceTopic', () => {
    it('advances none → asked', () => {
      const map = createInitialTopicMap();
      const result = advanceTopic(map, 'intro', 'asked');
      expect(result.valid).toBe(true);
      expect(result.map.intro.status).toBe('asked');
    });

    it('advances asked → answered', () => {
      let map = createInitialTopicMap();
      map = advanceTopic(map, 'credit', 'asked').map;
      const result = advanceTopic(map, 'credit', 'answered');
      expect(result.valid).toBe(true);
      expect(result.map.credit.status).toBe('answered');
    });

    it('advances answered → clarified', () => {
      let map = createInitialTopicMap();
      map = advanceTopic(map, 'needs', 'asked').map;
      map = advanceTopic(map, 'needs', 'answered').map;
      const result = advanceTopic(map, 'needs', 'clarified');
      expect(result.valid).toBe(true);
      expect(result.map.needs.status).toBe('clarified');
    });

    it('advances clarified → closed', () => {
      let map = createInitialTopicMap();
      map = advanceTopic(map, 'needs', 'asked').map;
      map = advanceTopic(map, 'needs', 'answered').map;
      map = advanceTopic(map, 'needs', 'clarified').map;
      const result = advanceTopic(map, 'needs', 'closed');
      expect(result.valid).toBe(true);
      expect(result.map.needs.status).toBe('closed');
    });

    it('rejects invalid transition none → answered', () => {
      const map = createInitialTopicMap();
      const result = advanceTopic(map, 'intro', 'answered');
      expect(result.valid).toBe(false);
      expect(result.map.intro.status).toBe('none');
    });

    it('rejects re-opening a closed topic', () => {
      let map = createInitialTopicMap();
      map = advanceTopic(map, 'credit', 'asked').map;
      map = advanceTopic(map, 'credit', 'answered').map;
      map = advanceTopic(map, 'credit', 'closed').map;
      const result = advanceTopic(map, 'credit', 'asked');
      expect(result.valid).toBe(false);
    });
  });

  describe('recordEvasion', () => {
    it('increments evasion_count', () => {
      let map = createInitialTopicMap();
      map = recordEvasion(map, 'intro');
      expect(map.intro.evasion_count).toBe(1);
      map = recordEvasion(map, 'intro');
      expect(map.intro.evasion_count).toBe(2);
    });
  });

  describe('checkCriticalEvasions', () => {
    it('returns shouldFail=false when no evasions', () => {
      const map = createInitialTopicMap();
      expect(checkCriticalEvasions(map).shouldFail).toBe(false);
    });

    it('returns shouldFail=true when critical topic evaded >= 2 times', () => {
      let map = createInitialTopicMap();
      map = recordEvasion(map, 'intro');
      map = recordEvasion(map, 'intro');
      const result = checkCriticalEvasions(map);
      expect(result.shouldFail).toBe(true);
      expect(result.failedTopic).toBe('intro');
    });

    it('does not trigger on non-critical topics', () => {
      let map = createInitialTopicMap();
      map = recordEvasion(map, 'credit');
      map = recordEvasion(map, 'credit');
      map = recordEvasion(map, 'credit');
      expect(checkCriticalEvasions(map).shouldFail).toBe(false);
    });

    it('triggers on car_identification', () => {
      let map = createInitialTopicMap();
      map = recordEvasion(map, 'car_identification');
      map = recordEvasion(map, 'car_identification');
      expect(checkCriticalEvasions(map).shouldFail).toBe(true);
    });
  });

  describe('isTopicClosed', () => {
    it('returns false for none', () => {
      expect(isTopicClosed(createInitialTopicMap(), 'intro')).toBe(false);
    });

    it('returns true for closed', () => {
      let map = createInitialTopicMap();
      map = advanceTopic(map, 'intro', 'asked').map;
      map = advanceTopic(map, 'intro', 'answered').map;
      map = advanceTopic(map, 'intro', 'closed').map;
      expect(isTopicClosed(map, 'intro')).toBe(true);
    });
  });

  describe('canReopenTopic', () => {
    it('allows reopen of non-closed topics', () => {
      const map = createInitialTopicMap();
      expect(canReopenTopic(map, 'intro', 'ignored')).toBe(true);
    });

    it('blocks reopen of closed topic for ignored reason', () => {
      let map = createInitialTopicMap();
      map = advanceTopic(map, 'intro', 'asked').map;
      map = advanceTopic(map, 'intro', 'answered').map;
      map = advanceTopic(map, 'intro', 'closed').map;
      expect(canReopenTopic(map, 'intro', 'ignored')).toBe(false);
    });

    it('allows reopen of closed topic for contradiction', () => {
      let map = createInitialTopicMap();
      map = advanceTopic(map, 'credit', 'asked').map;
      map = advanceTopic(map, 'credit', 'answered').map;
      map = advanceTopic(map, 'credit', 'closed').map;
      expect(canReopenTopic(map, 'credit', 'contradiction')).toBe(true);
    });

    it('allows reopen of closed topic for misinformation', () => {
      let map = createInitialTopicMap();
      map = advanceTopic(map, 'credit', 'asked').map;
      map = advanceTopic(map, 'credit', 'answered').map;
      map = advanceTopic(map, 'credit', 'closed').map;
      expect(canReopenTopic(map, 'credit', 'misinformation')).toBe(true);
    });
  });
});
