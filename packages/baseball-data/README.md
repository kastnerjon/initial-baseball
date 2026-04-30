# @initial-baseball/baseball-data

Player data ingestion and normalization helpers.

## Current generated dataset

`baseballPlayers` is currently a broad Chadwick-derived search universe.

- It is suitable for player name search and canonical player identity lookup.
- It is enriched from a committed Lahman subset for `primaryRole`, `primaryPosition`, and `teamsDisplay` where matching data is available.
- It is not yet a complete gameplay-ready hint dataset.
- Some generated players still fall back to placeholder values when Lahman coverage or matching is incomplete.

## Future enrichment

Before this dataset should drive full gameplay hints directly, it still needs richer enrichment for:

- career stats, including `bWAR` where sourced
- broader coverage cleanup for remaining fallback teams/position/role matches

Principles:

- Gameplay never calls external baseball APIs live.
- Data is imported/normalized into our own Postgres tables.
- Store canonical players, aliases, teams, main decade, positions, career stats, and bWAR if sourced from Baseball Reference.
- Missing stats should be nullable and editable in pitcher-submitted hints.
