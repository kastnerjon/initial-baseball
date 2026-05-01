# @initial-baseball/baseball-data

Player data ingestion and normalization helpers.

## Current generated dataset

`baseballPlayers` is currently a broad Chadwick-derived search universe.

- It is suitable for player name search and canonical player identity lookup.
- It is enriched from a committed Lahman subset for `primaryRole`, `primaryPosition`, appearance-weighted `mainDecade`, appearance-weighted `primaryTeam`, `teamsDisplay`, career `statsLine`, and default Daily eligibility metadata where matching data is available.
- It is primarily built around MLB players with post-1950 played-year coverage, plus inducted Hall of Fame players even when they played before 1950.
- It is not yet a complete gameplay-ready hint dataset.
- Some generated players still fall back to placeholder values when Lahman coverage or matching is incomplete.
- `bWAR` is still not included.

Field notes:

- `mainDecade` now prefers the Lahman decade with the most appearance-weighted games.
- `primaryTeam` is the appearance-weighted team with the most games played.
- `teamsDisplay` remains the chronological team-list display field rather than a primary-team field.
- `dailyEligibilityTier` is a generated product heuristic rather than a claim of objective player value.
- Inducted Hall of Fame players in the `Player` category are force-included in the generated universe and force-assigned to the `core` Daily eligibility tier.
- Non-player Hall of Fame categories such as managers, executives, and umpires are excluded from that Hall-of-Fame inclusion rule.

## Daily-eligible exports

- `baseballPlayers` is the full searchable and guessable player universe.
- `dailyEligiblePlayers` is the generated Daily-answer pool (`core` + `extended`).
- `coreDailyEligiblePlayers` is the safest default Daily-answer pool.
- `extendedDailyEligiblePlayers` is a harder-but-still-plausible future/custom-answer pool.
- Search can still use the full `baseballPlayers` universe, while Daily answer selection should use `dailyEligiblePlayers` or `coreDailyEligiblePlayers`.
- The current `core` / `extended` / `none` thresholds are a starting product heuristic, and we expect future admin or editorial overrides to force-include or force-exclude specific players.

## Future enrichment

Before this dataset should drive full gameplay hints directly, it still needs richer enrichment for:

- `bWAR` and any Baseball Reference-specific enrichment
- broader coverage cleanup for remaining fallback teams/position/role matches
- any later refinement or override layer for generated default gameplay hints
- editorial override support for Daily eligibility

Principles:

- Gameplay never calls external baseball APIs live.
- Data is imported/normalized into our own Postgres tables.
- Store canonical players, aliases, teams, main decade, positions, career stats, and bWAR if sourced from Baseball Reference.
- Missing stats should be nullable and editable in pitcher-submitted hints.
- Generated Lahman statlines are suitable as default gameplay hints, but can be refined or overridden later.
