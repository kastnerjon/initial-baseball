import 'server-only';
import type {
  DailyAtBatResultKey,
  DailyAtBatResultRepository,
  DailyAtBatResultRepositoryInsertResult,
} from '@initial-baseball/daily';
import type { DailyAtBatResult } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseDailyAtBatResultRepositoryError,
  decodeDailyAtBatResultRow,
  encodeDailyAtBatResultRow,
} from './supabaseDailyAtBatResultRowCodec';

const DAILY_AT_BAT_RESULTS_TABLE = 'daily_at_bat_results';
const DAILY_AT_BAT_RESULT_COLUMNS = [
  'attempt_id',
  'schema_version',
  'puzzle_id',
  'puzzle_date',
  'puzzle_number',
  'ruleset_version',
  'pitch_number',
  'initials',
  'outcome',
  'hints_revealed',
  'wrong_guesses',
  'resolution',
  'awarded_points',
].join(',');

export {
  SupabaseDailyAtBatResultRepositoryError,
  type SupabaseDailyAtBatResultRepositoryErrorKind,
} from './supabaseDailyAtBatResultRowCodec';

export function createSupabaseDailyAtBatResultRepository(
  client: SupabaseClient,
): DailyAtBatResultRepository {
  return {
    async insertIfAbsent(result) {
      const inserted = await tryInsert(client, result);
      if (inserted !== null) return inserted;
      return readExisting(client, {
        attemptId: result.attemptId,
        puzzleId: result.puzzleId,
        rulesetVersion: result.rulesetVersion,
        pitchNumber: result.atBat.pitchNumber,
      });
    },
  };
}

async function tryInsert(
  client: SupabaseClient,
  result: DailyAtBatResult,
): Promise<DailyAtBatResultRepositoryInsertResult | null> {
  const { data, error } = await client
    .from(DAILY_AT_BAT_RESULTS_TABLE)
    .insert(encodeDailyAtBatResultRow(result))
    .select(DAILY_AT_BAT_RESULT_COLUMNS)
    .single();

  if (error === null) {
    return { status: 'inserted', result: decodeDailyAtBatResultRow(data) };
  }
  if (error.code === '23505') return null;
  throwQueryError('insert resolved Daily at-bat result', error);
}

async function readExisting(
  client: SupabaseClient,
  key: DailyAtBatResultKey,
): Promise<DailyAtBatResultRepositoryInsertResult> {
  const { data, error } = await client
    .from(DAILY_AT_BAT_RESULTS_TABLE)
    .select(DAILY_AT_BAT_RESULT_COLUMNS)
    .eq('attempt_id', key.attemptId)
    .eq('puzzle_id', key.puzzleId)
    .eq('ruleset_version', key.rulesetVersion)
    .eq('pitch_number', key.pitchNumber)
    .maybeSingle();

  if (error !== null) throwQueryError('read existing resolved Daily at-bat result', error);
  if (data === null) {
    throw new SupabaseDailyAtBatResultRepositoryError(
      'query',
      `Resolved Daily at-bat result ${formatKey(key)} conflicted but could not be read.`,
    );
  }
  return { status: 'existing', result: decodeDailyAtBatResultRow(data) };
}

function formatKey(key: DailyAtBatResultKey): string {
  return `${key.attemptId}/${key.puzzleId}/${key.rulesetVersion}/${key.pitchNumber}`;
}

function throwQueryError(operation: string, error: { message: string }): never {
  throw new SupabaseDailyAtBatResultRepositoryError(
    'query',
    `Could not ${operation}: ${error.message}`,
  );
}
