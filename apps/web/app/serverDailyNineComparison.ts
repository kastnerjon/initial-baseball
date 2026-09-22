import 'server-only';
import {
  createDailyNineComparisonService,
  type DailyNineComparisonRepository,
} from '@initial-baseball/daily';
import {
  createDailyNineComparisonReadService,
  type DailyNineAtBatComparisonReadRequest,
  type DailyNineCompletedComparisonReadRequest,
} from './dailyNineComparisonReadService';
import {
  measureDailyNineComparisonStage,
  type DailyNineComparisonStageTimings,
} from './dailyNineComparisonTiming';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { dailyRuntime } from './serverCanonicalRuntime';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyNineComparisonRepository } from './supabaseDailyNineComparisonRepository';

let repository: DailyNineComparisonRepository | null = null;

const lazyRepository: DailyNineComparisonRepository = {
  readAtBat(query) {
    repository ??= createSupabaseDailyNineComparisonRepository(createServerSupabaseClient());
    return repository.readAtBat(query);
  },
  readCompletedGames(key) {
    repository ??= createSupabaseDailyNineComparisonRepository(createServerSupabaseClient());
    return repository.readCompletedGames(key);
  },
};

export function readDailyNineAtBatComparison(
  request: DailyNineAtBatComparisonReadRequest,
  timings: DailyNineComparisonStageTimings = {},
) {
  return createReadService(timings).readAtBat(request);
}

export function readDailyNineCompletedComparison(
  request: DailyNineCompletedComparisonReadRequest,
  timings: DailyNineComparisonStageTimings = {},
) {
  return createReadService(timings).readCompleted(request);
}

function createReadService(timings: DailyNineComparisonStageTimings) {
  const timedRepository: DailyNineComparisonRepository = {
    readAtBat: query => measureDailyNineComparisonStage(
      timings,
      'provider',
      () => lazyRepository.readAtBat(query),
    ),
    readCompletedGames: key => measureDailyNineComparisonStage(
      timings,
      'provider',
      () => lazyRepository.readCompletedGames(key),
    ),
  };

  return createDailyNineComparisonReadService({
    comparison: createDailyNineComparisonService(timedRepository),
    loadAuthoritativePuzzle: puzzleDate => measureDailyNineComparisonStage(
      timings,
      'puzzle',
      () => dailyRuntime.getPublicPuzzle(puzzleDate),
    ),
    getCurrentDailyDate: getPacificDailyDateString,
  });
}
