import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DailyNineLeaderboardRepository,
  DailyNineLeaderboardRow,
  StoredLeaderboardCompletion,
} from './dailyNineLeaderboardService';

export class DailyNineLeaderboardRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyNineLeaderboardRepositoryError';
  }
}

export function createSupabaseDailyNineLeaderboardRepository(client: SupabaseClient): DailyNineLeaderboardRepository {
  return {
    async findCompletion(submissionId) {
      const { data, error } = await client.from('daily_completed_results')
        .select('submission_id,puzzle_id,puzzle_date,puzzle_number,ruleset_version')
        .eq('submission_id', submissionId).maybeSingle();
      if (error) fail('read completion', error);
      if (data === null) return null;
      if (data.submission_id !== submissionId || typeof data.puzzle_id !== 'string'
        || typeof data.puzzle_date !== 'string' || !Number.isSafeInteger(data.puzzle_number)
        || data.ruleset_version !== 'points-v4') return null;
      return {
        submissionId: data.submission_id, puzzleId: data.puzzle_id, puzzleDate: data.puzzle_date,
        puzzleNumber: data.puzzle_number, rulesetVersion: 'points-v4',
      } satisfies StoredLeaderboardCompletion;
    },
    async insertName(submissionId, displayName) {
      const { error } = await client.from('daily_nine_leaderboard_entries')
        .insert({ submission_id: submissionId, display_name: displayName });
      if (error === null) return 'created';
      if (error.code !== '23505') fail('insert leaderboard name', error);
      const existing = await client.from('daily_nine_leaderboard_entries')
        .select('display_name').eq('submission_id', submissionId).maybeSingle();
      if (existing.error) fail('read existing leaderboard name', existing.error);
      if (existing.data === null) fail('resolve competing leaderboard insert', { message: 'Missing conflicting row.' });
      return existing.data.display_name === displayName ? 'existing' : 'conflict';
    },
    async read(identity, ownSubmissionId) {
      const { data, error } = await client.rpc('daily_nine_leaderboard_v1', {
        p_puzzle_id: identity.puzzleId,
        p_puzzle_date: identity.puzzleDate,
        p_puzzle_number: identity.puzzleNumber,
        p_ruleset_version: identity.rulesetVersion,
        p_own_submission_id: ownSubmissionId,
      });
      if (error) fail('read leaderboard', error);
      if (!Array.isArray(data)) invalid('Leaderboard rows must be an array.');
      return data.map((candidate: unknown): DailyNineLeaderboardRow => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) invalid('Invalid leaderboard row.');
        const row = candidate as Record<string, unknown>;
        const points = readNumber(row.points);
        const rank = readInteger(row.rank_number);
        const total = readInteger(row.total_entries);
        if (typeof row.display_name !== 'string' || row.display_name.length < 1
          || row.display_name.length > 32 || !Number.isFinite(points)
          || points < 0 || points > 36 || !Number.isSafeInteger(points * 2)
          || rank < 1 || total < rank || typeof row.is_own_entry !== 'boolean') invalid('Invalid leaderboard row.');
        return {
          displayName: row.display_name, points, rank,
          isOwnEntry: row.is_own_entry, totalEntries: total,
        };
      });
    },
  };
}

function readNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return Number.NaN;
}

function readInteger(value: unknown): number {
  const number = readNumber(value);
  return Number.isSafeInteger(number) ? number : -1;
}

function fail(operation: string, error: { message: string }): never {
  throw new DailyNineLeaderboardRepositoryError('Unable to ' + operation + ': ' + error.message);
}
function invalid(message: string): never { throw new DailyNineLeaderboardRepositoryError(message); }
