import 'server-only';
import { isDeepStrictEqual } from 'node:util';
import {
  createArchiveBetaDailyIssuedPuzzleReadService,
  type ArchiveBetaDailyIdentity,
  type ArchiveBetaDailyIssuedPuzzleReadService,
} from '@initial-baseball/daily';
import { createServerArchiveBetaDailyIssuanceService, type ServerArchiveBetaDailyIssuanceService } from './serverArchiveBetaDailyIssuance';
import { createServerSupabaseClient } from './serverSupabaseClient';
import { createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository } from './supabasePermanentDailyIssuedPuzzleRepository';

export class ArchiveBetaActivationError extends Error {
  constructor(readonly kind: 'invalid-date' | 'immutable-conflict' | 'read-back-failed') {
    super(`Archive beta issuance failed: ${kind}.`);
    this.name = 'ArchiveBetaActivationError';
  }
}

export type ArchiveBetaVerificationDependencies = {
  createIssuance(): ServerArchiveBetaDailyIssuanceService;
  createReader(): ArchiveBetaDailyIssuedPuzzleReadService;
};

const DEFAULT_DEPENDENCIES: ArchiveBetaVerificationDependencies = {
  createIssuance: createServerArchiveBetaDailyIssuanceService,
  createReader: () => createArchiveBetaDailyIssuedPuzzleReadService(
    createSupabaseArchiveBetaDailyIssuedPuzzleReadRepository(createServerSupabaseClient()),
  ),
};

/** Both operational consumers require exact persisted content, not just a successful insert. */
export async function issueArchiveBetaDailyAndVerify(
  identity: ArchiveBetaDailyIdentity,
  issuedAt: string,
  dependencies: ArchiveBetaVerificationDependencies = DEFAULT_DEPENDENCIES,
) {
  const result = await dependencies.createIssuance().issue({
    identity,
    issuedAt,
  });
  if (!result.ok) throw new ArchiveBetaActivationError('immutable-conflict');

  const reader = dependencies.createReader();
  const [byDate, byNumber] = await Promise.all([
    reader.getByDate({ seriesVersion: identity.seriesVersion, puzzleDate: identity.puzzleDate }),
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
