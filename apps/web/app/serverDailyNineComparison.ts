import 'server-only';
import {
  createDailyNineComparisonService,
  type DailyNineComparisonRepository,
} from '@initial-baseball/daily';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createDailyNineComparisonReadService,
  type DailyNineAtBatComparisonReadRequest,
  type DailyNineCompletedComparisonReadRequest,
} from './dailyNineComparisonReadService';
import {
  measureDailyNineComparisonStage,
  measureDailyNineComparisonSyncStage,
  type DailyNineComparisonStageTimings,
} from './dailyNineComparisonTiming';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { dailyRuntime } from './serverCanonicalRuntime';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyNineComparisonRepository } from './supabaseDailyNineComparisonRepository';

let supabaseClient: SupabaseClient | null = null;

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
      () => requestRepository(timings).readAtBat(query),
    ),
    readCompletedGames: key => measureDailyNineComparisonStage(
      timings,
      'provider',
      () => requestRepository(timings).readCompletedGames(key),
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

function requestRepository(
  timings: DailyNineComparisonStageTimings,
): DailyNineComparisonRepository {
  return measureDailyNineComparisonSyncStage(
    timings,
    'provider-setup',
    () => {
      supabaseClient ??= createServerSupabaseClient();
      return createSupabaseDailyNineComparisonRepository(supabaseClient, { timings });
    },
  );
}
