import type { JSX } from 'react';
import { redirect } from 'next/navigation';
import { CLASSIC_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { DailyModePage } from '../components/DailyModePage';
import { isClassicInningEnabled } from '../gameAvailability';

export const revalidate = 60;

export default async function ClassicInningPage(): Promise<JSX.Element> {
  if (!isClassicInningEnabled()) {
    redirect('/');
  }

  return DailyModePage({ rulesetVersion: CLASSIC_DAILY_RULESET_VERSION });
}
