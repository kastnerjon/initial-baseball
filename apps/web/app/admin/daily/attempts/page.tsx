import { headers } from 'next/headers';
import type { JSX } from 'react';
import { redirect } from 'next/navigation';
import { DailyAdminAuthorizationError } from '../../../dailyAdminAuthorization';
import { DAILY_ADMIN_AUTH_PATH } from '../../../dailyAdminPaths';
import { AdminAttemptFilterError } from '../../../dailyAdminAttemptReport';
import { readDailyAdminAttemptReport } from '../../../serverDailyAdminAttemptReport';
import { DailyAttemptScoresView } from './DailyAttemptScoresView';

export const dynamic = 'force-dynamic';

export default async function DailyAttemptScoresPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (typeof value === 'string') params.set(key, value);
    }
    const requestHeaders = await headers();
    const report = await readDailyAdminAttemptReport(requestHeaders.get('authorization'), params);
    return <DailyAttemptScoresView report={report} />;
  } catch (error) {
    if (error instanceof DailyAdminAuthorizationError && error.kind === 'unauthorized') redirect(DAILY_ADMIN_AUTH_PATH);
    return <main style={{ padding: 24 }}><h1>Attempt scores unavailable</h1><p>{error instanceof AdminAttemptFilterError ? error.message : 'The private result report could not be loaded. Try again later.'}</p><a href="/admin/daily/attempts">Clear filters</a></main>;
  }
}
