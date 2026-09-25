# Permanent Daily issued-puzzle v2 envelope

Status: implemented portable schema-v2 envelope; provider persistence and server issuance are implemented in follow-on steps.

## Goal

Define the clue-frozen schema-v2 permanent issued-puzzle record. At this contract step, the existing schema-v1 Supabase repository remained unchanged; provider and server issuance support were added in separate follow-on steps.

## Compatibility strategy

- Existing `PermanentDailyIssuedPuzzle`, its schema-v1 constant, factory, issuance service, repository port, and read port remain unchanged.
- New `PermanentDailyClueFrozenIssuedPuzzle` is schema version 2 and carries the already-validated immutable clue snapshot.
- `PermanentDailyIssuedPuzzleRecord` is the portable v1/v2 union adopted by the append-only storage codec and repository.
- The v2 factory reuses v1 identity/date/order validation, normalizes `issuedAt`, defensively clones the clue snapshot, and requires each clue pitch's canonical player ID to match the frozen batting order at the same position.
- A shared record clone handles v1 and v2 without sharing clue arrays.

## Why this is separate

Widening the repository port before the database and codec supported schema v2 would have made the provider contract untruthful. Conversely, changing Supabase first would have required a domain shape that did not yet exist. This contract established that shape; later PRs added persistence and server issuance while keeping archive materialization as a separate v2 consumer change.

## Scoring boundary

The v2 envelope contains the clue snapshot, but that snapshot deliberately contains no ruleset, outcome mapping, points, or scoring values. Permanent replay scoring remains selected when a new play begins.

## Out of scope

No Supabase migration, hosted schema change, row-codec change, repository widening, issuance cutover, archive materialization change, Jr/Sr initials change, scoring change, launch epoch, archive route, or permanent row creation.

## Acceptance

- Existing v1 tests remain unchanged and green.
- New tests prove v2 creation, exact canonical-ID alignment, v1 compatibility, and deep cloning.
- Full repository CI/data/build checks and exact-head Preview pass.
- Hosted permanent table remains unchanged and empty.

## Provider persistence checkpoint

Append-only Supabase storage and the strict server row codec support v1 and v2 records while preserving service-role SELECT/INSERT-only access, RLS, existing v1 decoding, first-write-wins semantics, and the zero-row posture. The archive-facing read service returns defensive copies of both versions, and archive materialization consumes persisted v2 clues while retaining v1 reads. Scope: `tasks/plans/permanent-daily-archive-clue-materialization.md`.

Scope: `tasks/plans/permanent-daily-issued-puzzle-v2-supabase.md`.

## Current status and next boundary

The server issuance composition materializes the authorized public clue bundle through the current gameplay lookup/pitch/hint path and stores schema-v2 records. Scope: `tasks/plans/permanent-daily-server-clue-issuance.md`. Archive consumption is now complete in `tasks/plans/permanent-daily-archive-clue-materialization.md`; there is still no archive public route or configured launch epoch.
