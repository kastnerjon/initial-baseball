/**
 * Source-only browser orchestration for the first anonymous secondary Daily open.
 * This never grants competitive eligibility; only a future server-side attempt
 * reservation may do that. No route, component or score writer uses this yet.
 */
export const OFFICIAL_DAILY_CREDENTIAL_LOCK_NAME =
  'initial-baseball:official-daily:anonymous-credential-init:v1';

export type OfficialDailyExclusiveLockManager = {
  request<T>(
    name: string,
    options: { mode: 'exclusive'; signal: AbortSignal },
    callback: (lock: object | null) => Promise<T>,
  ): Promise<T>;
};

export type OfficialDailyFirstOpenResult<T> =
  | { status: 'server_accepted'; response: T }
  | {
      status: 'practice_only';
      reason: 'locking_unavailable' | 'aborted' | 'handshake_unavailable' | 'credential_unconfirmed';
    }
  | { status: 'reconciliation_required' };

type Inputs<T> = {
  /** Use the origin-wide browser Web Locks API; never a per-puzzle lock. */
  locks: OfficialDailyExclusiveLockManager | null | undefined;
  /** Required so a queued lock request can be cancelled during navigation. */
  signal: AbortSignal;
  /** Separate cookie-authenticated server request, never a browser cookie read. */
  confirmServerCookie: () => Promise<boolean>;
  /** Server sets a Secure/HttpOnly cookie; this operation reserves no attempt. */
  initializeServerCookie: () => Promise<void>;
  /** Server validates and atomically reserves an exact-ID live attempt. */
  requestServerStart: () => Promise<T>;
};

function practiceOnly(
  reason: Extract<OfficialDailyFirstOpenResult<never>, { status: 'practice_only' }>['reason'],
): OfficialDailyFirstOpenResult<never> {
  return { status: 'practice_only', reason };
}

/**
 * Hold one origin-wide exclusive lock across cookie establishment, server
 * readback and initial live-start request for all editions. A failed start may
 * have committed on the server and must be reconciled, not silently retried as
 * a new identity or reclassified as practice.
 */
export async function attemptOfficialDailyAnonymousFirstOpen<T>(
  input: Inputs<T>,
): Promise<OfficialDailyFirstOpenResult<T>> {
  if (!input.signal || input.signal.aborted) return practiceOnly('aborted');
  if (!input.locks || typeof input.locks.request !== 'function') {
    return practiceOnly('locking_unavailable');
  }

  try {
    return await input.locks.request(
      OFFICIAL_DAILY_CREDENTIAL_LOCK_NAME,
      { mode: 'exclusive', signal: input.signal },
      async lock => {
        if (!lock) return practiceOnly('locking_unavailable');
        if (input.signal.aborted) return practiceOnly('aborted');

        let confirmed: boolean;
        try {
          confirmed = (await input.confirmServerCookie()) === true;
          if (!confirmed) {
            if (input.signal.aborted) return practiceOnly('aborted');
            await input.initializeServerCookie();
            if (input.signal.aborted) return practiceOnly('aborted');
            confirmed = (await input.confirmServerCookie()) === true;
          }
        } catch {
          return practiceOnly('handshake_unavailable');
        }
        if (input.signal.aborted) return practiceOnly('aborted');
        if (!confirmed) return practiceOnly('credential_unconfirmed');

        try {
          const response = await input.requestServerStart();
          return { status: 'server_accepted', response };
        } catch {
          // The reservation may have committed despite a lost HTTP response.
          // Never infer eligibility or mint a second anonymous identity.
          return { status: 'reconciliation_required' };
        }
      },
    );
  } catch {
    return input.signal.aborted
      ? practiceOnly('aborted')
      : practiceOnly('locking_unavailable');
  }
}
