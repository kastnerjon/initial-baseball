import { DAILY_NINE_COMPARISON_API_SCHEMA_VERSION } from '@initial-baseball/shared';
import { NextResponse } from 'next/server';
import { DailyNineComparisonRequestError } from './dailyNineComparisonReadService';
import { DailyRuntimeRequestError } from './dailyRuntimeService';
import { ServerSupabaseConfigurationError } from './serverSupabaseClient';
import { SupabaseDailyNineComparisonRepositoryError } from './supabaseDailyNineComparisonRepository';

export function isDailyNineComparisonReadEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment.DAILY_NINE_COMPARISON_READS_ENABLED?.trim().toLowerCase() === 'true';
}

export function dailyNineComparisonDisabledResponse(): NextResponse {
  return errorResponse('comparison_unavailable', 404);
}

export function dailyNineComparisonNoStoreJson(value: unknown, status = 200): NextResponse {
  const response = NextResponse.json(value, { status });
  response.headers.set('cache-control', 'no-store');
  return response;
}

export function mapDailyNineComparisonRouteError(error: unknown): NextResponse {
  if (error instanceof DailyNineComparisonRequestError) {
    return errorResponse(error.code, 400);
  }
  if (error instanceof DailyRuntimeRequestError) {
    return errorResponse('comparison_unavailable', 503);
  }
  if (error instanceof ServerSupabaseConfigurationError
    || error instanceof SupabaseDailyNineComparisonRepositoryError) {
    return errorResponse('comparison_unavailable', 503);
  }
  return errorResponse('comparison_unavailable', 500);
}

function errorResponse(
  error: 'invalid_request' | 'invalid_puzzle' | 'unsupported_ruleset' | 'comparison_unavailable',
  status: number,
): NextResponse {
  return dailyNineComparisonNoStoreJson({
    schemaVersion: DAILY_NINE_COMPARISON_API_SCHEMA_VERSION,
    error,
  }, status);
}
