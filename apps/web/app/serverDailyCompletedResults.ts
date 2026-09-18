import 'server-only';
import type { DailyCompletedResultRepository } from '@initial-baseball/daily';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { createDailyCompletedResultSubmissionService } from './dailyCompletedResultSubmissionService';
import { dailyRuntime } from './serverCanonicalRuntime';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyCompletedResultRepository } from './supabaseDailyCompletedResultRepository';

let repository: DailyCompletedResultRepository | null = null;

const lazyRepository: DailyCompletedResultRepository = {
  insertIfAbsent(result) {
    repository ??= createSupabaseDailyCompletedResultRepository(createServerSupabaseClient());
    return repository.insertIfAbsent(result);
  },
};

const service = createDailyCompletedResultSubmissionService({
  repository: lazyRepository,
  loadAuthoritativePuzzle: (puzzleDate) => dailyRuntime.getPublicPuzzle(puzzleDate),
  getCurrentDailyDate: getPacificDailyDateString,
});

export function submitDailyCompletedResult(submission: unknown) {
  return service.submit(submission);
}
