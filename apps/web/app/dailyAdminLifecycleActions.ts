export const DAILY_ADMIN_LIFECYCLE_ACTIONS = ['schedule', 'publish', 'archive'] as const;

export type DailyAdminLifecycleAction = typeof DAILY_ADMIN_LIFECYCLE_ACTIONS[number];

export function isDailyAdminLifecycleAction(value: string): value is DailyAdminLifecycleAction {
  return DAILY_ADMIN_LIFECYCLE_ACTIONS.some(action => action === value);
}
