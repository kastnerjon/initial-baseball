import 'server-only';
import { resolveArchiveBetaDailyIdentityForDate } from '@initial-baseball/daily';
import { ARCHIVE_BETA_EPOCH } from './archiveBetaActivation';
import { getPacificDailyDateString } from './getPacificDailyDateString';
import {
  ArchiveBetaActivationError,
  issueArchiveBetaDailyAndVerify,
  type ArchiveBetaVerificationDependencies,
} from './serverArchiveBetaDailyVerification';

export { ArchiveBetaActivationError } from './serverArchiveBetaDailyVerification';

type Dependencies = ArchiveBetaVerificationDependencies & { now(): Date };

/** Explicit manual operation retains its current Pacific date ceiling. */
export async function issueActivatedArchiveBetaDaily(
  puzzleDate: string,
  dependencies?: Dependencies,
) {
  const now = dependencies?.now() ?? new Date();
  let identity;
  try {
    identity = resolveArchiveBetaDailyIdentityForDate(puzzleDate, ARCHIVE_BETA_EPOCH);
  } catch {
    throw new ArchiveBetaActivationError('invalid-date');
  }
  if (identity === null || puzzleDate > getPacificDailyDateString(now)) {
    throw new ArchiveBetaActivationError('invalid-date');
  }
  return issueArchiveBetaDailyAndVerify(identity, now.toISOString(), dependencies);
}
