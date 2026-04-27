# @initial-baseball/baseball-data

Player data ingestion and normalization helpers.

Principles:

- Gameplay never calls external baseball APIs live.
- Data is imported/normalized into our own Postgres tables.
- Store canonical players, aliases, teams, main decade, positions, career stats, and bWAR if sourced from Baseball Reference.
- Missing stats should be nullable and editable in pitcher-submitted hints.
