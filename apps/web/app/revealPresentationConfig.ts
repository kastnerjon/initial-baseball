import type { RevealStatKind } from './canonicalRevealViewModel';

export type HitterRevealColumn =
  | 'AB'
  | 'R'
  | 'H'
  | 'HR'
  | 'RBI'
  | 'SB'
  | 'BA'
  | 'OBP'
  | 'SLG'
  | 'OPS';

export type PitcherRevealColumn =
  | 'W'
  | 'L'
  | 'SV'
  | 'ERA'
  | 'WHIP'
  | 'K'
  | 'IP';

export type RevealColumnConfig = {
  readonly hitter: readonly HitterRevealColumn[];
  readonly pitcher: readonly PitcherRevealColumn[];
};

export type RevealColumnOverrides = Partial<RevealColumnConfig>;

export const DEFAULT_REVEAL_COLUMNS: RevealColumnConfig = {
  hitter: ['AB', 'R', 'H', 'HR', 'RBI', 'SB', 'BA', 'OBP', 'SLG', 'OPS'],
  pitcher: ['W', 'L', 'SV', 'ERA', 'WHIP', 'K', 'IP'],
};

const DEFAULT_DAILY_HINT_STAT_FIELDS: Record<RevealStatKind, readonly string[]> = {
  hitter: ['HR', 'RBI', 'SB', 'BA', 'OBP'],
  pitcher: ['W', 'L', 'SV', 'ERA', 'WHIP', 'K'],
};

export function getDailyHintStatColumns(kind: RevealStatKind): readonly string[] {
  const includedFields: ReadonlySet<string> = new Set(DEFAULT_DAILY_HINT_STAT_FIELDS[kind]);
  return DEFAULT_REVEAL_COLUMNS[kind].filter((column) => includedFields.has(column));
}

export function getRevealColumns(
  kind: RevealStatKind,
  overrides?: RevealColumnOverrides,
): readonly string[] {
  return overrides?.[kind] ?? DEFAULT_REVEAL_COLUMNS[kind];
}
