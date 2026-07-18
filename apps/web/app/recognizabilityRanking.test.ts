import { describe, expect, it } from 'vitest';
import type { Player } from '@initial-baseball/shared';
import {
  comparePlayersByRecognizability,
  rankPlayersByRecognizability,
} from './createDailyPuzzleForDate';

describe('recognizability ranking', () => {
  it('sorts higher recognizability scores first', () => {
    const lowerScore = buildPlayer({ id: 'lower', displayName: 'Lower', tier: 'extended' });
    const higherScore = buildPlayer({ id: 'higher', displayName: 'Higher', tier: 'core' });

    expect(rankPlayersByRecognizability([lowerScore, higherScore]).map((player) => player.id)).toEqual([
      'higher',
      'lower',
    ]);
  });

  it('uses the more recent last season when recognizability scores tie', () => {
    const newer = buildPlayer({
      id: 'newer',
      displayName: 'Newer',
      firstYear: 2000,
      lastYear: 2000,
    });
    const older = buildPlayer({
      id: 'older',
      displayName: 'Older',
      firstYear: 1994,
      lastYear: 1995,
    });

    expect(comparePlayersByRecognizability(newer, older)).toBeLessThan(0);
  });

  it('places a known last season before a null last season when scores tie', () => {
    const knownYear = buildPlayer({
      id: 'known',
      displayName: 'Known',
      firstYear: null,
      lastYear: 1940,
    });
    const unknownYear = buildPlayer({
      id: 'unknown',
      displayName: 'Unknown',
      firstYear: null,
      lastYear: null,
    });

    expect(comparePlayersByRecognizability(knownYear, unknownYear)).toBeLessThan(0);
  });

  it('uses display name and then player ID as deterministic tie breakers', () => {
    const bravo = buildPlayer({ id: '2', displayName: 'Bravo' });
    const alphaSecond = buildPlayer({ id: '2', displayName: 'Alpha' });
    const alphaFirst = buildPlayer({ id: '1', displayName: 'Alpha' });

    expect(rankPlayersByRecognizability([bravo, alphaSecond, alphaFirst]).map((player) => player.id)).toEqual([
      '1',
      '2',
      '2',
    ]);
    expect(rankPlayersByRecognizability([bravo, alphaSecond, alphaFirst]).map((player) => player.displayName)).toEqual([
      'Alpha',
      'Alpha',
      'Bravo',
    ]);
  });
});

type BuildPlayerOptions = {
  id: string;
  displayName: string;
  tier?: Player['dailyEligibilityTier'];
  firstYear?: number | null;
  lastYear?: number | null;
};

function buildPlayer({
  id,
  displayName,
  tier = 'extended',
  firstYear = null,
  lastYear = null,
}: BuildPlayerOptions): Player {
  return {
    id,
    fullName: displayName,
    displayName,
    primaryRole: 'hitter',
    primaryPosition: '1B',
    mainDecade: 'Unknown',
    firstYear,
    lastYear,
    yearsPlayedDisplay: 'Unknown',
    primaryTeam: '—',
    teamsDisplay: '—',
    statsLine: '—',
    careerStats: null,
    dailyEligibilityTier: tier,
    dailyEligible: tier !== 'none',
    aliases: [],
  };
}
