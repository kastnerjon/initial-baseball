'use client';

import {
  DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyNineAtBatComparisonApiResponse,
  type DailyNineComparisonApiErrorCode,
  type DailyNineComparisonApiFreshness,
  type DailyNineComparisonApiKey,
  type DailyNineCompletedComparisonApiResponse,
} from '@initial-baseball/shared';

export type DailyNineAtBatComparisonRequestKey = DailyNineComparisonApiKey & {
  kind: 'at-bat';
  pitchNumber: number;
};

export type DailyNineCompletedComparisonRequestKey = DailyNineComparisonApiKey & {
  kind: 'completed';
};

type ComparisonHttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type ComparisonRequest = (
  input: string,
  init: { method: 'GET'; cache: 'no-store'; signal: AbortSignal },
) => Promise<ComparisonHttpResponse>;

export type DailyNineComparisonClientErrorKind =
  | 'http'
  | 'invalid_response'
  | 'identity_mismatch';

export class DailyNineComparisonClientError extends Error {
  constructor(
    public readonly kind: DailyNineComparisonClientErrorKind,
    message: string,
    public readonly status: number | null = null,
    public readonly code: DailyNineComparisonApiErrorCode | null = null,
  ) {
    super(message);
    this.name = 'DailyNineComparisonClientError';
  }
}

export function createBrowserDailyNineComparisonClient() {
  return createDailyNineComparisonClient({ request: (input, init) => fetch(input, init) });
}

export function createDailyNineComparisonClient({ request }: { request: ComparisonRequest }) {
  return {
    async readAtBat(
      key: DailyNineAtBatComparisonRequestKey,
      signal: AbortSignal,
    ): Promise<DailyNineAtBatComparisonApiResponse> {
      const response = await request(atBatPath(key), requestInit(signal));
      if (!response.ok) throwHttpError(response.status, await readOptionalPayload(response));
      const decoded = decodeAtBatResponse(await readPayload(response));
      if (!sameBaseIdentity(key, decoded.comparison)
        || key.pitchNumber !== decoded.comparison.pitchNumber) identityMismatch();
      return decoded;
    },

    async readCompleted(
      key: DailyNineCompletedComparisonRequestKey,
      signal: AbortSignal,
    ): Promise<DailyNineCompletedComparisonApiResponse> {
      const response = await request(completedPath(key), requestInit(signal));
      if (!response.ok) throwHttpError(response.status, await readOptionalPayload(response));
      const decoded = decodeCompletedResponse(await readPayload(response));
      if (!sameBaseIdentity(key, decoded.comparison)) identityMismatch();
      return decoded;
    },
  };
}

function requestInit(signal: AbortSignal) {
  return { method: 'GET' as const, cache: 'no-store' as const, signal };
}

function atBatPath(key: DailyNineAtBatComparisonRequestKey): string {
  return `/api/daily/comparison/at-bat?${new URLSearchParams({
    date: key.puzzleDate,
    ruleset: key.rulesetVersion,
    pitch: String(key.pitchNumber),
  })}`;
}

function completedPath(key: DailyNineCompletedComparisonRequestKey): string {
  return `/api/daily/comparison/completed?${new URLSearchParams({
    date: key.puzzleDate,
    ruleset: key.rulesetVersion,
  })}`;
}

async function readPayload(response: ComparisonHttpResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    invalidResponse('Daily Nine comparison response is not valid JSON.');
  }
}

async function readOptionalPayload(response: ComparisonHttpResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function decodeAtBatResponse(value: unknown): DailyNineAtBatComparisonApiResponse {
  const { comparison, freshness } = decodeEnvelope(value, 'at-bat');
  return {
    schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
    kind: 'at-bat',
    comparison: {
      ...decodeBaseKey(comparison),
      pitchNumber: positiveSafeInteger(comparison.pitchNumber, 'pitchNumber'),
      resolvedAtBatCount: nonNegativeSafeInteger(
        comparison.resolvedAtBatCount,
        'resolvedAtBatCount',
      ),
      averagePoints: nullableNonNegativeFiniteNumber(comparison.averagePoints, 'averagePoints'),
    },
    freshness,
  };
}

function decodeCompletedResponse(value: unknown): DailyNineCompletedComparisonApiResponse {
  const { comparison, freshness } = decodeEnvelope(value, 'completed');
  if (!Array.isArray(comparison.scoreHistogram)) {
    invalidResponse('Daily Nine comparison scoreHistogram must be an array.');
  }
  return {
    schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
    kind: 'completed',
    comparison: {
      ...decodeBaseKey(comparison),
      completedGameCount: nonNegativeSafeInteger(
        comparison.completedGameCount,
        'completedGameCount',
      ),
      averageTotalPoints: nullableNonNegativeFiniteNumber(
        comparison.averageTotalPoints,
        'averageTotalPoints',
      ),
      scoreHistogram: comparison.scoreHistogram.map((count, index) =>
        nonNegativeSafeInteger(count, `scoreHistogram[${index}]`)),
    },
    freshness,
  };
}

function decodeEnvelope(value: unknown, kind: 'at-bat' | 'completed') {
  const record = object(value, 'response');
  if (record.schemaVersion !== DAILY_NINE_COMPARISON_API_SCHEMA_VERSION) {
    invalidResponse('Daily Nine comparison response has an unsupported schema version.');
  }
  if (record.kind !== kind) {
    invalidResponse(`Daily Nine comparison response kind must be ${kind}.`);
  }
  return {
    comparison: object(record.comparison, 'comparison'),
    freshness: decodeFreshness(record.freshness),
  };
}

function decodeBaseKey(value: Record<string, unknown>): DailyNineComparisonApiKey {
  return {
    puzzleId: nonEmptyString(value.puzzleId, 'puzzleId'),
    puzzleDate: nonEmptyString(value.puzzleDate, 'puzzleDate'),
    puzzleNumber: positiveSafeInteger(value.puzzleNumber, 'puzzleNumber'),
    rulesetVersion: requirePointsV3(value.rulesetVersion),
  };
}

function decodeFreshness(value: unknown): DailyNineComparisonApiFreshness {
  const record = object(value, 'freshness');
  const sourceReadAt = nonEmptyString(record.sourceReadAt, 'freshness.sourceReadAt');
  if (!Number.isFinite(Date.parse(sourceReadAt))) {
    invalidResponse('Daily Nine comparison freshness.sourceReadAt must be a timestamp.');
  }
  if (record.cacheStatus !== 'live' && record.cacheStatus !== 'cached') {
    invalidResponse('Daily Nine comparison freshness.cacheStatus is invalid.');
  }
  return { sourceReadAt, cacheStatus: record.cacheStatus };
}

function sameBaseIdentity(
  expected: DailyNineComparisonApiKey,
  actual: DailyNineComparisonApiKey,
): boolean {
  return expected.puzzleId === actual.puzzleId
    && expected.puzzleDate === actual.puzzleDate
    && expected.puzzleNumber === actual.puzzleNumber
    && expected.rulesetVersion === actual.rulesetVersion;
}

function throwHttpError(status: number, payload: unknown): never {
  throw new DailyNineComparisonClientError(
    'http',
    `Daily Nine comparison request failed with ${status}.`,
    status,
    decodeErrorCode(payload),
  );
}

function decodeErrorCode(value: unknown): DailyNineComparisonApiErrorCode | null {
  if (!isObject(value)
    || value.schemaVersion !== DAILY_NINE_COMPARISON_API_SCHEMA_VERSION) return null;
  return value.error === 'invalid_request'
    || value.error === 'invalid_puzzle'
    || value.error === 'unsupported_ruleset'
    || value.error === 'comparison_unavailable'
    ? value.error
    : null;
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!isObject(value)) invalidResponse(`Daily Nine comparison ${field} must be an object.`);
  return value;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    invalidResponse(`Daily Nine comparison ${field} must be a non-empty string.`);
  }
  return value;
}

function positiveSafeInteger(value: unknown, field: string): number {
  const parsed = nonNegativeSafeInteger(value, field);
  if (parsed === 0) invalidResponse(`Daily Nine comparison ${field} must be positive.`);
  return parsed;
}

function nonNegativeSafeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    invalidResponse(`Daily Nine comparison ${field} must be a non-negative safe integer.`);
  }
  return value as number;
}

function nullableNonNegativeFiniteNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    invalidResponse(`Daily Nine comparison ${field} must be null or a non-negative number.`);
  }
  return value;
}

function requirePointsV3(value: unknown): typeof POINTS_V3_DAILY_RULESET_VERSION {
  if (value !== POINTS_V3_DAILY_RULESET_VERSION) {
    invalidResponse('Daily Nine browser comparison requires points-v3.');
  }
  return POINTS_V3_DAILY_RULESET_VERSION;
}

function identityMismatch(): never {
  throw new DailyNineComparisonClientError(
    'identity_mismatch',
    'Daily Nine comparison response does not match the requested puzzle identity.',
  );
}

function invalidResponse(message: string): never {
  throw new DailyNineComparisonClientError('invalid_response', message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
