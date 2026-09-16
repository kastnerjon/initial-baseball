import { CLASSIC_DAILY_RULESET_VERSION, type DailyRulesetVersion } from '@initial-baseball/shared';

const DEFAULT_DAILY_STORAGE_PREFIX = 'initial-baseball:daily:';
const CLASSIC_DAILY_STORAGE_PREFIX = 'initial-baseball:daily:classic:';

type DailyModeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function getDailyModeStorageKey(
  puzzleDate: string,
  rulesetVersion: DailyRulesetVersion,
): string {
  return rulesetVersion === CLASSIC_DAILY_RULESET_VERSION
    ? `${CLASSIC_DAILY_STORAGE_PREFIX}${puzzleDate}`
    : `${DEFAULT_DAILY_STORAGE_PREFIX}${puzzleDate}`;
}

export function getDailyModeStorage(
  rulesetVersion: DailyRulesetVersion,
  storage: DailyModeStorage | null = getBrowserStorage(),
): DailyModeStorage | null {
  if (storage === null || rulesetVersion !== CLASSIC_DAILY_RULESET_VERSION) {
    return storage;
  }

  return {
    getItem: key => storage.getItem(toClassicKey(key)),
    setItem: (key, value) => storage.setItem(toClassicKey(key), value),
    removeItem: key => storage.removeItem(toClassicKey(key)),
  };
}

export function isDailyModeSaveCompatible(
  requestedRulesetVersion: DailyRulesetVersion,
  savedRulesetVersion: DailyRulesetVersion,
): boolean {
  return requestedRulesetVersion === CLASSIC_DAILY_RULESET_VERSION
    ? savedRulesetVersion === CLASSIC_DAILY_RULESET_VERSION
    : savedRulesetVersion !== CLASSIC_DAILY_RULESET_VERSION;
}

function toClassicKey(key: string): string {
  return key.startsWith(DEFAULT_DAILY_STORAGE_PREFIX)
    ? `${CLASSIC_DAILY_STORAGE_PREFIX}${key.slice(DEFAULT_DAILY_STORAGE_PREFIX.length)}`
    : key;
}

function getBrowserStorage(): DailyModeStorage | null {
  try {
    return (globalThis as { localStorage?: DailyModeStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}
