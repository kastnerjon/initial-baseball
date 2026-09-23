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

## Next boundary

Compose this portable issuance service server-side with the existing Supabase permanent-issued-puzzle repository. That composition should still require an explicitly supplied permanent identity and must not configure or infer the broad-launch epoch. Automatic date-driven issuance waits for the owner to choose the launch date/configuration policy.
