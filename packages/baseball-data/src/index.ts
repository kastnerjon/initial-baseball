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
  dailyEligibilityTier: 'core' | 'extended' | 'none';
  dailyEligible: boolean;
};

export const baseballPlayers = generatedPlayers as Player[];
export const dailyEligiblePlayers = baseballPlayers.filter((player) => player.dailyEligible);
export const coreDailyEligiblePlayers = baseballPlayers.filter((player) => player.dailyEligibilityTier === 'core');
export const extendedDailyEligiblePlayers = baseballPlayers.filter((player) => player.dailyEligibilityTier === 'extended');
