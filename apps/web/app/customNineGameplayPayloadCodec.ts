import type { DailyGuessResult } from '@initial-baseball/shared';
import type { CanonicalRevealViewModel, CanonicalRevealStatLine } from './canonicalRevealViewModel';

type TerminalResult = Exclude<DailyGuessResult, { kind: 'incorrect' }>;
const OUTCOMES = ['HR', '3B', '2B', '1B', 'BB'] as const;
const STAT_KEYS = new Set(['AB', 'H', 'HR', 'BA', 'R', 'RBI', 'SB', 'OBP', 'SLG', 'OPS',
  'W', 'L', 'SV', 'ERA', 'WHIP', 'K', 'IP']);

/** Whitelist the exact scored result shape, never transport arbitrary server fields. */
export function decodeCustomNineTerminalResult(value: unknown): TerminalResult {
  if (!record(value) || !integer(value.revealedCount, 0, 4)) malformed();
  const depth = value.revealedCount as 0 | 1 | 2 | 3 | 4;
  if (value.kind === 'correct') {
    if (value.outcome !== OUTCOMES[depth] || value.source !== (depth === 0 ? 'initials' : depth)) malformed();
    return { kind: 'correct', revealedCount: depth,
      outcome: value.outcome as Exclude<TerminalResult, {kind:'strikeout'}>['outcome'],
      source: value.source as Exclude<TerminalResult, {kind:'strikeout'}>['source'] };
  }
  if (value.kind === 'strikeout') {
    if (value.outcome !== 'K' || value.strikeCount !== 3 || value.source !== 'strikeout') malformed();
    return { kind: 'strikeout', revealedCount: depth, outcome: 'K',
      strikeCount: 3, source: 'strikeout' };
  }
  malformed();
}

/** Terminal-only reveal projection. Reject gaps, and strip unexpected private fields. */
export function decodeCustomNineTerminalReveal(value: unknown): CanonicalRevealViewModel {
  if (!record(value) || !text(value.playerId) || !text(value.displayName)
    || !['hitter', 'pitcher', 'two-way'].includes(String(value.playerType))
    || (value.primaryPosition !== null && !text(value.primaryPosition))
    || !text(value.yearsPlayedDisplay)
    || !record(value.career) || !Array.isArray(value.seasons)
    || value.seasons.length > 250) malformed();

  const seasons = value.seasons.map((season: unknown) => {
    if (!record(season) || !integer(season.season, 1800, 2100)) malformed();
    return {
      season: season.season as number,
      teamIds: teams(season.teamIds),
      lines: lines(season.lines),
    };
  });
  return {
    playerId: value.playerId as string,
    displayName: value.displayName as string,
    playerType: value.playerType as CanonicalRevealViewModel['playerType'],
    primaryPosition: value.primaryPosition as string | null,
    yearsPlayedDisplay: value.yearsPlayedDisplay as string,
    teamIds: teams(value.teamIds),
    career: {
      lines: lines(value.career.lines),
      ...decodeRegularSeasonPeaks(value.career.regularSeasonPeaks),
    },
    seasons,
  };
}

/** Whitelist optional resolved-only career highs; keep old v1/v2 Custom responses valid. */
function decodeRegularSeasonPeaks(value: unknown): {
  regularSeasonPeaks?: CanonicalRevealViewModel['career']['regularSeasonPeaks'];
} {
  if (value === undefined) return {};
  if (!record(value)) malformed();
  return {
    regularSeasonPeaks: {
      homeRuns: decodeCareerPeak(value.homeRuns),
      strikeouts: decodeCareerPeak(value.strikeouts),
    },
  };
}

function decodeCareerPeak(value: unknown): { season: number; value: number } | null {
  if (value === null) return null;
  if (!record(value) || !integer(value.season, 1800, 2100)
    || !Number.isSafeInteger(value.value) || (value.value as number) < 0) malformed();
  return { season: value.season as number, value: value.value as number };
}

function teams(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 50
    || !value.every(item => text(item) && item.length <= 60)) malformed();
  return [...value] as string[];
}

function lines(value: unknown): CanonicalRevealStatLine[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) malformed();
  return value.map((entry: unknown) => {
    if (!record(entry) || (entry.kind !== 'hitter' && entry.kind !== 'pitcher')
      || !record(entry.stats) || Object.keys(entry.stats).length > 20) malformed();
    const stats: Record<string, number | string> = {};
    for (const [name, data] of Object.entries(entry.stats)) {
      if (!STAT_KEYS.has(name) || !(typeof data === 'string' && data.length <= 128
        || typeof data === 'number' && Number.isFinite(data))) malformed();
      stats[name] = data as number | string;
    }
    return { kind: entry.kind as CanonicalRevealStatLine['kind'], stats };
  });
}

function text(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= 2048;
}
function integer(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function malformed(): never { throw new Error('Invalid Custom Nine terminal payload'); }
