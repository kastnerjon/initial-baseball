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
  primaryTeam: string;
  teamsDisplay: string;
  statsLine: string;
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
