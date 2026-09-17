import 'server-only';
import type { DailyCompletedResultRepository } from '@initial-baseball/daily';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyCompletedResultRepository } from './supabaseDailyCompletedResultRepository';
import { dailyRuntime } from './serverCanonicalRuntime';
import { createDailyCompletedResultSubmissionService } from './dailyCompletedResultSubmissionService';

const lazyRepository: DailyCompletedResultRepository = {
  async insertIfAbsent(result) {
    const repository = createSupabaseDailyCompletedResultRepository(createServerSupabaseClient());
    return repository.insertIfAbsent(result);
  },
};

const service = createDailyCompletedResultSubmissionService({
  repository: lazyRepository,
  async loadAuthoritativePuzzle(puzzleDate, rulesetVersion) {
    const bootstrap = await dailyRuntime.getBootstrap(puzzleDate, rulesetVersion);
    return bootstrap.puzzle;
  },
});

export async function submitDailyCompletedResult(submission: unknown) {
  return service.submit(submission);
}
