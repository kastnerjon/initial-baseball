export type HitterStatField =
  | 'bwar'
  | 'hr'
  | 'rbi'
  | 'ba'
  | 'obp'
  | 'slg'
  | 'ops'
  | 'sb';

export type PitcherStatField =
  | 'bwar'
  | 'w'
  | 'l'
  | 'era'
  | 'whip'
  | 'k'
  | 'sv'
  | 'ip';

export type StatsHintConfig = {
  hitter: HitterStatField[];
  pitcher: PitcherStatField[];
};

export const HITTER_STAT_LABELS: Record<HitterStatField, string> = {
  bwar: 'bWAR',
  hr: 'HR',
  rbi: 'RBI',
  ba: 'BA',
  obp: 'OBP',
  slg: 'SLG',
  ops: 'OPS',
  sb: 'SB',
};

export const PITCHER_STAT_LABELS: Record<PitcherStatField, string> = {
  bwar: 'bWAR',
  w: 'W',
  l: 'L',
  era: 'ERA',
  whip: 'WHIP',
  k: 'K',
  sv: 'SV',
  ip: 'IP',
};
