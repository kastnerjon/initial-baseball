import { describe, expect, it } from 'vitest';
import { canPersistDailyGameplay, type DailyGameplayAccess } from './useDailyGameplayPersistence';

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
});
