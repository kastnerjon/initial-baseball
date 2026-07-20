import type {
  CanonicalRevealStatLine,
  CanonicalRevealViewModel,
  RevealStatKind,
  RevealStatValues,
} from './canonicalRevealViewModel';

type LegacyRevealSummary = {
  kind: RevealStatKind;
  stats: RevealStatValues;
};

type PossiblyLegacyReveal = Omit<CanonicalRevealViewModel, 'career' | 'seasons'> & {
  career: CanonicalRevealViewModel['career'] | LegacyRevealSummary;
  seasons: Array<{
    season: number;
    teamIds: string[];
  } & (CanonicalRevealViewModel['seasons'][number] | LegacyRevealSummary)>;
};

export function normalizeCanonicalRevealViewModel(
  input: CanonicalRevealViewModel,
): CanonicalRevealViewModel {
  const reveal = input as unknown as PossiblyLegacyReveal;
  return {
    ...reveal,
    career: {
      lines: normalizeLines(reveal.career),
    },
    seasons: reveal.seasons.map((season) => ({
      season: season.season,
      teamIds: season.teamIds,
      lines: normalizeLines(season),
    })),
  };
}

function normalizeLines(
  summary: CanonicalRevealViewModel['career'] | CanonicalRevealViewModel['seasons'][number] | LegacyRevealSummary,
): CanonicalRevealStatLine[] {
  if ('lines' in summary && Array.isArray(summary.lines)) {
    return summary.lines;
  }
  return [{ kind: summary.kind, stats: summary.stats }];
}
