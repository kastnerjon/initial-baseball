# Player Data / ETL Spec

## Principle

Gameplay must not depend on live third-party baseball API calls.

Import and normalize data into our own database before gameplay.

## Required player fields

- canonical `player_id`
- full name
- display name
- aliases/nicknames
- primary role: hitter, pitcher, two-way
- primary position
- main decade played in
- teams display
- career stats

## Required career stats

Hitter fields:

- bWAR
- HR
- RBI
- BA
- OBP
- SLG
- OPS
- SB

Pitcher fields:

- bWAR
- W
- L
- ERA
- WHIP
- K
- SV
- IP

If WAR comes from Baseball Reference, label as `bWAR`.

## Import stance

Possible sources can include pybaseball, Lahman/Chadwick-style IDs, Baseball Reference-derived data, or curated CSVs. Final product should store normalized data in `players`, `player_aliases`, and `player_career_stats`.

## Human correction layer

Because baseball data has ambiguity/missing values, pitcher-submitted hints are editable before submission.

Store both:

- `auto_hints`
- `submitted_hints`

This lets us distinguish DB issues from pitcher edits.
