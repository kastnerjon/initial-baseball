import type { JSX } from 'react';
import { CURRENT_DAILY_RULESET_VERSION } from '@initial-baseball/shared';
import { DailyModePage } from './components/DailyModePage';

export const revalidate = 60;

export default async function DailyInningHomePage(): Promise<JSX.Element> {
  return DailyModePage({ rulesetVersion: CURRENT_DAILY_RULESET_VERSION });
}
