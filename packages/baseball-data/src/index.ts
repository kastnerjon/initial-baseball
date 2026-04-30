import type { Player } from '@initial-baseball/shared';
import generatedPlayers from './generated/players.json';

export type NormalizedPlayerRow = {
  externalSource: string;
  externalId: string;
  fullName: string;
  displayName: string;
  primaryRole: 'hitter' | 'pitcher' | 'two_way';
  primaryPosition: string;
  mainDecade: string;
  primaryTeam: string;
  teamsDisplay: string;
};

export const baseballPlayers = generatedPlayers as Player[];
