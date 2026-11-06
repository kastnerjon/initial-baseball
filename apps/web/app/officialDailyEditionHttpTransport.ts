import { isOfficialDailyOccurrenceId, validateIssuedDailyCalendarDate } from '@initial-baseball/daily';
import { POINTS_V4_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { postDailyGameplayJson } from './dailyGameplayRequestController';
import type {
  DailyBootstrap,
  DailyHintBundle,
  DailyHintBundleResponse,
  DailyResolutionRequest,
  DailyResolutionResponse,
} from './dailyRuntimeContracts';

type PostJson = (path: string, body: Record<string, unknown>) => Promise<unknown>;
type GetJson = (path: string) => Promise<unknown>;

const EDITION_PREFIX = 'daily-ed-v1-';

function incompatible(): never {
  throw new Error('Official Daily edition response is incompatible.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

function validateOnDemandBundle(value: unknown): value is DailyHintBundle {
  if (!isRecord(value)
      || !hasKeys(value, ['pitchNumber', 'revealedCount', 'hints', 'checkpoints'])
      || !Number.isSafeInteger(value.pitchNumber) || (value.pitchNumber as number) < 1
      || !Number.isInteger(value.revealedCount)
      || (value.revealedCount as number) < 0 || (value.revealedCount as number) > 4
      || !Array.isArray(value.hints) || value.hints.length !== value.revealedCount
      || !Array.isArray(value.checkpoints) || value.checkpoints.length !== 0) {
    return false;
  }
  return value.hints.every((hint, index) =>
    isRecord(hint) && hasKeys(hint, ['slot', 'hintType', 'hintLabel', 'hintValue'])
    && hint.slot === index + 1
    && typeof hint.hintType === 'string'
    && typeof hint.hintLabel === 'string'
    && typeof hint.hintValue === 'string');
}

function validateBootstrap(value: unknown, puzzleId: string, date: string): DailyBootstrap {
  if (!isRecord(value)
      || !hasKeys(value, ['rulesetVersion', 'puzzle', 'progressionToken', 'hintBundle'])
      || value.rulesetVersion !== POINTS_V4_DAILY_RULESET_VERSION
      || typeof value.progressionToken !== 'string'
      || value.progressionToken.length === 0 || value.progressionToken.length > 4096
      || !isRecord(value.puzzle)
      || !hasKeys(value.puzzle, ['id', 'puzzleNumber', 'puzzleDate', 'status', 'hintConfig', 'statsHintConfig', 'pitches'])
      || value.puzzle.id !== puzzleId || value.puzzle.puzzleDate !== date
      || !Array.isArray(value.puzzle.pitches) || value.puzzle.pitches.length !== 9
      || !value.puzzle.pitches.every((pitch: unknown, index: number) =>
        isRecord(pitch) && hasKeys(pitch, ['pitchNumber', 'initials'])
          && pitch.pitchNumber === index + 1 && typeof pitch.initials === 'string')
      || !validateOnDemandBundle(value.hintBundle)
      || value.hintBundle.pitchNumber !== 1 || value.hintBundle.revealedCount !== 0) {
    incompatible();
  }
  return value as DailyBootstrap;
}

function validProgressionToken(value: string): void {
  if (typeof value !== 'string' || value.length < 1 || value.length > 4096) incompatible();
}

async function defaultGetJson(path: string): Promise<unknown> {
  const response = await fetch(path, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Official Daily edition request failed.');
  return response.json();
}

/**
 * Source-only browser transport for one immutable official Daily occurrence.
 * A dedicated instance is bound to the exact ID and never falls back to
 * /api/daily endpoints. No competitive score submission is provided here.
 */
export function createOfficialDailyEditionHttpTransport(
  puzzleId: string,
  getJson: GetJson = defaultGetJson,
  postJson: PostJson = (path, body) => postDailyGameplayJson<unknown>(path, body),
) {
  if (typeof puzzleId !== 'string' || !puzzleId.startsWith(EDITION_PREFIX)
      || !isOfficialDailyOccurrenceId(puzzleId.slice(EDITION_PREFIX.length))) {
    incompatible();
  }
  const path = `/api/daily/editions/${puzzleId}/`;
  const post = (action: 'hint' | 'hints' | 'resolve', body: Record<string, unknown>) =>
    postJson(path + action, body);

  return {
    async bootstrap(date: string): Promise<DailyBootstrap> {
      try { validateIssuedDailyCalendarDate(date); } catch { incompatible(); }
      const value = await getJson(path + 'bootstrap?date=' + encodeURIComponent(date));
      return validateBootstrap(value, puzzleId, date);
    },
    async hint(progressionToken: string): Promise<unknown> {
      validProgressionToken(progressionToken);
      return post('hint', { progressionToken });
    },
    async hints(progressionToken: string): Promise<DailyHintBundleResponse> {
      validProgressionToken(progressionToken);
      const value = await post('hints', { progressionToken });
      if (!isRecord(value) || !hasKeys(value, ['hintBundle'])
          || !validateOnDemandBundle(value.hintBundle)) incompatible();
      return value as DailyHintBundleResponse;
    },
    async resolve(request: DailyResolutionRequest): Promise<DailyResolutionResponse> {
      validProgressionToken(request.progressionToken);
      const body = request.giveUp === true
        ? { progressionToken: request.progressionToken, giveUp: true }
        : { progressionToken: request.progressionToken, submittedPlayerId: request.submittedPlayerId };
      if (body.giveUp !== true
          && (typeof body.submittedPlayerId !== 'string'
            || body.submittedPlayerId.length === 0 || body.submittedPlayerId.length > 100)) {
        incompatible();
      }
      const value = await post('resolve', body);
      if (!isRecord(value) || !hasKeys(value, ['result', 'reveal', 'progressionToken', 'hintBundle'])
          || typeof value.progressionToken !== 'string'
          || value.progressionToken.length === 0 || value.progressionToken.length > 4096
          || (value.hintBundle !== null && !validateOnDemandBundle(value.hintBundle))) {
        incompatible();
      }
      return value as DailyResolutionResponse;
    },
  };
}
