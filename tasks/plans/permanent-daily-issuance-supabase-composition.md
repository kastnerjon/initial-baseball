# Permanent Daily issuance Supabase composition

Status: implemented server composition boundary

## Scope contract

- **Goal:** compose explicit permanent issuance with the existing authoritative editorial and immutable Supabase repositories without configuring the permanent launch epoch.
- **Owning layer:** `apps/web` server-only composition.
- **In scope:** one service-role Supabase client, authoritative editorial read by supplied permanent identity date, existing append-only issued-puzzle repository, delegation to the portable issuance service, missing-editorial fail-closed behavior, focused tests, and canonical documentation.
- **Out of scope:** public/admin route, scheduler/cron, environment launch-date configuration, identity derivation from today's date, archive reads/routes, UI, browser history, game/ruleset selection, migrations, or beta-history import.
- **Acceptance checks:** both repositories use the same server client; the exact permanent identity date is read; missing editorial content causes no permanent write; portable scheduled/published and immutable conflict/idempotency semantics remain authoritative; no launch date is inferred.
- **Stop conditions:** any route/auth policy, automatic timing, launch epoch, database schema change, or archive read contract becomes a separate PR.

## Composition

`createServerPermanentDailyIssuanceService` is a server-only web adapter. Construction creates one service-role Supabase client, then builds:

- the existing `DailyPuzzleRepository` over `daily_editorial_puzzles`;
- the existing `PermanentDailyIssuedPuzzleRepository` over `permanent_daily_issued_puzzles`;
- the portable `createPermanentDailyIssuanceService` over the permanent repository.

The caller supplies only an already-resolved `PermanentDailyIdentity` and attempted `issuedAt` timestamp. The service reads the authoritative editorial record for `identity.puzzleDate`. A missing row fails closed before any permanent insert. When a row exists, the adapter passes it unchanged to the portable service, which remains the sole owner of scheduled/published eligibility, exact slot ordering, and immutable/idempotent semantics.

## Deliberate non-decisions

This composition does not know the broad-launch date and does not derive a permanent identity from the current clock. It does not expose an HTTP/admin route, schedule automatic issuance, choose a launch game/ruleset, or insert any permanent rows on its own. Current beta numbering is still disposable.

## Next boundary

Portable frozen-puzzle reads and their server-only Supabase adapter are now implemented. The next bounded concern is server-side read composition/materialization for later archive gameplay, still without exposing a public archive route or choosing the launch epoch.
