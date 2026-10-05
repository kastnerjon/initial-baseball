import 'server-only';
import { isDeepStrictEqual } from 'node:util';
import {
  createArchiveBetaDailyIssuedPuzzleReadService,
  resolveArchiveBetaDailyIdentityForDate,
  type ArchiveBetaDailyIssuedPuzzleReadService,
} from '@initial-baseball/daily';
import { ARCHIVE_BETA_EPOCH } from './archiveBetaActivation';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import {
  createServerArchiveBetaDailyIssuanceService,
  type ServerArchiveBetaDailyIssuanceService,
} from './serverArchiveBetaDailyIssuance';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository } from './supabasePermanentDailyIssuedPuzzleRepository';

export class ArchiveBetaActivationError extends Error {
  constructor(readonly kind: 'invalid-date' | 'immutable-conflict' | 'read-back-failed') {
    super(`Archive beta issuance failed: ${kind}.`);
    this.name = 'ArchiveBetaActivationError';
  }
}

type Dependencies = {
  now(): Date;
  createIssuance(): ServerArchiveBetaDailyIssuanceService;
  createReader(): ArchiveBetaDailyIssuedPuzzleReadService;
};

const DEFAULT_DEPENDENCIES: Dependencies = {
  now: () => new Date(),
  createIssuance: createServerArchiveBetaDailyIssuanceService,
  createReader: () => createArchiveBetaDailyIssuedPuzzleReadService(
    createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository(createServerSupabaseClient()),
  ),
};

/** Explicit operation only: no route render, scheduler, or publication trigger. */
export async function issueActivatedArchiveBetaDaily(
  puzzleDate: string,
  dependencies: Dependencies = DEFAULT_DEPENDENCIES,
) {
  const now = dependencies.now();
  let identity;
  try {
    identity = resolveArchiveBetaDailyIdentityForDate(puzzleDate, ARCHIVE_BETA_EPOCH);
  } catch {
    throw new ArchiveBetaActivationError('invalid-date');
  }
  if (identity === null || puzzleDate > getPacificDailyDateString(now)) {
    throw new ArchiveBetaActivationError('invalid-date');
  }

  const result = await dependencies.createIssuance().issue({
    identity,
    issuedAt: now.toISOString(),
  });
  if (!result.ok) throw new ArchiveBetaActivationError('immutable-conflict');

  const reader = dependencies.createReader();
  const [byDate, byNumber] = await Promise.all([
    reader.getByDate({ seriesVersion: identity.seriesVersion, puzzleDate }),
    reader.getByNumber({ seriesVersion: identity.seriesVersion, dailyNumber: identity.dailyNumber }),
  ]);
  if (!isDeepStrictEqual(byDate, result.puzzle) || !isDeepStrictEqual(byNumber, result.puzzle)) {
    throw new ArchiveBetaActivationError('read-back-failed');
  }

  return {
    status: result.status,
    puzzleDate: identity.puzzleDate,
    dailyNumber: identity.dailyNumber,
    issuedAt: result.puzzle.issuedAt,
  };
}
