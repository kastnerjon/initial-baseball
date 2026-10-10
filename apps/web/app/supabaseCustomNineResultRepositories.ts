import 'server-only';
import type { DailyAtBatResultRepository, DailyAtBatResultRepositoryInsertResult, DailyAtBatResultKey, DailyCompletedResultRepository, DailyCompletedResultRepositoryInsertResult } from '@initial-baseball/daily';
import type { DailyAtBatResult, DailyCompletedResult } from '@initial-baseball/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decodeCustomNineAtBatRow, decodeCustomNineCompletedRow,
  encodeCustomNineAtBatRow, encodeCustomNineCompletedRow,
  SupabaseCustomNineResultError,
} from './customNineResultRowCodec';

const COMPLETED = 'custom_nine_completed_results';
const AT_BATS = 'custom_nine_at_bat_results';
const COMPLETED_COLUMNS = 'submission_id,challenge_id,schema_version,ruleset_version,completed_at_bats,summary';
const AT_BAT_COLUMNS = 'attempt_id,challenge_id,schema_version,ruleset_version,pitch_number,initials,outcome,hints_revealed,wrong_guesses,resolution,awarded_points';

/** Private provider ports; not wired to HTTP result submission or creator previews. */
export function createSupabaseCustomNineCompletedResultRepository(
  client: SupabaseClient,
): DailyCompletedResultRepository {
  return {
    async insertIfAbsent(result: DailyCompletedResult): Promise<DailyCompletedResultRepositoryInsertResult> {
      // Fail closed BEFORE any query for an alien challenge/date/ruleset or corrupt result.
      const row = encodeCustomNineCompletedRow(result);
      const { data, error } = await client.from(COMPLETED).insert(row)
        .select(COMPLETED_COLUMNS).single();
      if (error === null) return { status: 'inserted', result: decodeCustomNineCompletedRow(data) };
      if (error.code !== '23505') return providerError('insert Custom Nine completion');
      const winner = await client.from(COMPLETED).select(COMPLETED_COLUMNS)
        .eq('submission_id', result.submissionId).maybeSingle();
      if (winner.error !== null || winner.data === null) {
        return providerError('read existing Custom Nine completion');
      }
      return { status: 'existing', result: decodeCustomNineCompletedRow(winner.data) };
    },
  };
}

export function createSupabaseCustomNineAtBatResultRepository(
  client: SupabaseClient,
): DailyAtBatResultRepository {
  return {
    async insertIfAbsent(result: DailyAtBatResult): Promise<DailyAtBatResultRepositoryInsertResult> {
      const row = encodeCustomNineAtBatRow(result);
      const { data, error } = await client.from(AT_BATS).insert(row)
        .select(AT_BAT_COLUMNS).single();
      if (error === null) return { status: 'inserted', result: decodeCustomNineAtBatRow(data) };
      if (error.code !== '23505') return providerError('insert Custom Nine at-bat');
      const key: DailyAtBatResultKey = {
        attemptId: result.attemptId, puzzleId: result.puzzleId,
        rulesetVersion: result.rulesetVersion, pitchNumber: result.atBat.pitchNumber,
      };
      const winner = await client.from(AT_BATS).select(AT_BAT_COLUMNS)
        .eq('attempt_id', key.attemptId)
        .eq('challenge_id', key.puzzleId)
        .eq('ruleset_version', key.rulesetVersion)
        .eq('pitch_number', key.pitchNumber)
        .maybeSingle();
      if (winner.error !== null || winner.data === null) {
        return providerError('read existing Custom Nine at-bat');
      }
      return { status: 'existing', result: decodeCustomNineAtBatRow(winner.data) };
    },
  };
}

function providerError(operation: string): never {
  // Keep provider details out of the service-layer error (never expose DB internals).
  throw new SupabaseCustomNineResultError('query', `Could not ${operation}.`);
}
