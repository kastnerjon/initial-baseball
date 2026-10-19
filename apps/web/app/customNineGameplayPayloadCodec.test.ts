import { describe, expect, it } from 'vitest';
import { decodeCustomNineTerminalReveal } from './customNineGameplayPayloadCodec';

const baseReveal = {
  playerId: 'ibp_example',
  displayName: 'Example Player',
  playerType: 'two-way',
  primaryPosition: 'P',
  yearsPlayedDisplay: '2018–2025',
  teamIds: ['LAA', 'LAD'],
  career: {
    lines: [
      { kind: 'hitter', stats: { HR: 225 } },
      { kind: 'pitcher', stats: { K: 1050 } },
    ],
  },
  seasons: [],
};

describe('Custom Nine and Custom Lineup v2 shared terminal reveal decoder', () => {
  it('keeps optional sourced highs only inside validated terminal reveal and strips private fields', () => {
    const data = {
      ...baseReveal,
      futureUnrevealedAnswers: ['private'],
      career: {
        ...baseReveal.career,
        privateSource: 'private',
        regularSeasonPeaks: {
          homeRuns: { value: 54, season: 2024, hidden: 'private' },
          strikeouts: { value: 219, season: 2022 },
          private: 'private',
        },
      },
    };
    const decoded = decodeCustomNineTerminalReveal(data);
    expect(decoded.career.regularSeasonPeaks).toEqual({
      homeRuns: { season: 2024, value: 54 },
      strikeouts: { season: 2022, value: 219 },
    });
    expect(JSON.stringify(decoded)).not.toContain('private');
    expect(decoded.career.lines).toHaveLength(2);
  });

  it('accepts old Custom Nine and Custom v2 terminal responses with no peak fields', () => {
    const decoded = decodeCustomNineTerminalReveal(baseReveal);
    expect(decoded.career).toEqual(baseReveal.career);
    expect(decoded.career.regularSeasonPeaks).toBeUndefined();
  });

  it('keeps known zero and unavailable values distinct', () => {
    const decoded = decodeCustomNineTerminalReveal({
      ...baseReveal,
      career: {
        ...baseReveal.career,
        regularSeasonPeaks: {
          homeRuns: { season: 1912, value: 0 },
          strikeouts: null,
        },
      },
    });
    expect(decoded.career.regularSeasonPeaks).toEqual({
      homeRuns: { season: 1912, value: 0 },
      strikeouts: null,
    });
  });

  it.each([
    { homeRuns: { season: 2001, value: -1 }, strikeouts: null },
    { homeRuns: { season: '2001', value: 73 }, strikeouts: null },
    { homeRuns: { season: 2001, value: '73' }, strikeouts: null },
    { homeRuns: { season: 2001, value: 73.5 }, strikeouts: null },
    { homeRuns: {}, strikeouts: null },
    { homeRuns: null },
    { homeRuns: null, strikeouts: { season: 3000, value: 200 } },
  ])('rejects malformed optional peak values rather than leaking data: %#', (peaks) => {
    expect(() => decodeCustomNineTerminalReveal({
      ...baseReveal,
      career: { ...baseReveal.career, regularSeasonPeaks: peaks },
    })).toThrow('Invalid Custom Nine terminal payload');
  });
});
