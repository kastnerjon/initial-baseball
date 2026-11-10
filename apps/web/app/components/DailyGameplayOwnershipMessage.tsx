import React, { type JSX } from 'react';
import type { DailyGameplayAccess } from '../dailyGameplayPersistenceAuthority';

/** Shared owner/follower/storage gate while a Daily session is acquired. */
export function DailyGameplayOwnershipMessage({ access }: { access: DailyGameplayAccess }): JSX.Element {
  return (
    <div className="game-shell">
      <section className="at-bat-card" aria-live="polite">
        <p>
          {access === 'checking'
            ? 'Opening today’s game…'
            : access === 'follower'
              ? 'This Daily is active in another tab. Close that tab to continue here.'
              : 'This Daily could not be restored safely in this tab. Refresh to try again.'}
        </p>
      </section>
    </div>
  );
}
