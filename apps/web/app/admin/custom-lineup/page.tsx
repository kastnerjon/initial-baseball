import type { JSX } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DailyAdminAuthorizationError, requireDailyAdminPrincipal } from '../../dailyAdminAuthorization';
import { DAILY_ADMIN_AUTH_PATH } from '../../dailyAdminPaths';
import { CustomNineCreatorView } from './CustomNineCreatorView';
import '../custom-nine/custom-nine-creator.css';

export const dynamic = 'force-dynamic';

/** Admin-only v2 creator. The browser and private API cannot bypass Daily admin auth. */
export default async function AdminCustomLineupPage(): Promise<JSX.Element> {
  try {
    const requestHeaders = await headers();
    requireDailyAdminPrincipal(requestHeaders.get('authorization'));
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') {
      redirect(DAILY_ADMIN_AUTH_PATH);
    }
    return <main style={{ maxWidth: 760, margin: '2rem auto', padding: 24 }}>
      <h1>Custom Lineup administration unavailable</h1>
      <p>Administrator configuration is unavailable. No challenge creation is permitted.</p>
    </main>;
  }

  return <CustomNineCreatorView mode="v2" />;
}
