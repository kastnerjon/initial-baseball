# @initial-baseball/baseball-data

Player data ingestion and normalization helpers.

## Current generated dataset

`baseballPlayers` is currently a broad Chadwick-derived search universe.

- It is suitable for player name search and canonical player identity lookup.
- It is enriched from a committed Lahman subset for `primaryRole`, `primaryPosition`, appearance-weighted `mainDecade`, appearance-weighted `primaryTeam`, `teamsDisplay`, and career `statsLine` where matching data is available.
- It is not yet a complete gameplay-ready hint dataset.
- Some generated players still fall back to placeholder values when Lahman coverage or matching is incomplete.
- `bWAR` is still not included.

Field notes:

- `mainDecade` now prefers the Lahman decade with the most appearance-weighted games.
- `primaryTeam` is the appearance-weighted team with the most games played.
- `teamsDisplay` remains the chronological team-list display field rather than a primary-team field.

## Future enrichment

Before this dataset should drive full gameplay hints directly, it still needs richer enrichment for:

- `bWAR` and any Baseball Reference-specific enrichment
- broader coverage cleanup for remaining fallback teams/position/role matches
- any later refinement or override layer for generated default gameplay hints

Principles:

- Gameplay never calls external baseball APIs live.
- Data is imported/normalized into our own Postgres tables.
- Store canonical players, aliases, teams, main decade, positions, career stats, and bWAR if sourced from Baseball Reference.
- Missing stats should be nullable and editable in pitcher-submitted hints.
- Generated Lahman statlines are suitable as default gameplay hints, but can be refined or overridden later.
