# Archive-beta portable issuance orchestration

Status: implemented on branch; verification pending

## Scope contract

- **Goal:** add the portable schema-v2 archive-beta issuance bridge over the existing immutable beta repository while sharing editorial lifecycle/order validation with permanent issuance.
- **Owning layer:** `packages/daily`.
- **In scope:** shared scheduled/published + exact-slot validation; archive-beta clue-frozen issuance facade for an explicitly supplied `ArchiveBetaDailyIdentity`; permanent issuance refactor onto the shared validation helper; focused tests; exports; canonical docs.
- **Out of scope:** server/Supabase composition, player/clue materialization, beta epoch activation/configuration, hosted writes, scheduler/route/auth, archive UI/gameplay/results/history.
- **Acceptance checks:** scheduled/published same-date editorial rows freeze exact slots 1–9; draft/archived/wrong-date/malformed slots fail before repository access; exact retry preserves first issue time through the existing immutable beta service; permanent issuance behavior/error semantics remain unchanged.
- **Stop conditions:** any web/provider composition, hosted invocation, activation policy, or storage change is a separate PR.

## Architecture

Editorial lifecycle/order validation is series-neutral, so it lives in one small portable helper parameterized only by a series label for diagnostics. Permanent and archive-beta issuance remain explicit facades with their own typed identities and immutable repositories. Archive beta is schema-v2-only and requires the caller to supply an already-resolved beta identity and materialized clue snapshot.

This PR cannot activate beta testing by itself: it has no web/provider dependency, no clock, no epoch configuration, and no hosted invocation surface.
