import type { HitterStatField, PitcherStatField } from './stats.js';

export type PlayerRole = 'hitter' | 'pitcher' | 'two_way';

export type Player = {
  id: string;
  fullName: string;
  displayName: string;
  primaryRole: PlayerRole;
  primaryPosition: string;
  mainDecade: string;
  teamsDisplay: string;
  aliases: string[];
};

export type PlayerCareerStats = Partial<Record<HitterStatField | PitcherStatField, number | string>>;
