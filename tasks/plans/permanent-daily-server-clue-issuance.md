# Permanent Daily server clue issuance

Status: implemented server-side issuance cutover.

## Scope contract

- **Goal:** make the server issuance path persist the exact public clues that current Daily gameplay would show when a permanent puzzle is first issued.
- **Owning layer:** server-only composition in `apps/web`.
- **In scope:** an independently testable clue-snapshot materializer using the canonical Daily player lookup, `createDailyPuzzlePitch`, and `DEFAULT_DAILY_HINT_CONFIG`; switching the server composition from portable schema-v1 issuance to schema-v2 clue-frozen issuance; focused tests; and canonical documentation updates.
- **Out of scope:** archive materialization, routes, scheduler/launch-epoch configuration, permanent row creation for testing, scoring, initials semantics, identity/name/alias changes, and hint-format changes.
- **Acceptance checks:** exact editorial order, current public initials, four configured hint types/labels/values, structured hint-4 values including pitcher save availability semantics, fail-closed resolution and malformed-hint behavior before persistence, v2-only server writes, and exact retry idempotency preserving the first `issuedAt`.
- **Stop conditions:** any need to alter player facts, hint content, scoring, database schema/privileges, archive reads, or launch policy is a separate decision and PR.

## Architecture

The materializer receives the ordered canonical IDs selected by the editorial row. It resolves each ID through the same canonical Daily lookup as gameplay and delegates identity/initials/hint construction to `createDailyPuzzlePitch`. It reads each configured hint value using the shared `DEFAULT_DAILY_HINT_CONFIG`, then creates the portable immutable clue snapshot. `packages/daily` remains responsible for editorial eligibility/order and snapshot-to-lineup validation; the Supabase repository remains the append-only persistence boundary.

No second initials algorithm or hint formatter is introduced. Clue values are fully materialized before persistence, so any missing player or malformed configured hint fails closed without writing. Scoring is intentionally absent from the snapshot.

## Next bounded concern

Archive reads now consume persisted schema-v2 clues instead of rebuilding them from current player data. Scope: `tasks/plans/permanent-daily-archive-clue-materialization.md`.

## Implemented behavior

`materializePermanentDailyIssuedClueSnapshot` resolves ordered canonical IDs through the canonical Daily player lookup, calls `createDailyPuzzlePitch`, and extracts the current shared four-hint layout and values. It rejects unavailable players, blank/missing initials, and blank/missing hint values before the issuance repository is called. The server composition delegates the resulting snapshot to the portable schema-v2 service. Focused integration tests cover reversed editorial selection storage, exact clue order and values, sourced `SV 0` versus unavailable saves, fail-closed materialization, schema-v2-only writes, and exact retry behavior preserving the first `issuedAt`.
