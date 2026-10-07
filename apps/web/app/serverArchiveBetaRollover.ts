import 'server-only';
import {
  publishDailyPuzzle,
  resolveArchiveBetaDailyIdentityForDate,
  resolveArchiveBetaDailyIdentityForNumber,
  type ArchiveBetaDailyIdentity,
  type DailyPuzzleRepository,
} from '@initial-baseball/daily';
import { ARCHIVE_BETA_EPOCH } from './archiveBetaActivation';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import { ArchiveBetaActivationError, issueArchiveBetaDailyAndVerify } from './serverArchiveBetaDailyVerification';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseDailyPuzzleRepository } from './supabaseDailyPuzzleRepository';
import { listIssuedArchiveBetaIdentities } from './serverArchiveBetaIssuedIdentities';

export type ArchiveBetaRolloverDependencies = {
  repository: DailyPuzzleRepository;
  listIssuedIdentities(cutoffDate: string): Promise<readonly ArchiveBetaDailyIdentity[]>;
  issueAndVerify: typeof issueArchiveBetaDailyAndVerify;
};

function createDependencies(): ArchiveBetaRolloverDependencies {
  const client = createServerSupabaseClient();
  return {
    repository: createSupabaseDailyPuzzleRepository(client),
    listIssuedIdentities: cutoff => listIssuedArchiveBetaIdentities(client, cutoff),
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
  const { repository, listIssuedIdentities, issueAndVerify } = dependencies ?? createDependencies();
  const issuedIdentities = await listIssuedIdentities(today);
  const issuedDates = new Set<string>();
  for (const identity of issuedIdentities) {
    const expected = resolveArchiveBetaDailyIdentityForDate(identity.puzzleDate, ARCHIVE_BETA_EPOCH);
    if (expected === null || identity.seriesVersion !== expected.seriesVersion
      || identity.dailyNumber !== expected.dailyNumber || identity.puzzleDate >= today) throw new Error('Invalid issued archive identity.');
    issuedDates.add(identity.puzzleDate);
  }
  const last = resolveArchiveBetaDailyIdentityForNumber(current.dailyNumber - 1, ARCHIVE_BETA_EPOCH);
  const records = await repository.listByDateRange(ARCHIVE_BETA_EPOCH.startDate, last.puzzleDate);
  const byDate = new Map(records.map(record => [record.puzzleDate, record]));
  let attempted = 0;
  for (let number = 1; number < current.dailyNumber; number++) {
    const identity = resolveArchiveBetaDailyIdentityForNumber(number, ARCHIVE_BETA_EPOCH);
    try {
      if (issuedDates.has(identity.puzzleDate)) {
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
