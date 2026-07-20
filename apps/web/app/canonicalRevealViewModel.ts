import type {
  CanonicalBattingLine,
  CanonicalPitchingLine,
  CanonicalPlayerReveal,
} from '@initial-baseball/baseball-data/runtime';

export type RevealStatKind = 'hitter' | 'pitcher';
export type RevealStatValues = Record<string, number | string>;

export type CanonicalRevealViewModel = {
  playerId: string;
  displayName: string;
  playerType: 'hitter' | 'pitcher' | 'two-way';
  primaryPosition: string | null;
  yearsPlayedDisplay: string;
  teamIds: string[];
  career: {
    kind: RevealStatKind;
    stats: RevealStatValues;
  };
  seasons: Array<{
    season: number;
    teamIds: string[];
    kind: RevealStatKind;
    stats: RevealStatValues;
  }>;
};

export function createCanonicalRevealViewModel(
  reveal: CanonicalPlayerReveal,
): CanonicalRevealViewModel {
  const kind = choosePresentationKind(reveal);
  return {
    playerId: reveal.playerId,
    displayName: reveal.displayName,
    playerType: reveal.playerType,
    primaryPosition: reveal.career.primaryPosition,
    yearsPlayedDisplay: `${reveal.career.firstSeason}–${reveal.career.lastSeason}`,
    teamIds: reveal.career.teamIds,
    career: {
      kind,
      stats: kind === 'pitcher'
        ? formatPitching(reveal.career.pitching)
        : formatBatting(reveal.career.batting, reveal.career.advanced),
    },
    seasons: reveal.seasons.map((season) => ({
      season: season.season,
      teamIds: season.teamIds,
      kind,
      stats: kind === 'pitcher'
        ? formatPitching(season.pitching)
        : formatBatting(season.batting, season.advanced),
    })),
  };
}
function choosePresentationKind(reveal: CanonicalPlayerReveal): RevealStatKind {
  if (reveal.playerType === 'pitcher') {
    return 'pitcher';
  }
  if (reveal.playerType === 'hitter') {
    return 'hitter';
  }
  return reveal.career.batting === null && reveal.career.pitching !== null ? 'pitcher' : 'hitter';
}

function formatBatting(
  batting: CanonicalBattingLine | null,
  advanced: CanonicalPlayerReveal['career']['advanced'],
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
