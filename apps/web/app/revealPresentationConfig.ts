import type { RevealStatKind } from './canonicalRevealViewModel';

export type HitterRevealColumn =
  | 'AB'
  | 'H'
  | 'HR'
  | 'BA'
  | 'R'
  | 'RBI'
  | 'SB'
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
  hitter: ['AB', 'H', 'HR', 'BA', 'R', 'RBI', 'SB', 'OBP', 'SLG', 'OPS'],
  pitcher: ['W', 'L', 'SV', 'ERA', 'WHIP', 'K', 'IP'],
};

export function getRevealColumns(
  kind: RevealStatKind,
  overrides?: RevealColumnOverrides,
): readonly string[] {
  return overrides?.[kind] ?? DEFAULT_REVEAL_COLUMNS[kind];
}
