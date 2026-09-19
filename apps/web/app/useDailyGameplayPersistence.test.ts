import { describe, expect, it } from 'vitest';
import {
  canPersistCurrentDailyGameplay,
  canPersistDailyGameplay,
  getDailyGameplayPersistenceSessionKey,
  type DailyGameplayAccess,
} from './dailyGameplayPersistenceAuthority';

const PUZZLE = {
  id: 'daily-2026-09-18-editorial-v1',
  puzzleDate: '2026-09-18',
  puzzleNumber: 145,
};

describe('Daily gameplay persistence authority', () => {
  it.each([
    ['owner', true],
    ['compatibility', true],
    ['checking', false],
    ['follower', false],
    ['blocked', false],
  ] as const)('%s write authority is %s', (access, expected) => {
    expect(canPersistDailyGameplay(access satisfies DailyGameplayAccess)).toBe(expected);
  });

  it('uses semantic puzzle/ruleset identity rather than object identity', () => {
    const first = getDailyGameplayPersistenceSessionKey(PUZZLE, 'points-v3');
    const equivalent = getDailyGameplayPersistenceSessionKey({ ...PUZZLE }, 'points-v3');

    expect(equivalent).toBe(first);
    expect(getDailyGameplayPersistenceSessionKey(
      { ...PUZZLE, id: 'daily-2026-09-19-editorial-v1', puzzleDate: '2026-09-19', puzzleNumber: 146 },
      'points-v3',
    )).not.toBe(first);
    expect(getDailyGameplayPersistenceSessionKey(PUZZLE, 'classic-inning-v1')).not.toBe(first);
  });

  it('rejects the R4 stale-owner render after a re-bootstrap tears down authority', () => {
    const nextSession = getDailyGameplayPersistenceSessionKey(
      { ...PUZZLE, id: 'daily-2026-09-19-editorial-v1', puzzleDate: '2026-09-19', puzzleNumber: 146 },
      'points-v3',
    );

    expect(canPersistCurrentDailyGameplay({
      renderAccess: 'owner',
      currentAccess: 'follower',
      renderSessionKey: nextSession,
      currentSessionKey: nextSession,
      renderReadySessionKey: getDailyGameplayPersistenceSessionKey(PUZZLE, 'points-v3'),
      currentReadySessionKey: null,
    })).toBe(false);
  });

  it('requires the exact current hydrated session even when both renders say owner', () => {
    const first = getDailyGameplayPersistenceSessionKey(PUZZLE, 'points-v3');
    const next = getDailyGameplayPersistenceSessionKey(
      { ...PUZZLE, id: 'daily-2026-09-19-editorial-v1', puzzleDate: '2026-09-19', puzzleNumber: 146 },
      'points-v3',
    );

    expect(canPersistCurrentDailyGameplay({
      renderAccess: 'owner',
      currentAccess: 'owner',
      renderSessionKey: first,
      currentSessionKey: next,
      renderReadySessionKey: first,
      currentReadySessionKey: next,
    })).toBe(false);

    expect(canPersistCurrentDailyGameplay({
      renderAccess: 'owner',
      currentAccess: 'owner',
      renderSessionKey: next,
      currentSessionKey: next,
      renderReadySessionKey: next,
      currentReadySessionKey: next,
    })).toBe(true);
  });

  it('requires current readiness for compatibility persistence too', () => {
    const key = getDailyGameplayPersistenceSessionKey(PUZZLE, 'classic-inning-v1');
    expect(canPersistCurrentDailyGameplay({
      renderAccess: 'compatibility',
      currentAccess: 'compatibility',
      renderSessionKey: key,
      currentSessionKey: key,
      renderReadySessionKey: null,
      currentReadySessionKey: key,
    })).toBe(false);
  });
});
