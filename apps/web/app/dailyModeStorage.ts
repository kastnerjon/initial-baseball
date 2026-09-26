import {
  CLASSIC_DAILY_RULESET_VERSION,
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V1_DAILY_RULESET_VERSION,
  POINTS_V2_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';

const DEFAULT_DAILY_STORAGE_PREFIX = 'initial-baseball:daily:';
const VERSIONED_DAILY_STORAGE_PREFIX = 'initial-baseball:daily:ruleset:';
const CLASSIC_DAILY_STORAGE_PREFIX = 'initial-baseball:daily:classic:';
const ARCHIVE_DAILY_STORAGE_PREFIX = 'initial-baseball:archive:permanent-v1:';

type DailyModeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function getDailyModeStorageKey(
  puzzleDate: string,
  rulesetVersion: DailyRulesetVersion,
  puzzleId?: string,
): string {
  if (puzzleId?.startsWith('permanent-v1-daily-')) {
    return `${ARCHIVE_DAILY_STORAGE_PREFIX}${encodeURIComponent(puzzleId)}:${rulesetVersion}:${puzzleDate}`;
  }
  if (rulesetVersion === CLASSIC_DAILY_RULESET_VERSION) {
    return `${CLASSIC_DAILY_STORAGE_PREFIX}${puzzleDate}`;
  }
  if (usesHistoricalCurrentDailyKey(rulesetVersion)) {
    return `${DEFAULT_DAILY_STORAGE_PREFIX}${puzzleDate}`;
  }
  return `${VERSIONED_DAILY_STORAGE_PREFIX}${rulesetVersion}:${puzzleDate}`;
}

export function getDailyModeStorage(
  rulesetVersion: DailyRulesetVersion,
  storage: DailyModeStorage | null = getBrowserStorage(),
  puzzleId?: string,
): DailyModeStorage | null {
  if (storage === null) {
    return storage;
  }
  const archive = puzzleId?.startsWith('permanent-v1-daily-') === true;
  if (!archive && usesHistoricalCurrentDailyKey(rulesetVersion)) return storage;

  return {
    getItem: key => storage.getItem(translateKey(key)),
    setItem: (key, value) => storage.setItem(translateKey(key), value),
    removeItem: key => storage.removeItem(translateKey(key)),
  };

  function translateKey(key: string): string {
    if (!key.startsWith(DEFAULT_DAILY_STORAGE_PREFIX)) return key;
    return getDailyModeStorageKey(
      key.slice(DEFAULT_DAILY_STORAGE_PREFIX.length),
      rulesetVersion,
      puzzleId,
    );
  }
}

export function isDailyModeSaveCompatible(
  requestedRulesetVersion: DailyRulesetVersion,
  savedRulesetVersion: DailyRulesetVersion,
  puzzleId?: string,
): boolean {
  if (puzzleId?.startsWith('permanent-v1-daily-')) {
    return requestedRulesetVersion === savedRulesetVersion;
  }
  if (requestedRulesetVersion === CLASSIC_DAILY_RULESET_VERSION) {
    return savedRulesetVersion === CLASSIC_DAILY_RULESET_VERSION;
  }
  if (requestedRulesetVersion === POINTS_V3_DAILY_RULESET_VERSION) {
    return usesHistoricalCurrentDailyKey(savedRulesetVersion);
  }
  return requestedRulesetVersion === savedRulesetVersion;
}

function usesHistoricalCurrentDailyKey(rulesetVersion: DailyRulesetVersion): boolean {
  return rulesetVersion === LEGACY_DAILY_RULESET_VERSION
    || rulesetVersion === POINTS_V1_DAILY_RULESET_VERSION
    || rulesetVersion === POINTS_V2_DAILY_RULESET_VERSION
    || rulesetVersion === POINTS_V3_DAILY_RULESET_VERSION;
}

function getBrowserStorage(): DailyModeStorage | null {
  try {
    return (globalThis as { localStorage?: DailyModeStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}
