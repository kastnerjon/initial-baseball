import { describe, expect, it } from 'vitest';
import {
  DailyChatOpsRequestError,
  parseDailyChatOpsLineupRequest,
} from './dailyChatOpsLineupRequest';

describe('Daily ChatOps lineup request', () => {
  it('accepts one future-date lineup request with nine unique canonical IDs', () => {
    const request = parseDailyChatOpsLineupRequest({
      puzzleDate: '2026-09-18',
      canonicalPlayerIds: Array.from({ length: 9 }, (_, index) => `player-${index + 1}`),
      schedule: true,
    });

    expect(request.puzzleDate).toBe('2026-09-18');
    expect(request.canonicalPlayerIds).toHaveLength(9);
    expect(request.schedule).toBe(true);
  });

  it('rejects malformed, incomplete, duplicate, and implicit-schedule requests', () => {
    const validIds = Array.from({ length: 9 }, (_, index) => `player-${index + 1}`);
    const invalidRequests = [
      null,
      { puzzleDate: '09/18/2026', canonicalPlayerIds: validIds, schedule: true },
      { puzzleDate: '2026-09-18', canonicalPlayerIds: validIds.slice(0, 8), schedule: true },
      { puzzleDate: '2026-09-18', canonicalPlayerIds: ['same', 'same', ...validIds.slice(2)], schedule: true },
      { puzzleDate: '2026-09-18', canonicalPlayerIds: validIds },
    ];

    for (const value of invalidRequests) {
      expect(() => parseDailyChatOpsLineupRequest(value)).toThrow(DailyChatOpsRequestError);
    }
  });
});
