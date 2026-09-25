import { describe, expect, it } from 'vitest';
import type { Player } from '@initial-baseball/shared';
import { buildDefaultDailyHints } from './buildDefaultDailyHints';

describe('buildDefaultDailyHints', () => {
  it('formats hitter hint 4 from structured career stats in reveal-relative order', () => {
    const player = makePlayer({
      primaryRole: 'hitter',
      careerStats: {
        kind: 'hitter',
        stats: {
          AB: 5000,
          R: 900,
          H: 1500,
          HR: 300,
          RBI: 1100,
          SB: 80,
          BA: '.300',
          OBP: '.390',
          SLG: '.520',
          OPS: '.910',
        },
      },
    });

    expect(statsHint(player)).toBe('HR 300 / RBI 1100 / SB 80 / BA .300 / OBP .390');
  });

  it('includes sourced pitcher saves in reveal-relative order without adding IP', () => {
    const player = makePlayer({
      primaryRole: 'pitcher',
      primaryPosition: 'P',
      careerStats: {
        kind: 'pitcher',
        stats: {
          W: 150,
          L: 90,
          SV: 0,
          ERA: '3.20',
          WHIP: '1.15',
          K: 2100,
          IP: '2200.1',
        },
      },
    });

    expect(statsHint(player)).toBe('W 150 / L 90 / SV 0 / ERA 3.20 / WHIP 1.15 / K 2100');
  });

  it('omits unavailable pitcher saves instead of fabricating SV 0', () => {
    const player = makePlayer({
      primaryRole: 'pitcher',
      primaryPosition: 'P',
      careerStats: {
        kind: 'pitcher',
        stats: {
          W: 10,
          L: 12,
          ERA: '4.10',
          WHIP: '1.31',
          K: 300,
          IP: '450.0',
        },
      },
    });

    expect(statsHint(player)).toBe('W 10 / L 12 / ERA 4.10 / WHIP 1.31 / K 300');
  });

  it('does not parse the legacy statsLine when structured career stats are available', () => {
    const player = makePlayer({
      statsLine: 'LEGACY VALUE THAT MUST NOT DRIVE HINT 4',
      careerStats: {
        kind: 'hitter',
        stats: {
          AB: 100,
          R: 20,
          H: 30,
          HR: 5,
          RBI: 18,
          SB: 2,
          BA: '.300',
          OBP: '.360',
          SLG: '.500',
          OPS: '.860',
        },
      },
    });

    expect(statsHint(player)).toBe('HR 5 / RBI 18 / SB 2 / BA .300 / OBP .360');
  });

  it('reports unavailable stats when no structured career line exists', () => {
    expect(statsHint(makePlayer({ careerStats: null }))).toBe('Stats unavailable');
  });
});

function statsHint(player: Player): string {
  return buildDefaultDailyHints(player).find((hint) => hint.hintType === 'stats')?.hintValue ?? '';
}

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: 'test-player',
    fullName: 'Test Player',
    displayName: 'Test Player',
    primaryRole: 'hitter',
    primaryPosition: 'CF',
    mainDecade: '2000s',
    firstYear: 2000,
    lastYear: 2010,
    yearsPlayedDisplay: '2000–2010',
    primaryTeam: 'TST',
    teamsDisplay: 'TST',
    statsLine: 'legacy',
    careerStats: null,
    dailyEligibilityTier: 'core',
    dailyEligible: true,
    aliases: [],
    ...overrides,
  };
}
