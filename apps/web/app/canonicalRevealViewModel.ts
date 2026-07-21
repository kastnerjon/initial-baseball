import type {
  CanonicalAdvancedLine,
  CanonicalBattingLine,
  CanonicalPitchingLine,
  CanonicalPlayerReveal,
} from '@initial-baseball/baseball-data/runtime';

export type RevealStatKind = 'hitter' | 'pitcher';
export type RevealStatValues = Record<string, number | string>;

export type CanonicalRevealStatLine = {
  kind: RevealStatKind;
  stats: RevealStatValues;
};

export type CanonicalRevealViewModel = {
  playerId: string;
  displayName: string;
  playerType: 'hitter' | 'pitcher' | 'two-way';
  primaryPosition: string | null;
  yearsPlayedDisplay: string;
  teamIds: string[];
  career: {
    lines: CanonicalRevealStatLine[];
  };
  seasons: Array<{
    season: number;
    teamIds: string[];
    lines: CanonicalRevealStatLine[];
  }>;
};

export function createCanonicalRevealViewModel(
  reveal: CanonicalPlayerReveal,
): CanonicalRevealViewModel {
  return {
    playerId: reveal.playerId,
    displayName: reveal.displayName,
    playerType: reveal.playerType,
    primaryPosition: reveal.career.primaryPosition,
    yearsPlayedDisplay: `${reveal.career.firstSeason}–${reveal.career.lastSeason}`,
    teamIds: reveal.career.teamIdentities.map((team) => team.abbreviation),
    career: {
      lines: buildStatLines({
        playerType: reveal.playerType,
        batting: reveal.career.batting,
        pitching: reveal.career.pitching,
        advanced: reveal.career.advanced,
      }),
    },
    seasons: reveal.seasons.map((season) => ({
      season: season.season,
      teamIds: season.teamIdentities.map((team) => team.abbreviation),
      lines: buildStatLines({
        playerType: reveal.playerType,
        batting: season.batting,
        pitching: season.pitching,
        advanced: season.advanced,
      }),
    })),
  };
}

function buildStatLines({
  playerType,
  batting,
  pitching,
  advanced,
}: {
  playerType: CanonicalPlayerReveal['playerType'];
  batting: CanonicalBattingLine | null;
  pitching: CanonicalPitchingLine | null;
  advanced: CanonicalAdvancedLine | null;
}): CanonicalRevealStatLine[] {
  if (playerType === 'hitter') {
    return [{ kind: 'hitter', stats: formatBatting(batting, advanced) }];
  }
  if (playerType === 'pitcher') {
    return [{ kind: 'pitcher', stats: formatPitching(pitching) }];
  }
  return [
    { kind: 'hitter', stats: formatBatting(batting, advanced) },
    { kind: 'pitcher', stats: formatPitching(pitching) },
  ];
}

function formatBatting(
  batting: CanonicalBattingLine | null,
  advanced: CanonicalAdvancedLine | null,
): RevealStatValues {
  return {
    AB: value(batting?.atBats),
    H: value(batting?.hits),
    HR: value(batting?.homeRuns),
    BA: rate(batting?.battingAverage),
    R: value(batting?.runs),
    RBI: value(batting?.runsBattedIn),
    SB: value(batting?.stolenBases),
    OBP: rate(advanced?.onBasePercentage),
    SLG: rate(advanced?.sluggingPercentage),
    OPS: rate(advanced?.ops),
  };
}

function formatPitching(pitching: CanonicalPitchingLine | null): RevealStatValues {
  return {
    W: value(pitching?.wins),
    L: value(pitching?.losses),
    SV: value(pitching?.saves),
    ERA: fixed(pitching?.earnedRunAverage, 2),
    WHIP: fixed(pitching?.whip, 2),
    K: value(pitching?.strikeouts),
    IP: innings(pitching?.outsPitched),
  };
}

function value(input: number | null | undefined): number | string {
  return input ?? '—';
}

function rate(input: number | null | undefined): string {
  if (input === null || input === undefined) {
    return '—';
  }
  return input.toFixed(3).replace(/^0/, '');
}

function fixed(input: number | null | undefined, digits: number): string {
  return input === null || input === undefined ? '—' : input.toFixed(digits);
}

function innings(outs: number | null | undefined): string {
  if (outs === null || outs === undefined) {
    return '—';
  }
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}
