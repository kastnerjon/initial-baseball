# Permanent Daily issuance orchestration

Status: implemented portable orchestration boundary

## Scope contract

- **Goal:** freeze one eligible editorial Daily into the immutable permanent archive contract without configuring the permanent launch date.
- **Owning layer:** `packages/daily`.
- **In scope:** explicit permanent identity input, scheduled/published editorial eligibility, exact date/slot validation, ordered canonical-player extraction, delegation to the existing first-write-wins issued-puzzle service, focused tests, exports, and canonical documentation.
- **Out of scope:** launch-date/epoch configuration, automatic scheduling, Supabase/web composition, archive reads/routes, browser history, game/ruleset selection, scoring, or importing beta history.
- **Acceptance checks:** caller supplies the permanent identity explicitly; editorial date must match; only scheduled/published records may issue; slots must be exactly 1-9; canonical IDs are frozen in slot order; existing idempotency/conflict semantics remain owned by the issued-puzzle service.
- **Stop conditions:** any environment/config policy, route, database composition, or launch-product decision becomes a later bounded PR.

## Contract

`createPermanentDailyIssuanceService` is the portable bridge between the existing editorial lifecycle and the immutable permanent issued-puzzle service.

The caller supplies:

- an already-resolved `PermanentDailyIdentity`;
- the authoritative editorial puzzle projection for that same date;
- the attempted issue timestamp.

The service accepts only `scheduled` or `published` editorial content. It validates that the identity date matches the editorial date and that the editorial lineup contains exact slots 1 through 9. It then extracts canonical player IDs in slot order and delegates to `createPermanentDailyIssuedPuzzleService`.

The service deliberately ignores the editorial record's beta puzzle number/ID, revisions, audit metadata, and game/ruleset. It also does not create or resolve a launch epoch. This prevents current beta numbering from becoming permanent archive identity by accident.

## Server composition

The server-only web composition is implemented separately in `tasks/plans/permanent-daily-issuance-supabase-composition.md`. It reads the authoritative editorial row by the explicitly supplied permanent identity date and delegates to this portable service through the existing immutable Supabase repository. This portable module remains unaware of Supabase and launch-epoch configuration.

## Next boundary

Provider-neutral frozen-puzzle reads are now defined separately in `tasks/plans/permanent-daily-issued-puzzle-read.md`. The next boundary is the server-only Supabase read adapter. Automatic date-driven issuance still waits for the owner to choose the launch date/configuration policy.
