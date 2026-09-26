import {
  CLASSIC_DAILY_RULESET_VERSION,
  DAILY_COMPLETED_RESULT_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  type DailyCompletedResultError,
  type DailyCompletedResultRulesetVersion,
  type DailyPublicPuzzle,
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
  getCurrentDailyDate: () => string;
};

export function createDailyCompletedResultSubmissionService({
  repository,
  loadAuthoritativePuzzle,
  getCurrentDailyDate,
}: CreateDailyCompletedResultSubmissionServiceInput) {
  const resultService = createDailyCompletedResultService(repository);

  return {
    async submit(submission: unknown): Promise<DailyCompletedResultSubmissionOutcome> {
      const routing = readRoutingFields(submission, getCurrentDailyDate());
      if (!routing.ok) return routing;

      const puzzle = await loadAuthoritativePuzzle(
        routing.puzzleDate,
        routing.rulesetVersion,
      );
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
  currentDailyDate: string,
):
  | {
      ok: true;
      puzzleDate: string;
      rulesetVersion: DailyCompletedResultRulesetVersion;
    }
  | { ok: false; error: DailyCompletedResultError } {
  if (!isRecord(submission)) return reject('invalid_submission');
  if (submission.schemaVersion !== DAILY_COMPLETED_RESULT_SCHEMA_VERSION) {
    return reject('unsupported_schema');
  }

  const puzzleDate = readCalendarDate(submission.puzzleDate);
  if (puzzleDate === null) return reject('invalid_submission');
  if (puzzleDate > currentDailyDate) return reject('invalid_puzzle');

  if (submission.rulesetVersion !== POINTS_V3_DAILY_RULESET_VERSION
    && submission.rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION
    && submission.rulesetVersion !== CLASSIC_DAILY_RULESET_VERSION) {
    return reject('unsupported_ruleset');
  }

  return {
    ok: true,
    puzzleDate,
    rulesetVersion: submission.rulesetVersion,
  };
}

function readCalendarDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return value;
}

function reject(error: DailyCompletedResultError) {
  return { ok: false as const, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
