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
    yearsPlayedDisplay: `${reveal.career.firstSeason}â€“${reveal.career.lastSeason}`,
    teamIds: displayTeamIds(reveal.career.teamIdentities, reveal.career.teamIds),
    career: {
      lines: buildStatLines({
        playerType: reveal.playerType,
        batting: reveal.career.batting,
        pitching: reveal.career.pitching,
        advanced: reveal.career.advanced,
      }),
    },
    seasons: reveal.seasons.map((season) => ({
      season: season.season¶»§q«^