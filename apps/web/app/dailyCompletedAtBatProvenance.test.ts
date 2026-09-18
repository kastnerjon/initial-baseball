import { describe, expect, it } from 'vitest';
import { isNativeCompletedAtBatList } from './dailyCompletedAtBatProvenance';

const pitchLines = [{ initials: 'KGJ', outcome: 'HR' as const }];
const nativeFacts = [{
  pitchNumber: 1,
  initials: 'KGJ',
  outcome: 'HR' as const,
  hintsRevealed: 0 as const,
  wrongGuesses: 0,
  resolution: 'correct' as const,
}];

describe('completed-at-bat provenance', () => {
  it('accepts an explicit fact list that matches saved pitch lines', () => {
    expect(isNativeCompletedAtBatList(nativeFacts, pitchLines)).toBe(true);
  });

  it('accepts an explicit empty fact list for an untouched save', () => {
    expect(isNativeCompletedAtBatList([], [])).toBe(true);
  });

  it('rejects missing compatibility-era facts even when no pitch lines exist', () => {
    expect(isNativeCompletedAtBatList(undefined, [])).toBe(false);
  });

  it('rejects missing or malformed facts when pitch lines exist', () => {
    expect(isNativeCompletedAtBatList(undefined, pitchLines)).toBe(false);
    expect(isNativeCompletedAtBatList([], pitchLines)).toBe(false);
    expect(isNativeCompletedAtBatList([{ ...nativeFacts[0], outcome: 'NOPE' }], pitchLines))
      .toBe(false);
  });
});
