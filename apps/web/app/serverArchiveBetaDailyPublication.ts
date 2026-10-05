import 'server-only';
import { resolveArchiveBetaDailyIdentityForDate, type DailyPuzzleRepository } from '@initial-baseball/daily';
import { ARCHIVE_BETA_EPOCH } from './archiveBetaActivation';
import { createDailyAdminWorkflow, type DailyAdminWorkflow } from './dailyAdminWorkflow';
import { ArchiveBetaActivationError, issueArchiveBetaDailyAndVerify } from './serverArchiveBetaDailyVerification';

type TransitionInput = Parameters<DailyAdminWorkflow['transitionLifecycle']>[0];
type Dependencies = {
  transition(input: TransitionInput): Promise<unknown>;
  issueAndVerify: typeof issueArchiveBetaDailyAndVerify;
};

export class ArchiveBetaPublicationError extends Error {
  constructor(readonly kind: 'immutable-conflict' | 'verification-failed' = 'verification-failed') {
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
  const identity = input.action !== 'schedule'
    ? resolveArchiveBetaDailyIdentityForDate(input.puzzleDate, ARCHIVE_BETA_EPOCH)
    : null;
  if (identity === null) {
    await dependencies.transition(input);
    return;
  }

  const record = await repository.getByDate(input.puzzleDate);
  // Only this authenticated completion operation is idempotent. Portable lifecycle rules stay strict.
  if (input.action === 'archive' && record?.status !== 'published') {
    await dependencies.transition(input);
    return;
  }
  if (input.action === 'publish' && record?.status !== 'published') await dependencies.transition(input);
  try {
    await dependencies.issueAndVerify(identity, input.occurredAt);
  } catch (error) {
    // Publication may already have committed. Never imply rollback or expose provider/puzzle payloads.
    throw new ArchiveBetaPublicationError(
      error instanceof ArchiveBetaActivationError && error.kind === 'immutable-conflict'
        ? 'immutable-conflict' : 'verification-failed',
    );
  }
  // Never retire the only supported completion/retry path before its copy is verified.
  if (input.action === 'archive') await dependencies.transition(input);
}
