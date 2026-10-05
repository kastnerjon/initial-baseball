import 'server-only';
import { resolveArchiveBetaDailyIdentityForDate, type DailyPuzzleRepository } from '@initial-baseball/daily';
import { ARCHIVE_BETA_EPOCH } from './archiveBetaActivation';
import { createDailyAdminWorkflow, type DailyAdminWorkflow } from './dailyAdminWorkflow';
import { issueArchiveBetaDailyAndVerify } from './serverArchiveBetaDailyVerification';

type TransitionInput = Parameters<DailyAdminWorkflow['transitionLifecycle']>[0];
type Dependencies = {
  transition(input: TransitionInput): Promise<unknown>;
  issueAndVerify: typeof issueArchiveBetaDailyAndVerify;
};

export class ArchiveBetaPublicationError extends Error {
  constructor() {
    super('Published lineup archive copy could not be verified.');
    this.name = 'ArchiveBetaPublicationError';
  }
}

/** Publication locks editorial content before the separate append-only archive write. */
export async function transitionDailyLifecycleWithArchiveBeta(
  repository: DailyPuzzleRepository,
  input: TransitionInput,
  dependencies: Dependencies = {
    transition: input => createDailyAdminWorkflow(repository).transitionLifecycle(input),
    issueAndVerify: issueArchiveBetaDailyAndVerify,
  },
): Promise<void> {
  const identity = input.action === 'publish'
    ? resolveArchiveBetaDailyIdentityForDate(input.puzzleDate, ARCHIVE_BETA_EPOCH)
    : null;
  if (identity === null) {
    await dependencies.transition(input);
    return;
  }

  const record = await repository.getByDate(input.puzzleDate);
  // Only this authenticated completion operation is idempotent. Portable lifecycle rules stay strict.
  if (record?.status !== 'published') await dependencies.transition(input);
  try {
    await dependencies.issueAndVerify(identity, input.occurredAt);
  } catch {
    // Publication may already have committed. Never imply rollback or expose provider/puzzle payloads.
    throw new ArchiveBetaPublicationError();
  }
}
