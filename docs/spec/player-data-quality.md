# Player data quality and canonical identity

Status: Living source of truth
Last updated: 2026-07-18

## Goal

Daily Inning must present one understandable, trustworthy representation of each real player. Source datasets may contain duplicate identifiers, formal legal names, middle names, spelling variants, accents, incomplete careers, and conflicting records. Those source irregularities must not leak directly into lineup selection, search, hints, or reveal cards.

## Core identity model

Each real player should have:

- one internal canonical player identity
- one stable canonical `playerId`
- one user-facing `displayName`
- an optional full/source name retained for traceability
- zero or more searchable aliases
- linked source identifiers and provenance
- one normalized career record assembled from all accepted source rows

Source rows are evidence for a player; they are not automatically separate playable players.

## Display-name rules

The visible name should be the name by which baseball fans commonly know the player.

Examples of unwanted output include unnecessary middle names, formal birth names, suffix inconsistencies, or source-specific full names when the player is commonly known by a shorter baseball name.

Requirements:

- Preserve accents and normal punctuation in the displayed name.
- Search must also work without accents or punctuation.
- Middle names should not appear merely because a source contains them.
- Nicknames and common shortened names belong in aliases when they are not the display name.
- Suffixes such as Jr. or Sr. should be handled consistently.
- Manual display-name overrides must be stored as auditable data, not hardcoded in UI components.

## Duplicate resolution

The generation pipeline must detect and classify at least:

- multiple source rows with the same source identifier
- different identifiers that appear to represent the same real player
- duplicate normalized display names
- same-name players who are genuinely different people
- overlapping or conflicting career-year records
- duplicate players entering the Daily-eligible universe

Possible duplicates must never be merged using display name alone. Resolution should use available identifiers and evidence such as birth date, debut/final year, teams, position, and source lineage.

Confirmed duplicates should resolve to one canonical player. Genuine same-name players remain distinct canonical players and must be distinguishable in admin tooling, while the public search interface may group accepted IDs only when that is intentional and safe for answer validation.

## Career and season validation

Generated records must be checked for:

- first year later than last year
- implausible or disconnected career ranges
- season rows outside the canonical career range
- duplicate player-season-team rows
- conflicting hitter/pitcher roles
- missing or malformed teams, positions, and required hints
- impossible or non-finite derived statistics
- career totals that do not reconcile to accepted season rows where reconciliation is expected
- incorrect aggregation of multiple team stints in one season

A failed critical validation should stop generation. Lower-confidence anomalies should be emitted into a review report.

## Quality-report workflow

`packages/baseball-data` should generate a deterministic data-quality report containing:

- unresolved likely duplicates
- normalized-name collisions
- suspicious display names
- career-year anomalies
- missing required Daily fields
- stat reconciliation failures
- manual overrides and the reason for each override

The report should be reviewable before a new baseball-data artifact is accepted. The pipeline should expose separate commands for generation and verification so CI can confirm committed artifacts match source inputs and approved overrides.

## Editorial and admin behavior

The future admin lineup editor should show enough identifying information to avoid selecting the wrong same-name player:

- display name
- canonical player ID
- career years
- primary position or role
- primary teams

It should warn when a candidate has unresolved data-quality flags or incomplete reveal data.

## Implementation sequence

1. Inventory current generated duplicates, name collisions, and career-range anomalies.
2. Define the canonical identity and alias artifact format.
3. Move all player normalization and overrides under `packages/baseball-data`.
4. Add deterministic duplicate detection and validation tests.
5. Add an auditable override file for display names, aliases, merges, and intentional non-merges.
6. Regenerate player, search, career, and season artifacts from canonical identities.
7. Verify Daily lineup generation and historical overrides still resolve correctly.
8. Add the quality report to CI and the future admin workflow.

## Completion criteria

Player-data cleanup is complete enough for launch when:

- one real player does not appear as multiple indistinguishable Daily candidates
- common searches return the expected baseball name without exposing odd source-only middle names
- genuine same-name players remain safely distinct
- career years and season rows pass automated consistency checks
- every manual correction is centralized, documented, and reproducible
- regenerated artifacts and tests are deterministic

## Change rule

This specification and the normalization implementation must be updated together whenever canonical identity, display-name, alias, merge, or validation behavior changes.