# Canonical regular-season career peaks — data-only stage

## Scope contract

- **Goal:** Deterministically supply a career's highest regular-season HR and pitching K single-season totals (and years) from already accepted, pinned Lahman-backed canonical season cards.
- **Owning layer:** `packages/baseball-data` canonical career enrichment and runtime projection.
- **In scope:** Pure source-card aggregation, nullable derived values, deterministic earliest-year tie, canonical runtime optional projection, tests, provenance hash and canonical docs.
- **Out of scope:** MLB Stats API ingestion, Retrosheet import, additional source licenses, in-game clue types, live hint snapshots, scoring, UI, backend/DB, new external services, feature flags, and career-total or league-leader comparisons.
- **Acceptance:** Pure helper tests, strict canonical pipeline, source/provenance and nullable regression checks, typecheck, CI, READY Preview and independent review prior to merge.
- **Stop:** If source-derived seasons cannot be reliably attributed to a canonical player, or the change would alter already-issued frozen clues, stop and separate the decision.

## Architecture

The existing canonical season card is the authority for an entire regular season (including multiple teams). The career-enrichment builder selects the largest nonnegative integer for `batting.homeRuns` and `pitching.strikeouts` across the player's season cards. Equal highs choose the earliest year. Known zero is retained. Entirely unknown/unsupported counts stay `null`. Source hashes include the season-card artifact. Runtime only copies the validated fields, never recomputes a statistic, and the optional field preserves old schema-1 fixtures. No consumer is changed in this PR.

An external MLB Stats API integration is intentionally not proposed: publicly accessible endpoints do not establish bulk redistribution or commercial rights. Favor the pinned Lahman CC BY-SA source and independently licensed Retrosheet for separately approved future enrichment. No new external requests or external data are added by this change.

## Documentation impact

- Added this bounded plan.
- Updated canonical career enrichment and runtime-payload documentation with the new nullable data contract and immutable-hint exclusion.
