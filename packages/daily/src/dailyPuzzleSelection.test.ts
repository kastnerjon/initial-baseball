import { dailyEligiblePlayers } from '@initial-baseball/baseball-data';
import type { Player } from '@initial-baseball/shared';
import { describe, expect, it } from 'vitest';
import {
  comparePlayersByRecognizability,
  rankPlayersByRecognizability,
  selectCanonicalDailyPlayersForDate,
  selectDailyPlayersForDate,
} from './dailyPuzzleSelection';

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

describe('canonical Daily selection compatibility', () => {
  it('preserves established generated lineups when canonical IDs are one-to-one', () => {
    for (const date of ['2026-04-27', '2026-07-19', '2026-07-20']) {
      const legacyPlayerIds = selectDailyPlayersForDate(date, {})
        .map((player) => player.id);
      const canonicalPlayerIds = selectCanonicalDailyPlayersForDate(
        date,
        {},
        playerId => `canonical:${playerId}`,
      ).map(({ player }) => player.id);

      expect(canonicalPlayerIds).toEqual(legacyPlayerIds);
    }
  });

  it('filters generated candidates without a canonical runtime target', () => {
    const selections = selectCanonicalDailyPlayersForDate('2026-07-20', {}, playerId => (
      playerId === 'chadwick:9b391785' ? null : `canonical:${playerId}`
    ));

    expect(selections).toHaveLength(9);
    expect(selections.every(({ canonicalPlayerId }) => canonicalPlayerId.startsWith('canonical:'))).toBe(true);
    expect(selections.some(({ player }) => player.id === 'chadwick:9b391785')).toBe(false);
  });

  it('deduplicates selected answers by canonical player ID without changing the hash key', () => {
    const topPoolLegacyIds = new Set(
      rankPlayersByRecognizability(dailyEligiblePlayers)
        .slice(0, 250)
        .map((player) => player.id),
    );
    const selections = selectCanonicalDailyPlayersForDate('2026-07-20', {}, playerId => (
      topPoolLegacyIds.has(playerId) ? 'canonical:merged-top-pool' : `canonical:${playerId}`
    ));

    expect(selections).toHaveLength(9);
    expect(new Set(selections.map(({ canonicalPlayerId }) => canonicalPlayerId)).size).toBe(9);
  });

  it('rejects overrides that resolve two legacy records to one canonical player', () => {
    expect(() => selectCanonicalDailyPlayersForDate('2026-07-20', {
      '2026-07-20': [
        'Ken Griffey Jr.',
        'David Wright',
        'CC Sabathia',
        'Albert Pujols',
        'Derek Jeter',
        'Ichiro Suzuki',
      ],
    }, () => 'canonical:duplicate')).toThrow('duplicate canonical player');
  });

  it('fails visibly when a historical override has no canonical target', () => {
    expect(() => selectCanonicalDailyPlayersForDate('2026-07-20', {
      '2026-07-20': [
        'Ken Griffey Jr.',
        'David Wright',
        'CC Sabathia',
        'Albert Pujols',
        'Derek Jeter',
        'Ichiro Suzuki',
      ],
    }, () => null)).toThrow('could not resolve legacy playerId to canonical runtime data');
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
