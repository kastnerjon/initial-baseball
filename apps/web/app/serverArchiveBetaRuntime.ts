import 'server-only';
import {
  createArchiveBetaDailyIssuedPuzzleReadService,
  resolveArchiveBetaDailyIdentityForDate,
  resolveArchiveBetaDailyIdentityForNumber,
  type ArchiveBetaDailyClueFrozenIssuedPuzzle,
  type ArchiveBetaDailyIssuedPuzzleReadService,
} from '@initial-baseball/daily';
import type { DailyPuzzle } from '@initial-baseball/shared';
import type { CanonicalPlayerReveal } from '@initial-baseball/baseball-data/runtime';
import { ARCHIVE_BETA_EPOCH } from './archiveBetaActivation';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { materializePermanentDailyIssuedPuzzle } from './permanentDailyPuzzleMaterialization';
import { createDailyProgressionTokenCodec, type DailyProgressionTokenCodec } from './dailyProgressionToken';
import { getDailyProgressionSecret } from './dailyProgressionSecret';
import { createDailyRuntimeService, DailyRuntimeRequestError } from './dailyRuntimeService';
import type { DailyRuntimeService } from './dailyRuntimeContracts';
import { getCanonicalRuntime, getCanonicalRevealReader } from './serverCanonicalData';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository } from './supabasePermanentDailyIssuedPuzzleRepository';

export function getAvailableArchiveBetaIdentity(number: number, now = new Date()) {
  try {
    const identity = resolveArchiveBetaDailyIdentityForNumber(number, ARCHIVE_BETA_EPOCH);
    return identity.puzzleDate < getPacificDailyDateString(now) ? identity : null;
  } catch { return null; }
}

export function createArchiveBetaReader(): ArchiveBetaDailyIssuedPuzzleReadService {
  return createArchiveBetaDailyIssuedPuzzleReadService(
    createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository(createServerSupabaseClient()),
  );
}

export function createServerArchiveBetaRuntime({
  reader,
  now = () => new Date(),
  progressionTokens = createDailyProgressionTokenCodec(getDailyProgressionSecret()),
  materialize = materializePermanentDailyIssuedPuzzle,
  resolveLegacyPlayerId = id => getCanonicalRuntime().requireCanonicalPlayerId(id),
  getCanonicalReveal = id => getCanonicalRevealReader().getReveal(id),
}: {
  reader?: ArchiveBetaDailyIssuedPuzzleReadService;
  now?: () => Date;
  progressionTokens?: DailyProgressionTokenCodec;
  materialize?: (record: ArchiveBetaDailyClueFrozenIssuedPuzzle) => DailyPuzzle;
  resolveLegacyPlayerId?: (id: string) => string;
  getCanonicalReveal?: (id: string) => CanonicalPlayerReveal;
} = {}): DailyRuntimeService {
  return createDailyRuntimeService({
    progressionTokens, resolveLegacyPlayerId, getCanonicalReveal,
    createPuzzle: async date => {
      if (date < ARCHIVE_BETA_EPOCH.startDate || date >= getPacificDailyDateString(now())) {
        throw new DailyRuntimeRequestError('This archive puzzle is not available.');
      }
      let record;
      try {
        record = await (reader ?? createArchiveBetaReader()).getByDate({ seriesVersion: 'archive-beta-v1', puzzleDate: date });
      } catch { throw new Error('The archive is temporarily unavailable.'); }
      if (record === null) throw new DailyRuntimeRequestError('This archive puzzle has not been issued.');
      const expected = resolveArchiveBetaDailyIdentityForDate(date, ARCHIVE_BETA_EPOCH);
      if (expected === null || record.identity.seriesVersion !== expected.seriesVersion
        || record.identity.puzzleDate !== expected.puzzleDate || record.identity.dailyNumber !== expected.dailyNumber
        || record.puzzleId !== `archive-beta-v1-daily-${expected.dailyNumber}`) {
        throw new Error('The archive puzzle could not be loaded safely.');
      }
      try { return materialize(record); }
      catch { throw new Error('The archive puzzle could not be loaded safely.'); }
    },
  });
}

/** Verify before dispatch; each runtime subsequently verifies exact signed puzzle identity. */
export function selectDailyProgressionRuntime(
  token: string,
  codec: DailyProgressionTokenCodec,
  current: DailyRuntimeService,
  archive: () => DailyRuntimeService,
): DailyRuntimeService {
  let claims;
  try { claims = codec.verify(token); }
  catch { throw new DailyRuntimeRequestError('Invalid Daily progression token.'); }
  return claims.puzzleId.startsWith('archive-beta-v1-daily-') ? archive() : current;
}

/** Metadata-only, bounded catalog. No answer or clue column is selected. */
export async function listAvailableArchiveBetaPuzzles(now = new Date()) {
  try {
    const { data, error } = await createServerSupabaseClient()
      .from('permanent_daily_issued_puzzles')
      .select('daily_number,puzzle_date,puzzle_id')
      .eq('series_version', 'archive-beta-v1').eq('schema_version', 2)
      .lt('puzzle_date', getPacificDailyDateString(now))
      .order('daily_number', { ascending: false }).limit(60);
    if (error) throw error;
    return (data ?? []).map(row => {
      const identity = getAvailableArchiveBetaIdentity(row.daily_number, now);
      if (identity === null || identity.puzzleDate !== row.puzzle_date
        || row.puzzle_id !== `archive-beta-v1-daily-${identity.dailyNumber}`) throw new Error('Invalid archive identity.');
      return identity;
    });
  } catch { throw new Error('The archive list is temporarily unavailable.'); }
}
