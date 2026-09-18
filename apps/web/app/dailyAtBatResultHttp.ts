import { NextResponse } from 'next/server';
import { DailyRuntimeRequestError } from './dailyRuntimeService';
import { ServerSupabaseConfigurationError } from './serverSupabaseClient';
import { SupabaseDailyAtBatResultRepositoryError } from './supabaseDailyAtBatResultRepository';

export function atBatResultPrivateJson(value: unknown, status: number): NextResponse {
  const response = NextResponse.json(value, { status });
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export function mapAtBatResultRouteError(error: unknown): NextResponse {
  if (error instanceof DailyRuntimeRequestError) {
    return atBatResultPrivateJson({ error: 'invalid_puzzle' }, 400);
  }
  if (error instanceof ServerSupabaseConfigurationError
    || error instanceof SupabaseDailyAtBatResultRepositoryError) {
    return atBatResultPrivateJson({ error: 'at_bat_result_unavailable' }, 503);
  }
  return atBatResultPrivateJson({ error: 'at_bat_result_unavailable' }, 500);
}
