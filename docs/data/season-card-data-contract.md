# Season Card Data Contract

## Purpose

The reveal should feel like the back of a Baseball-Reference-style baseball card while remaining a stable data product for web, mobile, search, admin, and future game modes.

The canonical contract is deliberately broader than the first UI. The baseball-data layer owns complete season facts and presentation metadata. Each client chooses a documented subset to display, but clients do not calculate baseball facts, combine teams, infer league leaders, or replace missing values.

## Record grain

One canonical season card record represents one player in one major-league season.

Canonical key:

```text
(canonicalPlayerId, season)
```

A player traded during a season still has one record. Team history is an ordered, duplicate-free array. Batting and pitching remain independent nested sections so two-way players can carry both without duplicate player-season records.

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
  honors: SeasonHonors;
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

`teams` is never silently replaced with a synthetic `TOT` team. A presentation layer may display `TOT` in addition to the real teams, but the canonical record preserves every actual team.

## Batting fields

The canonical batting section contains all fields we currently expect to need for the default card, expanded card, league-leader styling, validation, and career derivation.

```ts
interface BattingSeasonCard {
  games: number | null;                 // G
  plateAppearances: number | null;      // PA
  atBats: number | null;                // AB
  runs: number | null;                  // R
  hits: number | null;                  // H
  doubles: number | null;               // 2B
  triples: number | null;               // 3B
  homeRuns: number | null;              // HR
  runsBattedIn: number | null;          // RBI
  stolenBases: number | null;           // SB
  caughtStealing: number | null;        // CS
  walks: number | null;                 // BB
  strikeouts: number | null;            // SO
  hitByPitch: number | null;             // HBP
  sacrificeHits: number | null;         // SH
  sacrificeFlies: number | null;        // SF
  groundedIntoDoublePlays: number | null; // GIDP

  battingAverage: number | null;        // BA / AVG
  onBasePercentage: number | null;      // OBP
  sluggingPercentage: number | null;    // SLG
  onBasePlusSlugging: number | null;    // OPS
  adjustedOpsPlus: number | null;       // OPS+
  totalBases: number | null;            // TB

  war: number | null;
  leagueLeaderFields: BattingLeagueLeaderField[];
}

type BattingLeagueLeaderField =
  | "games"
  | "plateAppearances"
  | "atBats"
  | "runs"
  | "hits"
  | "doubles"
  | "triples"
  | "homeRuns"
  | "runsBattedIn"
  | "stolenBases"
  | "caughtStealing"
  | "walks"
  | "strikeouts"
  | "hitByPitch"
  | "sacrificeHits"
  | "sacrificeFlies"
  | "groundedIntoDoublePlays"
  | "battingAverage"
  | "onBasePercentage"
  | "sluggingPercentage"
  | "onBasePlusSlugging"
  | "adjustedOpsPlus"
  | "totalBases"
  | "war";
```

### Batting display sets

Default reveal columns:

```text
Season | Age | Team | WAR | G | PA | AB | R | H | 2B | 3B | HR | RBI | SB | BB | SO | BA | OBP | SLG | OPS | OPS+
```

This matches the useful subset of the reference shown by the product owner. On narrow screens, the initial viewport may prioritize:

```text
Season | Age | Team | WAR | G | HR | RBI | BA | OBP | SLG | OPS
```

The remaining default columns remain horizontally scrollable rather than being removed from the data contract.

Expanded batting fields:

```text
CS | HBP | SH | SF | GIDP | TB
```

## Pitching fields

```ts
interface PitchingSeasonCard {
  games: number | null;                 // G
  gamesStarted: number | null;          // GS
  gamesFinished: number | null;         // GF
  completeGames: number | null;         // CG
  shutouts: number | null;              // SHO
  saves: number | null;                 // SV
  wins: number | null;                  // W
  losses: number | null;                // L

  inningsPitchedOuts: number | null;    // canonical workload storage
  inningsPitchedDisplay: string | null; // derived presentation value, e.g. 212.2
  battersFaced: number | null;           // BF
  hitsAllowed: number | null;            // H
  runsAllowed: number | null;            // R
  earnedRuns: number | null;             // ER
  homeRunsAllowed: number | null;        // HR
  walksAllowed: number | null;           // BB
  intentionalWalks: number | null;      // IBB
  strikeouts: number | null;             // SO
  hitBatters: number | null;             // HBP
  wildPitches: number | null;            // WP
  balks: number | null;                  // BK

  earnedRunAverage: number | null;      // ERA
  whip: number | null;                  // WHIP
  strikeoutsPerNine: number | null;     // SO/9
  walksPerNine: number | null;          // BB/9
  strikeoutWalkRatio: number | null;    // SO/BB
  adjustedEraPlus: number | null;       // ERA+
  fieldingIndependentPitching: number | null; // FIP, when sourced consistently

  war: number | null;
  leagueLeaderFields: PitchingLeagueLeaderField[];
}

type PitchingLeagueLeaderField =
  | "games"
  | "gamesStarted"
  | "gamesFinished"
  | "completeGames"
  | "shutouts"
  | "saves"
  | "wins"
  | "losses"
  | "inningsPitchedOuts"
  | "battersFaced"
  | "hitsAllowed"
  | "runsAllowed"
  | "earnedRuns"
  | "homeRunsAllowed"
  | "walksAllowed"
  | "intentionalWalks"
  | "strikeouts"
  | "hitBatters"
  | "wildPitches"
  | "balks"
  | "earnedRunAverage"
  | "whip"
  | "strikeoutsPerNine"
  | "walksPerNine"
  | "strikeoutWalkRatio"
  | "adjustedEraPlus"
  | "fieldingIndependentPitching"
  | "war";
```

### Pitching display sets

Default reveal columns:

```text
Season | Age | Team | WAR | G | GS | W | L | SV | IP | ERA | WHIP | SO | BB | ERA+
```

Expanded pitching fields:

```text
GF | CG | SHO | BF | H | R | ER | HR | IBB | HBP | WP | BK | SO/9 | BB/9 | SO/BB | FIP
```

## Fielding and position summary

Fielding is not part of the initial visible reveal table, but the season contract reserves a compact summary so position history does not need to be reconstructed later.

```ts
interface FieldingSeasonSummary {
  primaryPosition: string | null;
  positions: Array<{
    position: string;
    games: number | null;
  }>;
}
```

Detailed fielding metrics, defensive WAR, catcher statistics, and position-specific advanced metrics are deferred. They must not be invented from appearances alone.

## Honors and visual markers

```ts
interface SeasonHonors {
  allStar: boolean | null;
  awards: string[];
  hallOfFameSeasonMarker: boolean;
}
```

Award data is optional in the first implementation. Missing award coverage is represented as `null` or an empty list according to source coverage; it is never inferred from bolded statistics.

## League-leader behavior

Bold text means the player led the applicable league in that field during that season. It does not mean the value was the player's career best.

Rules:

1. Leader status is computed or imported in the baseball-data layer.
2. The comparison scope is the player's actual league for that season, not all MLB, unless the source explicitly defines an MLB-wide leader.
3. Ties count as league-leading.
4. Rate-stat qualification rules must follow the authoritative source for that era.
5. A traded player who appeared in multiple leagues may only receive a leader flag when the authoritative source identifies the combined season as a league-leading season under its rules.
6. The UI receives explicit `leagueLeaderFields` and only formats those values in bold.
7. `false` and `unknown` must remain distinct during ingestion. Published arrays contain confirmed leader fields; provenance records whether leader coverage is complete.

## WAR and advanced-stat provenance

WAR is required by the product contract but is not present in the current compact Lahman-derived inputs. The implementation must choose one WAR family and use it consistently for all batting and pitching seasons. It must not combine Baseball-Reference WAR and FanGraphs WAR under one `war` field.

Until a licensed, reproducible source is approved:

- `war` remains `null`;
- the pipeline reports WAR coverage explicitly;
- the UI displays an em dash for missing WAR;
- no substitute statistic is labeled WAR;
- source-specific WAR may later be represented as `bwar` or `fwar` if the product intentionally supports multiple definitions.

The same rule applies to OPS+, ERA+, FIP, WHIP, awards, and league-leader metadata when the current source does not provide enough information to derive them reliably.

## Derived-stat ownership

The baseball-data layer may derive a statistic only when all required source inputs are available and the formula is historically valid for the covered seasons.

Examples:

- BA = H / AB when AB is nonzero.
- SLG derives from total bases and AB.
- OPS = OBP + SLG.
- ERA derives from earned runs and outs recorded.
- WHIP derives from walks, hits, and innings.

Derived values are stored or emitted with provenance and tested against known examples. The UI never performs these calculations.

## Missing-data policy

- Unknown is `null`, never `0`.
- A real zero remains `0`.
- Empty team history is allowed only when the source gap is documented and emitted as a warning.
- A missing batting or pitching section is `null`, not an object filled with nulls.
- Rate stats with no valid denominator are `null`.
- Display formatting uses an em dash for `null`.
- No client may infer a missing value from unrelated career totals.

## Validation requirements

The future generator must reject or report:

- duplicate `(canonicalPlayerId, season)` records;
- duplicate teams within one season;
- unknown canonical player IDs;
- invalid season years or ages;
- negative counting statistics where impossible;
- `hits > atBats`;
- component hits exceeding total hits;
- saves greater than games finished when both are known;
- pitching workload not represented as whole outs;
- rate statistics outside physically possible bounds;
- league-leader fields whose corresponding value is null;
- league-leader fields not allowed for that batting or pitching section;
- a two-way season split into competing top-level records;
- provenance claiming complete coverage when required fields are missing.

The generator must reconcile canonical season totals back to their source rows and remain deterministic across repeated runs.

## Example: normal hitter season

```json
{
  "canonicalPlayerId": "player-david-ortiz",
  "season": 2006,
  "age": 30,
  "teams": [{ "teamId": "BOS", "abbreviation": "BOS", "displayName": "Boston Red Sox", "league": "AL", "order": 1 }],
  "leagues": ["AL"],
  "batting": {
    "games": 151,
    "plateAppearances": 686,
    "atBats": 558,
    "runs": 115,
    "hits": 160,
    "doubles": 29,
    "triples": 2,
    "homeRuns": 54,
    "runsBattedIn": 137,
    "stolenBases": 1,
    "caughtStealing": 0,
    "walks": 119,
    "strikeouts": 117,
    "hitByPitch": null,
    "sacrificeHits": null,
    "sacrificeFlies": null,
    "groundedIntoDoublePlays": null,
    "battingAverage": 0.287,
    "onBasePercentage": 0.413,
    "sluggingPercentage": 0.636,
    "onBasePlusSlugging": 1.049,
    "adjustedOpsPlus": null,
    "totalBases": null,
    "war": null,
    "leagueLeaderFields": ["homeRuns", "runsBattedIn", "walks"]
  },
  "pitching": null,
  "fielding": null,
  "honors": { "allStar": null, "awards": [], "hallOfFameSeasonMarker": false },
  "provenance": {
    "sourceIds": [],
    "coverage": "partial",
    "notes": ["Illustrative values; advanced-stat source not yet approved"]
  }
}
```

The example illustrates shape and formatting only. Production leader flags and advanced values must come from approved reproducible source logic.

## Example: traded player

```json
{
  "canonicalPlayerId": "player-example",
  "season": 2016,
  "age": 28,
  "teams": [
    { "teamId": "NYY", "abbreviation": "NYY", "displayName": "New York Yankees", "league": "AL", "order": 1 },
    { "teamId": "CHC", "abbreviation": "CHC", "displayName": "Chicago Cubs", "league": "NL", "order": 2 }
  ],
  "leagues": ["AL", "NL"],
  "batting": null,
  "pitching": { "leagueLeaderFields": [] },
  "fielding": null,
  "honors": { "allStar": null, "awards": [], "hallOfFameSeasonMarker": false },
  "provenance": { "sourceIds": [], "coverage": "partial", "notes": [] }
}
```

The abbreviated pitching object above is illustrative; a generated record must include the full typed shape.

## Source-coverage inventory

Before implementation, every field must be classified as one of:

- `source`: directly supplied by an approved source;
- `derived`: calculated in the baseball-data layer from sufficient approved inputs;
- `external-required`: desired but absent from current Lahman-derived inputs;
- `deferred`: intentionally outside the first implementation.

The implementation PR must publish a machine-readable or documented coverage matrix. At minimum, it must call out WAR, OPS+, ERA+, FIP, league-leader flags, awards, complete team history, and historical rate-stat inputs.

## Initial implementation order

1. Produce the complete typed season-card schema and coverage matrix.
2. Populate all available counting stats and team history from canonical season aggregates.
3. Derive safe rate stats in the baseball-data layer.
4. Select and integrate one reproducible source for WAR and advanced metrics.
5. Generate league-leader metadata using authoritative league and qualification rules.
6. Add serving artifacts and migrate the reveal UI only after reconciliation passes.

This contract does not switch the live game or reveal screen. It defines the target that those systems will consume.