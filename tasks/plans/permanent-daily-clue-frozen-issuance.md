# Permanent Daily clue-frozen issuance

Status: implemented portable schema-v2 issuance boundary.

## Scope contract

- **Goal:** allow portable permanent issuance to store the already-defined clue-frozen schema-v2 record while keeping clue generation outside `packages/daily`.
- **Owning layer:** `packages/daily`.
- **In scope:** schema-v2 first-write-wins service, exact clue-snapshot immutable comparison, explicit v1/v2 collision handling, portable editorial issuance that accepts an already-materialized clue snapshot, focused tests, exports, and canonical documentation.
- **Out of scope:** resolving canonical player facts, formatting initials/hints, Supabase changes, server composition cutover, archive materialization, launch epoch configuration, initials changes, scoring, routes, or permanent row creation.
- **Acceptance checks:** exact v2 retry is idempotent while preserving the first issue timestamp; any frozen clue change conflicts; an existing v1 row conflicts with a v2 request; editorial date/status/slot rules remain unchanged; clue canonical IDs must match the frozen editorial order.
- **Stop conditions:** web/player-data clue materialization or archive replay consumption belongs in later PRs.

## Contract

`createPermanentDailyClueFrozenIssuedPuzzleService` applies the same append-only first-write-wins semantics as the retained schema-v1 service, but immutable equality includes the complete clue snapshot. `issuedAt` is not part of retry identity, so an exact later retry returns the first stored timestamp.

`createPermanentDailyClueFrozenIssuanceService` reuses the existing editorial eligibility/order validation, then delegates the ordered canonical IDs plus caller-supplied clue snapshot to the schema-v2 store service. The schema-v2 factory remains responsible for proving each clue pitch's canonical player ID matches the batting order.

The clue snapshot is already-materialized input by design. `packages/daily` does not import web adapters, generated baseball data, or hint formatters.

## Transitional compatibility

The existing schema-v1 issuance service remains exported for compatible callers. The server composition now uses schema v2. If a permanent identity already contains a v1 row, a v2 issuance attempt is an immutable conflict rather than an implicit upgrade.

## Follow-on boundary

The server-only web issuance composition has now been cut over to schema v2, materializing clues through the same canonical player lookup, `createDailyPuzzlePitch`, and shared Daily hint configuration used by runtime gameplay. Scope and tests: `tasks/plans/permanent-daily-server-clue-issuance.md`.

Archive materialization now consumes those persisted frozen clues while retaining v1 reads. Scope: `tasks/plans/permanent-daily-archive-clue-materialization.md`. Keep scoring, initials, and routes separate.
