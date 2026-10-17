import type { JSX } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DailyAdminAuthorizationError, requireDailyAdminPrincipal } from '../../dailyAdminAuthorization';
import { DAILY_ADMIN_AUTH_PATH } from '../../dailyAdminPaths';
import { DailyFiveDraftWorkbench } from './DailyFiveDraftWorkbench';
import '../custom-nine/custom-nine-creator.css';

export const dynamic = 'force-dynamic';

/** Admin preview/editor only. The server-side persistence gate is disabled by default. */
export default async function DailyFiveDraftPage(): Promise<JSX.Element> {
  try {
    const requestHeaders = await headers();
    requireDailyAdminPrincipal(requestHeaders.get('authorization'));
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      redirect(DAILY_ADMIN_AUTH_PATH);
    }
    return <main style={{ maxWidth: 760, margin: '2rem auto', padding: 24 }}>
      <h1>Daily Five editor unavailable</h1>
      <p>Administrator configuration is unavailable. No draft can be saved.</p>
    </main>;
  }

  // Do not expose the dangerous write flag in the UI until calendar coexistence is reviewed.
  return <DailyFiveDraftWorkbench writesEnabled={process.env.DAILY_FIVE_DRAFT_WRITES_ENABLED === 'true'} />;
}
