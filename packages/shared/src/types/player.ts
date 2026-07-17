import type { HitterStatField, PitcherStatField } from './stats.js';

export type PlayerRole = 'hitter' | 'pitcher' | 'two_way';
export type PlayerKind = 'hitter' | 'pitcher';
export type PlayerHandedness = 'left' | 'right' | 'switch' | 'unknown';

export type Player = {
  id: string;
  fullName: string;
  displayName: string;
  primaryRole: PlayerRole;
  primaryPosition: string;
  mainDecade: string;
  firstYear: number | null;
  lastYear: number | null;
  yearsPlayedDisplay: string;
  primaryTeam: string;
  teamsDisplay: string;
  statsLine: string;
  careerStats: PlayerCareerStatStrip | null;
  dailyEligibilityTier: 'core' | 'extended' | 'none';
  dailyEligible: boolean;
  aliases: string[];
};

export type PlayerIdentity = {
  playerId: string;
  fullName: string;
  displayName: string;
  initials: string;
  kind: PlayerKind;
  primaryPosition: string;
  handedness?: PlayerHandedness;
};

export type PlayerCareerStats = Partial<Record<HitterStatField | PitcherStatField, number | string>>;

export type HitterStatValues = {
  AB: number;
  H: number;
  HR: number;
  BA: string;
  R: number;
  RBI: number;
  SB: number;
  OBP: string;
  SLG: string;
  OPS: string;
};

export type PitcherStatValues = {
  W: number;
  L: number;
  SV: number;
  ERA: string;
  WHIP: string;
  K: number;
  IP: string;
};

export type HitterCareerStatStrip = {
  kind: 'hitter';
  stats: HitterStatValues;
};

export type PitcherCareerStatStrip = {
  kind: 'pitcher';
  stats: PitcherStatValues;
};

export type PlayerCareerStatStrip = HitterCareerStatStrip | PitcherCareerStatStrip;

export type PlayerSeasonStatRow = {
  year: number;
  teams: string;
} & (
  | {
      kind: 'hitter';
      stats: HitterStatValues;
    }
  | {
      kind: 'pitcher';
      stats: PitcherStatValues;
    }
);
