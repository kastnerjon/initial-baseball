import { describe, expect, it } from 'vitest';
import { normalizeDailyTerminalAtBat } from './normalizeDailyTerminalAtBat';

const pitch = { pitchNumber: 1, initials: 'AB' };
const fact = (resolution: 'correct' | 'strikeout' | 'give_up', wrongGuesses: number) => ({
  pitchNumber: 1,
  initials: 'AB',
  hintsRevealed: 2,
  wrongGuesses,
  resolution,
  outcome: resolution === 'correct' ? '2B' : 'K',
  clientAwardedPoints: 9999,
});

describe('server-owned variable strike-count terminal normalization', () => {
  it.each([1, 2, 3] as const)('accepts terminal K at exactly %i strikes', cap => {
    const value = normalizeDailyTerminalAtBat(fact('strikeout', cap), pitch, cap);
    expect(value).toEqual({ ok: true, atBat: {
      pitchNumber: 1, initials: 'AB', hintsRevealed: 2,
      wrongGuesses: cap, resolution: 'strikeout', outcome: 'K',
    } });
    expect(JSON.stringify(value)).not.toContain('clientAwardedPoints');
  });

  it.each([1, 2, 3] as const)('preserves real Give Up counts and correct answers at cap %i', cap => {
    for (let wrong = 0; wrong < cap; wrong++) {
      expect(normalizeDailyTerminalAtBat(fact('give_up', wrong), pitch, cap))
        .toMatchObject({ ok: true, atBat: { outcome: 'K', wrongGuesses: wrong } });
      expect(normalizeDailyTerminalAtBat(fact('correct', wrong), pitch, cap))
        .toMatchObject({ ok: true, atBat: { outcome: '2B', wrongGuesses: wrong } });
    }
  });

  it.each([1, 2, 3] as const)('rejects nonexistent extra/missing strikes at cap %i', cap => {
    expect(normalizeDailyTerminalAtBat(fact('strikeout', cap - 1), pitch, cap))
      .toEqual({ ok: false, error: 'inconsistent_at_bat' });
    expect(normalizeDailyTerminalAtBat(fact('give_up', cap), pitch, cap))
      .toEqual({ ok: false, error: 'inconsistent_at_bat' });
    expect(normalizeDailyTerminalAtBat(fact('correct', cap), pitch, cap))
      .toEqual({ ok: false, error: 'inconsistent_at_bat' });
    expect(normalizeDailyTerminalAtBat(fact('strikeout', cap + 1), pitch, cap))
      .toEqual({ ok: false, error: 'invalid_at_bat' });
  });

  it('preserves every historical two-argument Daily/Classic normalizer behavior', () => {
    expect(normalizeDailyTerminalAtBat(fact('strikeout', 3), pitch).ok).toBe(true);
    expect(normalizeDailyTerminalAtBat(fact('strikeout', 2), pitch).ok).toBe(false);
    expect(normalizeDailyTerminalAtBat(fact('give_up', 0), pitch).ok).toBe(true);
    expect(normalizeDailyTerminalAtBat(fact('correct', 2), pitch).ok).toBe(true);
  });

  it('fails closed if trusted context supplies a malformed cap', () => {
    for (const invalid of [0, -1, 4, 1.5, null, '2', Number.NaN]) {
      expect(normalizeDailyTerminalAtBat(fact('strikeout', 3), pitch, invalid as 1|2|3))
        .toEqual({ ok: false, error: 'invalid_at_bat' });
    }
  });
});
