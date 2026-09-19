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

const service = createDailyNineComparisonReadService({
  comparison: createDailyNineComparisonService(lazyRepository),
  loadAuthoritativePuzzle: puzzleDate => dailyRuntime.getPublicPuzzle(puzzleDate),
  getCurrentDailyDate: getPacificDailyDateString,
});

export function readDailyNineAtBatComparison(
  request: DailyNineAtBatComparisonReadRequest,
) {
  return service.readAtBat(request);
}

export function readDailyNineCompletedComparison(
  request: DailyNineCompletedComparisonReadRequest,
) {
  return service.readCompleted(request);
}
