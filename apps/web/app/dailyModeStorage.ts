import {
  CLASSIC_DAILY_RULESET_VERSION,
  LEGACY_DAILY_RULESET_VERSION,
  POINTS_V1_DAILY_RULESET_VERSION,
  POINTS_V2_DAILY_RULESET_VERSION,
  POINTS_V3_DAILY_RULESET_VERSION,
  POINTS_V4_DAILY_RULESET_VERSION,
  type DailyRulesetVersion,
} from '@initial-baseball/shared';

const DEFAULT_DAILY_STORAGE_PREFIX = 'initial-baseball:daily:';
const VERSIONED_DAILY_STORAGE_PREFIX = 'initial-baseball:daily:ruleset:';
const CLASSIC_DAILY_STORAGE_PREFIX = 'initial-baseball:daily:classic:';
const ARCHIVE_DAILY_STORAGE_PREFIX = 'initial-baseball:archive:permanent-v1:';

export function isArchiveDailyPuzzleId(id?: string): boolean {
  return id?.startsWith('permanent-v1-daily-') === true || id?.startsWith('archive-beta-v1-daily-') === true;
}

type DailyModeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function getDailyModeStorageKey(
  puzzleDate: string,
  rulesetVersion: DailyRulesetVersion,
  puzzleId?: string,
): string {
  if (isArchiveDailyPuzzleId(puzzleId)) {
    const prefix = puzzleId!.startsWith('archive-beta-v1-daily-') ? 'initial-baseball:archive:archive-beta-v1:' : ARCHIVE_DAILY_STORAGE_PREFIX;
    return `${prefix}${encodeURIComponent(puzzleId!)}:${rulesetVersion}:${puzzleDate}`;
  }
  if (rulesetVersion === CLASSIC_DAILY_RULESET_VERSION) {
    return `${CLASSIC_DAILY_STORAGE_PREFIX}${puzzleDate}`;
  }
  if (usesHistoricalCurrentDailyKey(rulesetVersion)) {
    return `${DEFAULT_DAILY_STORAGE_PREFIX}${puzzleDate}`;
  }
  if (rulesetVersion === POINTS_V4_DAILY_RULESET_VERSION && puzzleId !== undefined) {
    return `${VERSIONED_DAILY_STORAGE_PREFIX}${rulesetVersion}:${puzzleDate}:puzzle:${encodeURIComponent(puzzleId)}`;
  }
  return getVersionedDailyStorageKey(puzzleDate, rulesetVersion);
}

export function getDailyModeStorage(
  rulesetVersion: DailyRulesetVersion,
  storage: DailyModeStorage | null = getBrowserStorage(),
  puzzleId?: string,
): DailyModeStorage | null {
  if (storage === null) {
    return storage;
  }
  const archive = isArchiveDailyPuzzleId(puzzleId);
  if (!archive && usesHistoricalCurrentDailyKey(rulesetVersion)) return storage;
  const puzzleScopedCurrentId = !archive
    && rulesetVersion === POINTS_V4_DAILY_RULESET_VERSION
    && puzzleId !== undefined
    ? puzzleId
    : null;

  return {
    getItem(key) {
      const translatedKey = translateKey(key);
      const value = storage.getItem(translatedKey);
      if (value !== null || puzzleScopedCurrentId === null || !isDailyGameplayKey(key)) {
        return value;
      }

      const legacyValue = storage.getItem(legacyVersionedKey(key));
      return savedValueMatchesPuzzleId(legacyValue, puzzleScopedCurrentId) ? legacyValue : null;
    },
    setItem: (key, value) => storage.setItem(translateKey(key), value),
    removeItem(key) {
      storage.removeItem(translateKey(key));
      if (puzzleScopedCurrentId === null || !isDailyGameplayKey(key)) return;

      const fallbackKey = legacyVersionedKey(key);
      const fallbackValue = storage.getItem(fallbackKey);
      if (savedValueMatchesPuzzleId(fallbackValue, puzzleScopedCurrentId)) {
        storage.removeItem(fallbackKey);
      }
    },
  };

  function translateKey(key: string): string {
    if (!isDailyGameplayKey(key)) return key;
    return getDailyModeStorageKey(
      key.slice(DEFAULT_DAILY_STORAGE_PREFIX.length),
      rulesetVersion,
      puzzleId,
    );
  }

  function legacyVersionedKey(key: string): string {
    return getVersionedDailyStorageKey(
      key.slice(DEFAULT_DAILY_STORAGE_PREFIX.length),
      rulesetVersion,
    );
  }
}

export function isDailyModeSaveCompatible(
  requestedRulesetVersion: DailyRulesetVersion,
  savedRulesetVersion: DailyRulesetVersion,
  puzzleId?: string,
): boolean {
  if (isArchiveDailyPuzzleId(puzzleId)) {
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

function getVersionedDailyStorageKey(
  puzzleDate: string,
  rulesetVersion: DailyRulesetVersion,
): string {
  return `${VERSIONED_DAILY_STORAGE_PREFIX}${rulesetVersion}:${puzzleDate}`;
}

function isDailyGameplayKey(key: string): boolean {
  return key.startsWith(DEFAULT_DAILY_STORAGE_PREFIX);
}

function savedValueMatchesPuzzleId(value: string | null, puzzleId: string): boolean {
  if (value === null) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object'
      && parsed !== null
      && !Array.isArray(parsed)
      && (parsed as { puzzleId?: unknown }).puzzleId === puzzleId;
  } catch {
    return false;
  }
}
