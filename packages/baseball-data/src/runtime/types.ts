export type CanonicalPlayerType = 'hitter' | 'pitcher' | 'two-way';

export type CanonicalPlayerIndexEntry = {
  playerId: string;
  lahmanPlayerId: string;
  displayName: string;
  aliases: string[];
  playerType: CanonicalPlayerType;
  primaryPosition: string | null;
  firstSeason: number;
  lastSeason: number;
  seasonCount: number;
  teamIds: string[];
  isHallOfFamer: boolean;
  revealShard: string;
};

export type CanonicalBattingLine = {
  atBats: number | null;
  runs: number | null;
  hits: number | null;
  doubles: number | null;
  triples: number | null;
  homeRuns: number | null;
  runsBattedIn: number | null;
  stolenBases: number | null;
  walks: number | null;
  battingAverage: number | null;
  sluggingPercentage: number | null;
};

export type CanonicalPitchingLine = {
  wins: number | null;
  losses: number | null;
  saves: number | null;
  outsPitched: number | null;
  hitsAllowed: number | null;
  earnedRuns: number | null;
  walksAllowed: number | null;
  strikeouts: number | null;
  earnedRunAverage: number | null;
  whip: number | null;
};

export type CanonicalAdvancedLine = {
  onBasePercentage: number | null;
  sluggingPercentage: number | null;
  ops: number | null;
  war: number | null;
  opsPlus: number | null;
  eraPlus: number | null;
  fip: number | null;
};

export type CanonicalRevealSeason = {
  season: number;
  teamIds: string[];
  positions: Record<string, number | null> | null;
  batting: CanonicalBattingLine | null;
  pitching: CanonicalPitchingLine | null;
  advanced: CanonicalAdvancedLine | null;
  achievements: Record<string, unknown> | null;
};

export type CanonicalPlayerReveal = {
  schemaVersion: 1;
  playerId: string;
  lahmanPlayerId: string;
  displayName: string;
  playerType: CanonicalPlayerType;
  career: {
    firstSeason: number;
    lastSeason: number;
    seasonCount: number;
    teamIds: string[];
    primaryPosition: string | null;
    batting: CanonicalBattingLine | null;
    pitching: CanonicalPitchingLine | null;
    advanced: CanonicalAdvancedLine | null;
    achievements: Record<string, unknown> | null;
  };
  seasons: CanonicalRevealSeason[];
  provenance: {
    canonicalUniversePresent: boolean;
    careerEnrichmentPresent: boolean;
    seasonCardCount: number;
    legalNameExcludedFromDisplayPayload: boolean;
  };
};

export type CanonicalPlayerIndexPayload = {
  schemaVersion: 1;
  players: CanonicalPlayerIndexEntry[];
};

export type CanonicalRedirectExclusion = {
  legacyPlayerId: string;
  playerId: string;
  reason: string;
};

export type CanonicalRedirectPayload = {
  schemaVersion: 1;
  redirects: Record<string, string>;
  excludedRedirects: CanonicalRedirectExclusion[];
};

export type CanonicalRevealShardPayload = {
  schemaVersion: 1;
  shardId: string;
  players: Record<string, CanonicalPlayerReveal>;
};

export type CanonicalIdResolution =
  | { status: 'canonical'; playerId: string }
  | { status: 'redirected'; playerId: string; legacyPlayerId: string }
  | { status: 'excluded'; playerId: string; legacyPlayerId: string; reason: string }
  | { status: 'unknown'; requestedPlayerId: string };
