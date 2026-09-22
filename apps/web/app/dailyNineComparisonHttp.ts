import 'server-only';
import {
  DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
  type DailyNineComparisonApiErrorResponse,
  type DailyNineComparisonApiSuccess,
} from '@initial-baseball/shared';
import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from './dailyRuntimeService';
import { DailyNineComparisonRequestError } from './dailyNineComparisonReadService';
import { ServerSupabaseConfigurationError } from './serverSupabaseClient';
import { SupabaseDailyNineComparisonRepositoryError } from './supabaseDailyNineComparisonRepository';

export type DailyNineComparisonTimingKind = 'at-bat' | 'completed';

export function isDailyNineComparisonReadApiEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  const disabled = environment.DAILY_NINE_COMPARISON_READS_DISABLED;
  if (disabled === undefined) return true;
  return disabled.trim() === 'false';
}

export function dailyNineComparisonPrivateJson(
  value: DailyNineComparisonApiSuccess | DailyNineComparisonApiErrorResponse,
  status = 200,
): NextResponse {
  const response = NextResponse.json(value, { status });
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export function withDailyNineComparisonTiming(
  response: NextResponse,
  startedAt: number,
  kind: DailyNineComparisonTimingKind,
): NextResponse {
  const metric = kind === 'at-bat'
    ? 'daily-comparison-at-bat'
    : 'daily-comparison-completed';
  response.headers.set(
    'server-timing',
    `${metric};dur=${Math.max(0, Date.now() - startedAt)}`,
  );
  return response;
}

export function dailyNineComparisonDisabledResponse(): NextResponse {
  return errorResponse('comparison_unavailable', 404);
}

export function mapDailyNineComparisonRouteError(error: unknown): NextResponse {
  if (error instanceof DailyNineComparisonRequestError) {
    return errorResponse(error.code, error.code === 'invalid_puzzle' ? 404 : 400);
  }

  if (error instanceof DailyRuntimeRequestError) {
    return errorResponse('invalid_puzzle', 404);
  }

  if (
    error instanceof ServerSupabaseConfigurationError
    || error instanceof SupabaseDailyNineComparisonRepositoryError
  ) {
    return errorResponse('comparison_unavailable', 503);
  }

  return errorResponse('comparison_unavailable', 500);
}

function errorResponse(
  error: DailyNineComparisonApiErrorResponse['error'],
  status: number,
): NextResponse {
  return dailyNineComparisonPrivateJson({
    schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
    error,
  }, status);
}
