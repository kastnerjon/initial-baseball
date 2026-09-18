import 'server-only';
import type { DailyAtBatResultRepository } from '@initial-baseball/daily';
import { createDailyAtBatResultSubmissionService } from './dailyAtBatResultSubmissionService';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { dailyRuntime } from './serverCanonicalRuntime';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyAtBatResultRepository } from './supabaseDailyAtBatResultRepository';

let repository: DailyAtBatResultRepository | null = null;

const lazyRepository: DailyAtBatResultRepository = {
  insertIfAbsent(result) {
    repository ??= createSupabaseDailyAtBatResultRepository(createServerSupabaseClient());
    return repository.insertIfAbsent(result);
  },
};

const service = createDailyAtBatResultSubmissionService({
  repository: lazyRepository,
  loadAuthoritativePuzzle: (puzzleDate) => dailyRuntime.getPublicPuzzle(puzzleDate),
  getCurrentDailyDate: getPacificDailyDateString,
});

export function submitDailyAtBatResult(submission: unknown) {
  return service.submit(submission);
}
