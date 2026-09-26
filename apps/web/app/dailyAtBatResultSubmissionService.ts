import { validateDailyAtBatResult } from '@initial-baseball/engine';
import {
  createDailyAtBatResultService,
  type DailyAtBatResultRepository,
} from '@initial-baseball/daily';
import {
  DAILY_AT_BAT_RESULT_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  type DailyAtBatResultError,
  type DailyAtBatResultRulesetVersion,
  type DailyPublicPuzzle,
} from '@initial-baseball/shared';

export type DailyAtBatResultSubmissionOutcome =
  | { ok: true; status: 'created' | 'existing' }
  | { ok: false; error: DailyAtBatResultError | 'idempotency_conflict' };

type LoadAuthoritativePuzzle = (
  puzzleDate: string,
  rulesetVersion: DailyAtBatResultRulesetVersion,
) => Promise<DailyPublicPuzzle>;

type CreateDailyAtBatResultSubmissionServiceInput = {
  repository: DailyAtBatResultRepository;
  loadAuthoritativePuzzle: LoadAuthoritativePuzzle;
  getCurrentDailyDate: () => string;
};

export function createDailyAtBatResultSubmissionService({
  repository,
  loadAuthoritativePuzzle,
  getCurrentDailyDate,
}: CreateDailyAtBatResultSubmissionServiceInput) {
  const resultService = createDailyAtBatResultService(repository);

  return {
    async submit(submission: unknown): Promise<DailyAtBatResultSubmissionOutcome> {
      const routing = readRoutingFields(submission, getCurrentDailyDate());
      if (!routing.ok) return routing;

      const puzzle = await loadAuthoritativePuzzle(
        routing.puzzleDate,
        routing.rulesetVersion,
      );
      const validation = validateDailyAtBatResult({
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
      rulesetVersion: DailyAtBatResultRulesetVersion;
    }
  | { ok: false; error: DailyAtBatResultError } {
  if (!isRecord(submission)) return reject('invalid_submission');
  if (submission.schemaVersion !== DAILY_AT_BAT_RESULT_SCHEMA_VERSION) {
    return reject('unsupported_schema');
  }

  const puzzleDate = readCalendarDate(submission.puzzleDate);
  if (puzzleDate === null) return reject('invalid_submission');
  if (puzzleDate > currentDailyDate) return reject('invalid_puzzle');
  if (submission.rulesetVersion !== POINTS_V3_DAILY_RULESET_VERSION
    && submission.rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION) {
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

function reject(error: DailyAtBatResultError) {
  return { ok: false as const, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
