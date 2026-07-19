# Canonical Baseball Data Architecture

## Goal

Initial Baseball publishes one trusted, versioned database assembled from external baseball sources. The game never treats an external source row as an app player and never resolves identity at runtime.

The published data must guarantee:

- one stable Initial Baseball player ID per actual person;
- one approved display name per person;
- searchable aliases that do not create duplicate visible results;
- coherent career and season statistics attached to the same player identity;
- hints and reveal data generated from the same approved statistical facts;
- reproducible annual updates with reviewable differences;
- historical puzzles that continue to resolve after later data releases.

## Source responsibilities

### Lahman

Primary source for MLB player records and historical structured statistics:

- baseball-facing first and last names;
- batting seasons and team stints;
- pitching seasons and team stints;
- appearances and positions;
- team history;
- career-year support;
- Hall of Fame support where used by the product.

### Chadwick Register

Crosswalk and identity-evidence source:

- Chadwick UUID;
- Baseball-Reference, Retrosheet, MLB and other external IDs;
- legal, alternate and historical names;
- evidence for linking records across sources.

Chadwick rows do not automatically become Initial Baseball players and do not automatically choose the visible display name.

### Initial Baseball editorial data

Durable product decisions:

- approved display-name overrides;
- approved searchable aliases;
- identity merges and splits;
- source-mapping corrections;
- Daily eligibility overrides;
- recognizability adjustments;
- exclusions and review notes.

Generated JSON is never edited directly.

## Canonical schema

The first implementation may use SQLite or DuckDB during generation and publish JSON artifacts. The logical schema must remain relational so it can later move into Postgres without redesign.

### players

One row per actual person.

- `player_id`: stable Initial Baseball ID;
- `display_name`: approved visible baseball name;
- `birth_date`: nullable source-backed date;
- `debut_year` and `final_year`;
- `primary_role`;
- `primary_position`;
- `record_status`: approved, review, excluded or retired redirect;
- `created_release_id` and `updated_release_id`.

The ID is not derived from a name and is not replaced when an external source changes its identifier.

### player_external_ids

One row per external mapping.

- `player_id`;
- `source`;
- `external_id`;
- `match_method`;
- `match_confidence`;
- `review_status`.

A unique constraint prevents the same `(source, external_id)` from mapping to more than one active canonical player.

### player_names

One row per name or alias.

- `player_id`;
- `name`;
- `normalized_name`;
- `name_type`: display, common, legal, nickname, historical, alternate spelling or unverified;
- `source`;
- `is_searchable`;
- `is_approved`.

Only one approved display name may exist for an active player. Unverified aliases are not searchable.

### batting_stints and pitching_stints

Source facts at their natural grain:

- `player_id`;
- `season`;
- `team_id`;
- `stint`;
- raw counting statistics;
- source and source release.

Batting and pitching are independent. A player may have either or both.

### appearances

Structured position and team appearances by player, season, team and position.

### editorial_player_settings

Product-owned settings:

- Daily eligibility tier;
- recognizability adjustment;
- force include or exclude;
- display-name override;
- editor, reason and audit timestamps.

### data_releases

Immutable publication metadata:

- `release_id`;
- `stats_through_season`;
- source versions and checksums;
- schema version;
- generation commit;
- publication status and timestamp.

### player_id_redirects

Compatibility mappings from retired IDs to active canonical IDs.

This includes current Chadwick-based app IDs during migration.

## Identity resolution

Identity is resolved once during ingestion.

Match evidence is ranked:

1. exact strong external-ID agreement;
2. multiple independent strong IDs;
3. reviewed mapping override;
4. name, birth information and non-conflicting career overlap only as an ambiguous candidate.

Weak name matching never publishes automatically. Ambiguous candidates enter the review queue.

Several Chadwick records may map to one canonical player. One Chadwick record may not map to several active canonical players.

Identity decisions persist across annual source refreshes. A later run reuses the existing mapping unless a reviewed merge or split changes it.

## Display names

Display-name precedence:

1. approved Initial Baseball override;
2. Lahman baseball-facing name;
3. approved reviewed fallback.

The generator does not infer production surnames by removing or preserving tokens such as `de`, `la` or `cruz`.

Examples:

- David Arias Ortiz remains a searchable alias for the canonical display name David Ortiz.
- Emmanuel De La Cruz Clase must not display unless explicitly approved; the canonical display name is Emmanuel Clase.
- Elly De La Cruz retains the full surname because that is the source-backed baseball-facing name.

## Statistics

The canonical layer stores raw numbers, not only formatted strings.

Examples:

- innings are stored as outs;
- hits, at-bats, walks, sacrifice flies and earned runs are integers;
- missing historical values are null, not automatically zero;
- rate statistics are calculated from aggregate components.

Player-season totals are derived from stints. Career totals are derived from player-season facts. Career and season outputs do not perform separate identity matching.

Required reconciliation checks include:

- career counting totals equal included season totals;
- rates recalculate correctly from aggregate components;
- duplicate stints are rejected;
- combined rows are not double-counted;
- debut/final years agree with the accepted appearance history;
- two-way players retain both batting and pitching records.

## Search contract

Search operates only on canonical players.

- One result per canonical `player_id`.
- Visible text always uses the approved display name.
- Approved aliases may cause a match but never create a second result.
- Same-name people remain separate and receive career context for disambiguation.
- Selecting one same-name person cannot count as selecting another.
- One-character queries return no results.
- Two-character queries use display-name prefixes only.
- Exact and prefix display-name matches rank ahead of aliases.
- Search normalization is accent- and punctuation-tolerant.
- Every result has a deterministic match reason for testing and debugging.

The current `acceptedPlayerIds` grouping by visible name is a migration workaround and must be removed after canonical IDs are live.

## Hints and reveal data

Hints and reveals are generated from the same approved release and canonical player ID.

The publication layer derives:

- career years and primary decade;
- team history and primary team;
- position history and primary position;
- career batting and pitching facts;
- season-by-season batting and pitching facts;
- Daily hint values;
- recognizability inputs.

A player cannot be Daily eligible unless required hint and reveal fields pass validation.

## Published artifacts

The serving layer may publish separate optimized artifacts:

- `players.json`;
- `player-search-index.json`;
- `player-career-stats.json`;
- `player-season-stats.json`;
- `player-hint-profiles.json`;
- `player-source-mappings.json`;
- `player-id-redirects.json`;
- `data-release-manifest.json`;
- `data-audit-report.json` and Markdown summary.

These are views of one logical canonical release, not independent databases.

## Puzzle compatibility

Published puzzles store:

- puzzle date and number;
- immutable selected canonical player IDs;
- data release ID;
- publication status.

Published puzzles are not regenerated from a later player pool. Old IDs resolve through the redirect table.

## Release gates

A candidate release cannot publish unless:

1. no external ID maps to multiple active players;
2. no canonical player appears twice in search;
3. same-name people are not merged merely by name;
4. all Daily-eligible players have valid hint and reveal data;
5. career and season totals reconcile within documented historical exceptions;
6. ambiguous identity candidates are reviewed or excluded;
7. known-player regression fixtures pass;
8. historical puzzles resolve through canonical IDs or redirects;
9. search relevance fixtures pass;
10. output is deterministic for identical inputs;
11. the audit diff is reviewed;
12. code and data can roll back together.

## Migration sequence

1. Audit the current generated dataset without behavior changes.
2. Introduce canonical IDs, external mappings and redirects.
3. Build one unified raw-stat fact pipeline.
4. Apply approved names and editorial overrides.
5. Generate versioned serving artifacts.
6. Migrate search, hints, reveal and Daily selection to canonical IDs.
7. Pin published puzzles to immutable player IDs and release IDs.
8. Add the annual candidate-build, review and publish workflow.
9. Remove transitional display-name normalization and `acceptedPlayerIds` grouping.
