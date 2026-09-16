import type { JSX } from 'react';
import { CLASSIC_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { DailyModePage } from '../components/DailyModePage';

export const revalidate = 60;

export default async function ClassicInningPage(): Promise<JSX.Element> {
  return DailyModePage({ rulesetVersion: CLASSIC_DAILY_RULESET_VERSION });
}
