import {
  DEFAULT_DAILY_HINT_CONFIG,
  DEFAULT_DAILY_STATS_HINT_CONFIG,
  type DailyPuzzle,
} from '@initial-baseball/shared';
import {
  DAILY_AT_BAT_COUNT,
  DAILY_PUZZLE_EPOCH,
  comparePlayersByRecognizability,
  getDailyPuzzleNumber,
  rankPlayersByRecognizability,
  resolveDailyPuzzleOverridePlayers,
  selectCanonicalDailyPlayersForDate,
  selectDailyPlayersForDate,
  type DailyPuzzleOverrideMap,
} from '@initial-baseball/daily';
import { createDailyPuzzlePitch } from './dailyPuzzleAdapters';
import { DAILY_PUZZLE_OVERRIDES } from './dailyPuzzleOverrides';

export {
  DAILY_AT_BAT_COUNT,
  DAILY_PUZZLE_EPOCH,
  comparePlayersByRecognizability,
  getDailyPuzzleNumber,
  rankPlayersByRecognizability,
  resolveDailyPuzzleOverridePlayers,
};

export function createDailyPuzzleForDate(date: string): DailyPuzzle {
  return createDailyPuzzleForDateWithOverrides(date, DAILY_PUZZLE_OVERRIDES);
}

export function createDailyPuzzleForDateWithOverrides(
  date: string,
  overrides: DailyPuzzleOverrideMap,
): DailyPuzzle {
  const selectedPlayers = selectDailyPlayersForDate(date, overrides);

  return {
    id: `daily-${date}`,
    puzzleNumber: getDailyPuzzleNumber(date),
    puzzleDate: date,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: selectedPlayers.map((player, index) => createDailyPuzzlePitch(index + 1, player)),
  };
}

export function createCanonicalDailyPuzzleForDate(
  date: string,
  resolveCanonicalPlayerId: (playerId: string) => string | null,
): DailyPuzzle {
  const selectedPlayers = selectCanonicalDailyPlayersForDate(
    date,
    DAILY_PUZZLE_OVERRIDES,
    resolveCanonicalPlayerId,
  );

  return {
    id: `daily-${date}`,
    puzzleNumber: getDailyPuzzleNumber(date),
    puzzleDate: date,
    status: 'published',
    hintConfig: DEFAULT_DAILY_HINT_CONFIG,
    statsHintConfig: DEFAULT_DAILY_STATS_HINT_CONFIG,
    pitches: selectedPlayers.map(({ player, canonicalPlayerId }, index) => {
      const pitch = createDailyPuzzlePitch(index + 1, player);
      return {
        ...pitch,
        player: { ...pitch.player, playerId: canonicalPlayerId },
      };
    }),
  };
}
