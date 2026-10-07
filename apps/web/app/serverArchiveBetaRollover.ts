import 'server-only';
import {
  createArchiveBetaDailyIssuedPuzzleReadService,
  publishDailyPuzzle,
  resolveArchiveBetaDailyIdentityForDate,
  resolveArchiveBetaDailyIdentityForNumber,
  type ArchiveBetaDailyIssuedPuzzleReadService,
  type DailyPuzzleRepository,
} from '@initial-baseball/daily';
import { ARCHIVE_BETA_EPOCH } from './archiveBetaActivation';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { ArchiveBetaActivationError, issueArchiveBetaDailyAndVerify } from './serverArchiveBetaDailyVerification';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyPuzzleRepository } from './supabaseDailyPuzzleRepository';
import { createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository } from './supabasePermanentDailyIssuedPuzzleRepository';

export type ArchiveBetaRolloverDependencies = {
  repository: DailyPuzzleRepository;
  reader: ArchiveBetaDailyIssuedPuzzleReadService;
  issueAndVerify: typeof issueArchiveBetaDailyAndVerify;
};

function createDependencies(): ArchiveBetaRolloverDependencies {
  const client = createServerSupabaseClient();
  return {
    repository: createSupabaseDailyPuzzleRepository(client),
    reader: createArchiveBetaDailyIssuedPuzzleReadService(createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository(client)),
    issueAndVerify: issueArchiveBetaDailyAndVerify,
  };
}

/** The source remains published so delayed original-Daily deliveries stay valid. */
export async function runArchiveBetaRollover(
  now = new Date(),
  dependencies?: ArchiveBetaRolloverDependencies,
) {
  const today = getPacificDailyDateString(now);
  const current = resolveArchiveBetaDailyIdentityForDate(today, ARCHIVE_BETA_EPOCH);
  const result = {
    cutoffDate: today, created: 0, preserved: 0, remaining: 0,
    failures: [] as Array<{ puzzleDate: string; kind: 'missing-source' | 'immutable-conflict' | 'unavailable' }>,
  };
  if (current === null || current.dailyNumber === 1) return result;
  const { repository, reader, issueAndVerify } = dependencies ?? createDependencies();
  const last = resolveArchiveBetaDailyIdentityForNumber(current.dailyNumber - 1, ARCHIVE_BETA_EPOCH);
  const records = await repository.listByDateRange(ARCHIVE_BETA_EPOCH.startDate, last.puzzleDate);
  const byDate = new Map(records.map(record => [record.puzzleDate, record]));
  let attempted = 0;
  for (let number = 1; number < current.dailyNumber; number++) {
    const identity = resolveArchiveBetaDailyIdentityForNumber(number, ARCHIVE_BETA_EPOCH);
    try {
      const existing = await reader.getByDate({ seriesVersion: identity.seriesVersion, puzzleDate: identity.puzzleDate });
      if (existing !== null) {
        if (existing.identity.dailyNumber !== number || existing.puzzleId !== `archive-beta-v1-daily-${number}`) throw new Error('Invalid issued identity.');
        result.preserved++;
        continue;
      }
      const record = byDate.get(identity.puzzleDate);
      if (record === undefined || (record.status !== 'scheduled' && record.status !== 'published')) {
        result.failures.push({ puzzleDate: identity.puzzleDate, kind: 'missing-source' });
        continue;
      }
      // Bound expensive issuance; preserved rows and failed source gaps cannot starve newer dates.
      if (attempted >= 30) { result.remaining++; continue; }
      attempted++;
      if (record.status === 'scheduled') {
        await repository.save(publishDailyPuzzle(record, {
          actorId: 'system:archive-rollover', occurredAt: now.toISOString(),
        }), { expectedRevision: record.revision });
      }
      const issued = await issueAndVerify(identity, now.toISOString());
      if (issued.status === 'created') result.created++;
      else result.preserved++;
    } catch (error) {
      result.failures.push({ puzzleDate: identity.puzzleDate,
        kind: error instanceof ArchiveBetaActivationError && error.kind === 'immutable-conflict'
          ? 'immutable-conflict' : 'unavailable' });
    }
  }
  return result;
}
