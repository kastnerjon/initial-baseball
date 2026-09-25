# Permanent Daily issuance Supabase composition

Status: implemented schema-v2 server composition boundary

## Scope contract

- **Goal:** compose explicit schema-v2 permanent issuance with the existing authoritative editorial and immutable Supabase repositories, freezing the current public clue bundle without configuring the permanent launch epoch.
- **Owning layer:** `apps/web` server-only composition.
- **In scope:** one service-role Supabase client, authoritative editorial read by supplied permanent identity date, exact public clue materialization through the canonical Daily player lookup and current Daily pitch/hint adapters, existing append-only issued-puzzle repository, delegation to portable schema-v2 issuance, fail-closed missing-editorial/player/hint behavior, focused tests, and canonical documentation.
- **Out of scope:** public/admin route, scheduler/cron, environment launch-date configuration, identity derivation from today's date, archive reads/routes, UI, browser history, game/ruleset selection, migrations, or beta-history import.
- **Acceptance checks:** both repositories use the same server client; the exact permanent identity date is read; missing editorial content/player/hint causes no permanent write; exact clue order/initials/layout/values are frozen; portable scheduled/published and immutable conflict/idempotency semantics remain authoritative; retries preserve the first `issuedAt`; no launch date is inferred.
- **Stop conditions:** any route/auth policy, automatic timing, launch epoch, database schema change, or archive read contract becomes a separate PR.

## Composition

`createServerPermanentDailyIssuanceService` is a server-only web adapter. Construction creates one service-role Supabase client, then builds:

- the existing `DailyPuzzleRepository` over `daily_editorial_puzzles`;
- the existing `PermanentDailyIssuedPuzzleRepository` over `permanent_daily_issued_puzzles`;
- the portable `createPermanentDailyClueFrozenIssuanceService` over the permanent repository.

The caller supplies only an already-resolved `PermanentDailyIdentity` and attempted `issuedAt` timestamp. The service reads the authoritative editorial record for `identity.puzzleDate`. It orders canonical IDs by editorial slot and materializes each clue with the same canonical Daily player lookup, `createDailyPuzzlePitch`, and `DEFAULT_DAILY_HINT_CONFIG` used by public gameplay. This freezes the exact current initials, four hint types/labels, and four materialized values. Missing editorial content, unavailable players, and malformed clues fail before persistence. The portable service remains the sole owner of scheduled/published eligibility, exact slot validation, lineup/snapshot agreement, and immutable/idempotent semantics. The archive materializer continues to reject schema v2 until its separate consumer change.

## Deliberate non-decisions

This composition does not know the broad-launch date and does not derive a permanent identity from the current clock. It performs persistence only when explicitly called with a resolved identity. It does not expose an HTTP/admin route, schedule automatic issuance, or choose a launch game/ruleset. Current beta numbering is still disposable.

## Next boundary

Portable frozen-puzzle reads, server-side read composition, and the archive runtime are implemented. The next bounded concern is to let archive materialization consume schema-v2 frozen clues rather than rebuilding clues from current player data. Keep this separate from public archive routes and launch-epoch configuration.
