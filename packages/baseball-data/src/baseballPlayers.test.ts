import { describe, expect, it } from 'vitest';
import {
  baseballPlayers,
  coreDailyEligiblePlayers,
  dailyEligiblePlayers,
  extendedDailyEligiblePlayers,
} from './index.js';

const DEMO_PLAYER_NAMES = [
  'Ken Griffey Jr.',
  'David Wright',
  'CC Sabathia',
  'Andruw Jones',
  'Jason Varitek',
  'Hideki Matsui',
];

describe('baseballPlayers', () => {
  it('contains a broad searchable player universe', () => {
    expect(baseballPlayers.length).toBeGreaterThanOrEqual(1000);
  });

  it('has unique ids', () => {
    expect(new Set(baseballPlayers.map((player) => player.id)).size).toBe(baseballPlayers.length);
  });

  it('includes required fields for every player', () => {
    for (const player of baseballPlayers) {
      expect(player.id.length).toBeGreaterThan(0);
      expect(player.fullName.length).toBeGreaterThan(0);
      expect(player.displayName.length).toBeGreaterThan(0);
      expect(player.primaryPosition.length).toBeGreaterThan(0);
      expect(player.mainDecade.length).toBeGreaterThan(0);
      expect(player.primaryTeam).toBeTypeOf('string');
      expect(player.teamsDisplay).toBeTypeOf('string');
      expect(player.statsLine).toBeTypeOf('string');
      expect(['core', 'extended', 'none']).toContain(player.dailyEligibilityTier);
      expect(player.dailyEligible).toBeTypeOf('boolean');
      expect(Array.isArray(player.aliases)).toBe(true);
    }
  });

  it('keeps aliases as arrays', () => {
    expect(baseballPlayers.every((player) => Array.isArray(player.aliases))).toBe(true);
  });

  it('includes the current demo puzzle players by searchable name', () => {
    for (const name of DEMO_PLAYER_NAMES) {
      expect(
        baseballPlayers.some((player) => player.fullName === name || player.displayName === name || player.aliases.includes(name)),
      ).toBe(true);
    }
  });

  it('gives a majority of players a non-Unknown primary position', () => {
    const knownPositionCount = baseballPlayers.filter((player) => player.primaryPosition !== 'Unknown').length;

    expect(knownPositionCount).toBeGreaterThan(baseballPlayers.length / 2);
  });

  it('gives a majority of players a non-empty teams display', () => {
    const withTeamsCount = baseballPlayers.filter((player) => player.teamsDisplay.length > 0).length;

    expect(withTeamsCount).toBeGreaterThan(baseballPlayers.length / 2);
  });

  it('gives a majority of players a non-empty primary team', () => {
    const withPrimaryTeamCount = baseballPlayers.filter((player) => player.primaryTeam.length > 0).length;

    expect(withPrimaryTeamCount).toBeGreaterThan(baseballPlayers.length / 2);
  });

  it('gives a majority of players a non-Unknown main decade', () => {
    const withKnownMainDecadeCount = baseballPlayers.filter((player) => player.mainDecade !== 'Unknown').length;

    expect(withKnownMainDecadeCount).toBeGreaterThan(baseballPlayers.length / 2);
  });

  it('keeps dailyEligible consistent with dailyEligibilityTier', () => {
    for (const player of baseballPlayers) {
      expect(player.dailyEligible).toBe(player.dailyEligibilityTier !== 'none');
    }
  });

  it('exports only the expected players in each Daily-eligible subset', () => {
    expect(dailyEligiblePlayers.every((player) => player.dailyEligible)).toBe(true);
    expect(coreDailyEligiblePlayers.every((player) => player.dailyEligibilityTier === 'core')).toBe(true);
    expect(extendedDailyEligiblePlayers.every((player) => player.dailyEligibilityTier === 'extended')).toBe(true);
  });

  it('keeps both core and extended Daily pools populated', () => {
    expect(coreDailyEligiblePlayers.length).toBeGreaterThan(0);
    expect(extendedDailyEligiblePlayers.length).toBeGreaterThan(0);
  });

  it('keeps the Daily-eligible pool large but meaningfully smaller than the full search universe', () => {
    expect(dailyEligiblePlayers.length).toBeGreaterThanOrEqual(500);
    expect(dailyEligiblePlayers.length).toBeLessThan(baseballPlayers.length);
  });

  it('gives a majority of hitters a meaningfully enriched statsLine', () => {
    const hitters = baseballPlayers.filter((player) => player.primaryRole === 'hitter');
    const hittersWithRealRateStats = hitters.filter((player) => hasRealHitterRateStats(player.statsLine));

    expect(hittersWithRealRateStats.length).toBeGreaterThan(hitters.length / 2);
  });

  it('gives a majority of pitchers a meaningfully enriched statsLine', () => {
    const pitchers = baseballPlayers.filter((player) => player.primaryRole === 'pitcher');
    const pitchersWithRealRateStats = pitchers.filter((player) => hasRealPitcherRateStats(player.statsLine));

    expect(pitchersWithRealRateStats.length).toBeGreaterThan(pitchers.length / 2);
  });

  it('splits roles between hitters and pitchers', () => {
    const pitchers = baseballPlayers.filter((player) => player.primaryRole === 'pitcher').length;
    const hitters = baseballPlayers.filter((player) => player.primaryRole === 'hitter').length;

    expect(pitchers).toBeGreaterThan(0);
    expect(hitters).toBeGreaterThan(0);
  });

  it('marks players as pitchers only when their primary position is P', () => {
    for (const player of baseballPlayers) {
      if (player.primaryRole === 'pitcher') {
        expect(player.primaryPosition).toBe('P');
      }
    }
  });

  it('marks players as hitters when their primary position is not P', () => {
    for (const player of baseballPlayers) {
      if (player.primaryPosition !== 'P') {
        expect(player.primaryRole).toBe('hitter');
      }
    }
  });

  it('keeps fallback placeholders for some players without full Lahman coverage', () => {
    expect(baseballPlayers.some((player) => player.primaryPosition === 'Unknown')).toBe(true);
    expect(baseballPlayers.some((player) => player.statsLine.includes('BA —') || player.statsLine.includes('ERA —'))).toBe(true);
  });

  it('does not include generic WAR in any statsLine', () => {
    expect(baseballPlayers.every((player) => !/\bWAR\b/.test(player.statsLine))).toBe(true);
  });

  it('enriches current demo players with real position and teams data', () => {
    for (const player of DEMO_PLAYER_NAMES.map((name) => findPlayerByName(name))) {
      expect(player.primaryPosition).not.toBe('Unknown');
      expect(player.primaryTeam.length).toBeGreaterThan(0);
      expect(player.teamsDisplay.length).toBeGreaterThan(0);
      expect(player.statsLine.length).toBeGreaterThan(0);
      expect(player.dailyEligible).toBe(true);
      expect(player.dailyEligibilityTier).not.toBe('none');
    }
  });

  it('keeps the expected demo player role, position, primary team, main decade, and Daily tier mapping', () => {
    const ccSabathia = findPlayerByName('CC Sabathia');
    const davidWright = findPlayerByName('David Wright');
    const kenGriffeyJr = findPlayerByName('Ken Griffey Jr.');
    const hidekiMatsui = findPlayerByName('Hideki Matsui');
    const ajJimenez = findPlayerByName('A. J. Jiménez');

    expect(ccSabathia.primaryPosition).toBe('P');
    expect(ccSabathia.primaryRole).toBe('pitcher');
    expect(ccSabathia.primaryTeam).toBe('NYY');
    expect(ccSabathia.mainDecade).toBe('2000s');
    expect(ccSabathia.dailyEligibilityTier).toBe('core');

    expect(davidWright.primaryPosition).toBe('3B');
    expect(davidWright.primaryRole).toBe('hitter');
    expect(davidWright.primaryTeam).toBe('NYM');
    expect(davidWright.mainDecade).toBe('2000s');
    expect(davidWright.dailyEligibilityTier).toBe('core');

    expect(kenGriffeyJr.primaryPosition).toBe('CF');
    expect(kenGriffeyJr.primaryRole).toBe('hitter');
    expect(kenGriffeyJr.primaryTeam).toBe('SEA');
    expect(kenGriffeyJr.mainDecade).toBe('1990s');
    expect(kenGriffeyJr.dailyEligibilityTier).toBe('core');

    expect(hidekiMatsui.dailyEligibilityTier).toBe('core');
    expect(ajJimenez.dailyEligibilityTier).toBe('none');
    expect(ajJimenez.dailyEligible).toBe(false);
  });

  it('includes inducted pre-1950 Hall of Fame legends and forces them core eligible', () => {
    for (const name of ['Babe Ruth', 'Lou Gehrig', 'Ty Cobb', 'Walter Johnson', 'Honus Wagner']) {
      const player = findPlayerByExactName(name);

      expect(player.dailyEligibilityTier).toBe('core');
      expect(player.dailyEligible).toBe(true);
    }
  });

  it('keeps all generated inducted Hall of Fame player names Daily-eligible', () => {
    const generatedHallOfFamers = baseballPlayers.filter((player) => (
      INDUCTED_HALL_OF_FAME_PLAYER_NAMES.has(player.fullName)
      || INDUCTED_HALL_OF_FAME_PLAYER_NAMES.has(player.displayName)
    ));

    expect(generatedHallOfFamers.length).toBeGreaterThan(0);
    expect(generatedHallOfFamers.every((player) => player.dailyEligible)).toBe(true);
    expect(generatedHallOfFamers.every((player) => player.dailyEligibilityTier === 'core')).toBe(true);
  });

  it('does not broadly include pre-1950 non-Hall of Fame players solely because of old MLB years', () => {
    expect(baseballPlayers.some((player) => player.fullName === 'Shoeless Joe Jackson' || player.displayName === 'Shoeless Joe Jackson')).toBe(false);
  });

  it('includes expected demo player statline values', () => {
    const kenGriffeyJr = findPlayerByName('Ken Griffey Jr.');
    const davidWright = findPlayerByName('David Wright');
    const ccSabathia = findPlayerByName('CC Sabathia');

    expect(kenGriffeyJr.statsLine).toContain('HR 630');
    expect(davidWright.statsLine).toContain('HR 242');
    expect(ccSabathia.statsLine).toContain('W 251');
    expect(ccSabathia.statsLine).toContain('K 3093');
  });

  it('formats hitter statlines with BA and OBP decimals that begin with a dot', () => {
    const kenGriffeyJr = findPlayerByName('Ken Griffey Jr.');

    expect(kenGriffeyJr.statsLine).toMatch(/BA \.\d{3}/);
    expect(kenGriffeyJr.statsLine).toMatch(/OBP \.\d{3}/);
  });

  it('formats pitcher statlines with ERA and WHIP to two decimals', () => {
    const ccSabathia = findPlayerByName('CC Sabathia');

    expect(ccSabathia.statsLine).toMatch(/ERA \d+\.\d{2}/);
    expect(ccSabathia.statsLine).toMatch(/WHIP \d+\.\d{2}/);
  });
});

function findPlayerByName(name: string) {
  const player = baseballPlayers.find((candidate) => (
    candidate.fullName === name
    || candidate.displayName === name
    || candidate.aliases.includes(name)
  ));

  expect(player).toBeDefined();
  return player!;
}

function findPlayerByExactName(name: string) {
  const player = baseballPlayers.find((candidate) => candidate.fullName === name || candidate.displayName === name);

  expect(player).toBeDefined();
  return player!;
}

function hasRealHitterRateStats(statsLine: string) {
  return /BA \.\d{3}/.test(statsLine) && /OBP \.\d{3}/.test(statsLine);
}

function hasRealPitcherRateStats(statsLine: string) {
  return /ERA \d+\.\d{2}/.test(statsLine) && /WHIP \d+\.\d{2}/.test(statsLine);
}

const INDUCTED_HALL_OF_FAME_PLAYER_NAMES = new Set([
  'Babe Ruth',
  'Lou Gehrig',
  'Ty Cobb',
  'Walter Johnson',
  'Honus Wagner',
]);
