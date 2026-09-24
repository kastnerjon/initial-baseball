import { CLASSIC_DAILY_RULESET_VERSION, type DailyRulesetVersion } from '@initial-baseball/shared';

const DEFAULT_DAILY_STORAGE_PREFIX = 'initial-baseball:daily:';
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
  return rulesetVersion === CLASSIC_DAILY_RULESET_VERSION
    ? `${CLASSIC_DAILY_STORAGE_PREFIX}${puzzleDate}`
    : `${DEFAULT_DAILY_STORAGE_PREFIX}${puzzleDate}`;
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
  if (!archive && rulesetVersion !== CLASSIC_DAILY_RULESET_VERSION) return storage;

  return {
    getItem: key => storage.getItem(translateKey(key)),
    setItem: (key, value) => storage.setItem(translateKey(key), value),
    removeItem: key => storage.removeItem(translateKey(key)),
  };

  function translateKey(key: string): string {
    if (archive && key.startsWith(DEFAULT_DAILY_STORAGE_PREFIX)) {
      return getDailyModeStorageKey(key.slice(DEFAULT_DAILY_STORAGE_PREFIX.length), rulesetVersion, puzzleId);
    }
    return archive ? key : toClassicKey(key);
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
