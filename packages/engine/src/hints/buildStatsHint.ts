import type { PlayerCareerStats, PlayerRole, StatsHintConfig } from '@initial-baseball/shared';
import { HITTER_STAT_LABELS, PITCHER_STAT_LABELS } from '@initial-baseball/shared';

export function buildStatsHint(input: {
  role: PlayerRole;
  stats: PlayerCareerStats;
  config: StatsHintConfig;
}): string {
  const fields = input.role === 'pitcher' ? input.config.pitcher : input.config.hitter;
  const labels = input.role === 'pitcher' ? PITCHER_STAT_LABELS : HITTER_STAT_LABELS;

  return fields
    .map((field) => {
      const value = input.stats[field];
      if (value === undefined || value === null || value === '') return null;
      return `${value} ${labels[field as keyof typeof labels]}`;
    })
    .filter((value): value is string => Boolean(value))
    .join(' / ');
}
