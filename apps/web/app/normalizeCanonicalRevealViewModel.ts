import type {
  CanonicalRevealStatLine,
  CanonicalRevealViewModel,
  RevealStatKind,
  RevealStatValues,
} from './canonicalRevealViewModel';

type RevealRecord = Record<string, unknown>;

export function normalizeCanonicalRevealViewModel(
  input: CanonicalRevealViewModel,
): CanonicalRevealViewModel {
  const reveal = input as unknown as RevealRecord;
  const seasons = Array.isArray(reveal.seasons) ? reveal.seasons : [];

  return {
    ...input,
    career: {
      lines: normalizeLines(reveal.career),
      ...normalizePeakFields(reveal.career),
    },
    seasons: seasons.flatMap((value) => {
      if (!isRecord(value) || typeof value.season !== 'number' || !Array.isArray(value.teamIds)) {
        return [];
      }
      return [{
        season: value.season,
        teamIds: value.teamIds.filter((teamId): teamId is string => typeof teamId === 'string'),
        lines: normalizeLines(value),
      }];
    }),
  };
}

/** Saved browser results may predate the optional field or contain bad local data. */
function normalizePeakFields(value: unknown): {
  regularSeasonPeaks?: CanonicalRevealViewModel['career']['regularSeasonPeaks'];
} {
  if (!isRecord(value) || !isRecord(value.regularSeasonPeaks)) return {};
  const peaks = value.regularSeasonPeaks;
  return {
    regularSeasonPeaks: {
      homeRuns: normalizePeak(peaks.homeRuns),
      strikeouts: normalizePeak(peaks.strikeouts),
    },
  };
}

function normalizePeak(input: unknown): { season: number; value: number } | null {
  if (!isRecord(input)
    || typeof input.season !== 'number' || !Number.isSafeInteger(input.season) || input.season < 1
    || typeof input.value !== 'number' || !Number.isSafeInteger(input.value) || input.value < 0) {
    return null;
  }
  return { season: input.season, value: input.value };
}

function normalizeLines(value: unknown): CanonicalRevealStatLine[] {
  if (!isRecord(value)) {
    return [];
  }
  if (Array.isArray(value.lines)) {
    return value.lines.filter(isCanonicalRevealStatLine);
  }
  if (isRevealStatKind(value.kind) && isRevealStatValues(value.stats)) {
    return [{ kind: value.kind, stats: value.stats }];
  }
  return [];
}

function isCanonicalRevealStatLine(value: unknown): value is CanonicalRevealStatLine {
  return isRecord(value)
    && isRevealStatKind(value.kind)
    && isRevealStatValues(value.stats);
}

function isRevealStatKind(value: unknown): value is RevealStatKind {
  return value === 'hitter' || value === 'pitcher';
}

function isRevealStatValues(value: unknown): value is RevealStatValues {
  return isRecord(value)
    && Object.values(value).every((stat) => typeof stat === 'number' || typeof stat === 'string');
}

function isRecord(value: unknown): value is RevealRecord {
  return typeof value === 'object' && value !== null;
}
