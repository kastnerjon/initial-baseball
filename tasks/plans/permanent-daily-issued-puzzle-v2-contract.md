# Permanent Daily issued-puzzle v2 envelope

Status: bounded portable-contract bridge between clue snapshot modeling and provider persistence.

## Goal

Define a clue-frozen schema-v2 permanent issued-puzzle record without claiming that the current schema-v1 Supabase repository can persist it yet.

## Compatibility strategy

- Existing `PermanentDailyIssuedPuzzle`, its schema-v1 constant, factory, issuance service, repository port, and read port remain unchanged.
- New `PermanentDailyClueFrozenIssuedPuzzle` is schema version 2 and carries the already-validated immutable clue snapshot.
- `PermanentDailyIssuedPuzzleRecord` is the portable union the next provider PR can adopt when its storage/codec is ready.
- The v2 factory reuses v1 identity/date/order validation, normalizes `issuedAt`, defensively clones the clue snapshot, and requires each clue pitch's canonical player ID to match the frozen batting order at the same position.
- A shared record clone handles v1 and v2 without sharing clue arrays.

## Why this is separate

Widening the current repository port before the database and codec support schema v2 would make the provider contract untruthful. Conversely, changing Supabase first would require a domain shape that does not yet exist. This PR establishes that shape while leaving all live issuance/read paths on v1.

## Scoring boundary

The v2 envelope contains the clue snapshot, but that snapshot deliberately contains no ruleset, outcome mapping, points, or scoring values. Permanent replay scoring remains selected when a new play begins.

## Out of scope

No Supabase migration, hosted schema change, row-codec change, repository widening, issuance cutover, archive materialization change, Jr/Sr initials change, scoring change, launch epoch, archive route, or permanent row creation.

## Acceptance

- Existing v1 tests remain unchanged and green.
- New tests prove v2 creation, exact canonical-ID alignment, v1 compatibility, and deep cloning.
- Full repository CI/data/build checks and exact-head Preview pass.
- Hosted permanent table remains unchanged and empty.

## Next bounded PR

Migrate append-only Supabase storage and the row codec/repository/read port to accept v1 and v2 records. The migration must preserve SELECT/INSERT-only service-role access, RLS, existing v1 decoding, and zero-row posture; it must not switch issuance/materialization yet.
