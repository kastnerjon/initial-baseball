# Complete Season Card Data Contract

## Purpose

Initial Baseball should have one authoritative player-season record that can power the reveal, career totals, search, admin tools, and future clients. This document defines the desired shape while `season-card-source-feasibility.md` records which fields are actually implementable from current checked-in sources.

The baseball-data layer owns baseball meaning. Clients may select and format fields, but they must not calculate statistics, combine traded-player rows, infer league leaders, interpret awards, or replace unknown values.

## Record grain

One record represents one canonical player in one major-league season.

```text
(canonicalPlayerId, season)
```

A traded player has one record with ordered team history. Batting and pitching are separate nested sections so two-way players retain both without duplicate player-season records.

## Top-level record

```ts
interface SeasonCardRecord {
  canonicalPlayerId: string;
  season: number;
  age: number | null;
  teams: SeasonTeam[];
  leagues: string[];
  batting: BattingSeasonCard | null;
  pitching: PitchingSeasonCard | null;
  fielding: FieldingSeasonSummary | null;
  honors: SeasonHonors | null;
  provenance: SeasonCardProvenance;
}

interface SeasonTeam {
  teamId: string;
  abbreviation: string;
  displayName: string | null;
  league: string | null;
  order: number;
}
```

The canonical record preserves actual teams. A client may display `TOT`, but `TOT` never replaces the real ordered team list.

## Batting contract

```ts
interface BattingSeasonCard {
  games: number | null;                    // G
  plateAppearances: number | null;         // PA
  atBats: number | null;                   // AB
  runs: number | null;                     // R
  hits: number | null;                     // H
  doubles: number | null;                  // 2B
  triples: number | null;                  // 3B
  homeRuns: number | null;                 // HR
  runsBattedIn: number | null;             // RBI
  stolenBases: number | null;              // SB
  caughtStealing: number | null;           // CS
  walks: number | null;                    // BB
  strikeouts: number | null;               // SO
  hitByPitch: number | null;               // HBP
  sacrificeHits: number | null;            // SH
  sacrificeFlies: number | null;           // SF
  groundedIntoDoublePlays: number | null;  // GIDP
  totalBases: number | null;               // TB

  battingAverage: number | null;           // AVG
  onBasePercentage: number | null;         // OBP
  sluggingPercentage: number | null;       // SLG
  onBasePlusSlugging: number | null;       // OPS
  adjustedOpsPlus: number | null;          // OPS+
  war: number | null;

  leagueLeaderFields: BattingLeagueLeaderField[] | null;
}
```

Default reveal columns:

```text
Season | Age | Team | WAR | G | PA | AB | R | H | 2B | 3B | HR | RBI | SB | CS | BB | SO | AVG | OBP | SLG | OPS | OPS+
```

Expanded fields:

```text
HBP | SH | SF | GIDP | TB
```

A field appearing in this target contract does not mean current sources populate it. The feasibility audit is authoritative for current-source coverage.

## Pitching contract

```ts
interface PitchingSeasonCard {
  games: number | null;                    // G
  gamesStarted: number | null;             // GS
  gamesFinished: number | null;            // GF
  completeGames: number | null;             // CG
  shutouts: number | null;                  // SHO
  saves: number | null;                     // SV
  wins: number | null;                      // W
  losses: number | null;                    // L

  inningsPitchedOuts: number | null;
  inningsPitchedDisplay: string | null;
  battersFaced: number | null;              // BF
  hitsAllowed: number | null;               // H
  runsAllowed: number | null;                // R
  earnedRuns: number | null;                // ER
  homeRunsAllowed: number | null;            // HR
  walksAllowed: number | null;               // BB
  intentionalWalks: number | null;           // IBB
  strikeouts: number | null;                 // SO
  hitBatters: number | null;                 // HBP
  wildPitches: number | null;                // WP
  balks: number | null;                      // BK

  earnedRunAverage: number | null;           // ERA
  whip: number | null;                       // WHIP
  strikeoutsPerNine: number | null;          // SO/9
  walksPerNine: number | null;               // BB/9
  strikeoutWalkRatio: number | null;         // SO/BB
  adjustedEraPlus: number | null;            // ERA+
  fieldingIndependentPitching: number | null; // FIP
  war: number | null;

  leagueLeaderFields: PitchingLeagueLeaderField[] | null;
}
```

Default reveal columns:

```text
Season | Age | Team | WAR | G | GS | W | L | SV | IP | ERA | WHIP | SO | BB | ERA+
```

Expanded fields:

```text
GF | CG | SHO | BF | H | R | ER | HR | IBB | HBP | WP | BK | SO/9 | BB/9 | SO/BB | FIP
```

Saves are confirmed in the current slim pitching source. Other fields are governed by the feasibility audit.

## Fielding summary

```ts
interface FieldingSeasonSummary {
  primaryPosition: string | null;
  positions: Array<{
    position: string;
    games: number | null;
  }>;
}
```

Detailed defensive metrics are not required for this implementation. Position history must still be canonical and must not be reconstructed independently by clients.

## Structured honors and awards

Awards are a desired product capability, but no award source is currently part of the checked-in canonical source manifest. The schema reserves a structured representation so future ingestion does not require redesign.

```ts
interface SeasonHonors {
  allStarSelections: HonorSelection[];
  awardWins: AwardWin[];
  awardVotingFinishes: AwardVotingFinish[];
  hallOfFameSeasonMarker: boolean;
}

interface HonorSelection {
  honor: "ALL_STAR";
  league: string | null;
}

interface AwardWin {
  award:
    | "MVP"
    | "CY_YOUNG"
    | "ROOKIE_OF_THE_YEAR"
    | "GOLD_GLOVE"
    | "SILVER_SLUGGER"
    | "COMEBACK_PLAYER_OF_THE_YEAR"
    | "OTHER";
  league: string | null;
  position: string | null;
  sourceLabel: string | null;
}

interface AwardVotingFinish {
  award: "MVP" | "CY_YOUNG" | "ROOKIE_OF_THE_YEAR" | "OTHER";
  league: string | null;
  finish: number;
  points: number | null;
  firstPlaceVotes: number | null;
  voteShare: number | null;
  sourceLabel: string | null;
}
```

Examples of presentation derived from this structure:

```text
MVP-1
MVP-5
CYA-2
GG
SS
AS
```

`MVP-5` means fifth in voting, not an MVP award win. These values remain unavailable until a source audit confirms licensing, coverage, freshness, and canonical-ID mapping.

## League leaders

Bold text means the player led the applicable league in that statistic during that season. It does not mean career best.

Leader metadata is not currently present in the checked-in artifacts. It may only be generated after the implementation validates league membership, ties, era-specific qualification rules, traded-player treatment, and completeness of the underlying field.

Unknown leader coverage is represented as `null`, not an empty array.

## Source and provenance rules

Every published field must be classified as:

- `source`: directly present in an approved source;
- `derived`: calculated from complete approved components;
- `unavailable`: part of the target schema but not currently supported;
- `not_applicable`: not meaningful for that record.

The current feasibility classification lives in `season-card-source-feasibility.md`.

WAR, OPS+, ERA+, FIP, awards, voting finishes, All-Star selections, and league-leader metadata require additional proof before implementation. No PR may claim those fields are populated until it identifies the source, confirms legal and reproducible use, measures coverage, maps player IDs, and validates samples.

Do not combine Baseball-Reference WAR and FanGraphs WAR under one undifferentiated `war` field.

## Derived-stat ownership

The baseball-data layer may derive a statistic only when all required source components are available and the formula is valid for the covered era.

Examples:

- AVG from H and AB;
- total bases and SLG from hit components and AB;
- OPS only when OBP and SLG are valid;
- ERA from earned runs and outs;
- WHIP from walks, hits, and innings.

The UI never performs these calculations.

## Missing-data policy

- Unknown is `null`, never `0`.
- A real zero remains `0`.
- Missing batting or pitching sections are `null`.
- Rate stats with no valid denominator are `null`.
- Empty award arrays mean confirmed no entries only when award-source coverage is complete.
- Unknown awards are represented by `honors: null` or explicit incomplete provenance.
- Unknown leader coverage is `null`.
- Clients display an em dash for unknown scalar values.

## Validation requirements

The generator must reject or report:

- duplicate `(canonicalPlayerId, season)` records;
- duplicate teams within one season;
- unknown canonical player IDs;
- invalid season years or ages;
- impossible negative counting statistics;
- `hits > atBats`;
- component hits exceeding total hits;
- saves greater than games finished when both are known;
- pitching workload not represented as whole outs;
- invalid rate-stat bounds;
- leader flags whose corresponding values are null;
- invalid award codes or non-positive voting finishes;
- duplicate award records for the same player, season, award, league, and position;
- two-way seasons split into competing top-level records;
- provenance claiming complete coverage when required fields are missing.

Generation must be deterministic and reconcile canonical season totals back to approved source rows.

## Implementation boundary

PR77 defines the target schema and documents actual current-source feasibility. The next implementation PR should populate only confirmed direct and safely derived fields and publish coverage and reconciliation results.

Advanced statistics, league leaders, and awards require a separate source audit before they are scheduled for ingestion. The live reveal migrates only after the implemented field set passes reconciliation.