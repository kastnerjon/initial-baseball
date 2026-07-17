import type { Player } from '@initial-baseball/shared';
import generatedPlayers from './generated/players.json';
import generatedPitcherSaves from './generated/pitcher-saves.json';

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

const pitcherSaves = generatedPitcherSaves as Record<string, number>;

export const baseballPlayers = (generatedPlayers as Player[]).map((player) => {
  if (player.careerStats?.kind !== 'pitcher') {
    return player;
  }

  return {
    ...player,
    careerStats: {
      ...player.careerStats,
      stats: {
        ...player.careerStats.stats,
        SV: pitcherSaves[player.id] ?? 0,
      },
    },
  };
});
export const dailyEligiblePlayers = baseballPlayers.filter((player) => player.dailyEligible);
export const coreDailyEligiblePlayers = baseballPlayers.filter((player) => player.dailyEligibilityTier === 'core');
export const extendedDailyEligiblePlayers = baseballPlayers.filter((player) => player.dailyEligibilityTier === 'extended');
