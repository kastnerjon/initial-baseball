import { POINTS_V4_DAILY_RULESET_VERSION, type DailyRulesetVersion } from '@initial-baseball/shared';

/** Single reversible presentation switch. Old top/bottom scoreboards remain intact. */
const ENABLE_YOUR_NINE = true;

export function isYourNineEnabled(rulesetVersion: DailyRulesetVersion): boolean {
  return ENABLE_YOUR_NINE && rulesetVersion === POINTS_V4_DAILY_RULESET_VERSION;
}
