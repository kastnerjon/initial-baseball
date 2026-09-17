import type {
  DailyCompletedResultError,
  DailyCompletedResultRulesetVersion,
  DailyPublicPuzzle,
} from '@initial-baseball/shared';
import {
  CLASSIC_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
} from '@initial-baseball/shared';
import { validateDailyCompletedResult } from '@initial-baseball/engine';
import {
  createDailyCompletedResultService,
  type DailyCompletedResultRepository,
} from '@initial-baseball/daily';

export type DailyCompletedResultSubmissionOutcome =
  | { ok: true; status: 'created' | 'existing' }
  | { ok: false; error: DailyCompletedResultError | 'idempotency_conflict' };

type LoadAuthoritativePuzzle = (
  puzzleDate: string,
  rulesetVersion: DailyCompletedResultRulesetVersion,
) => Promise<DailyPublicPuzzle>;

type CreateDailyCompletedResultSubmissionServiceInput = {
  repository: DailyCompletedResultRepository;
  loadAuthoritativePuzzle: LoadAuthoritativePuzzle;
};

export function createDailyCompletedResultSubmissionService({
  repository,
  loadAuthoritativePuzzle,
}: CreateDailyCompletedResultSubmissionServiceInput) {
  const resultService = createDailyCompletedResultService(repository);

  return {
    async submit(submission: unknown): Promise<DailyCompletedResultSubmissionOutcome> {
      const routing = readRoutingFields(submission);
      if (!routing.ok) return routing;

      const puzzle = await loadAuthoritativePuzzle(routing.puzzleDate, routing.rulesetVersion);
      const validation = validateDailyCompletedResult({
        submission,
        puzzle,
        rulesetVersion: routing.rulesetVersion,
      });
      if (!validation.ok) return validation;

      const stored = await resultService.store(validation.result);
      return stored.ok
        ? { ok: true, status: stored.status }
        : { ok: false, error: stored.error };
    },
  };
}

function readRoutingFields(
  submission: unknown,
):
  | {
      ok: true;
      puzzleDate: string;
      rulesetVersion: DailyCompletedResultRulesetVersion;
    }
  | { ok: false; error: DailyCompletedResultError } {
  if (!isRecord(submission)) return { ok: false, error: 'invalid_submission' };

  if (typeof submission.puzzleDate !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(submission.puzzleDate)) {
    return { ok: false, error: 'invalid_submission' };
  }

  if (submission.rulesetVersion !== POINTS_V3_DAILY_RULESET_VERSION
    && submission.rulesetVersion !== CLASSIC_DAILY_RULESET_VERSION) {
    return { ok: false, error: 'unsupported_ruleset' };
  }

  return {
    ok: true,
    puzzleDate: submission.puzzleDate,
    rulesetVersion: submission.rulesetVersion,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
