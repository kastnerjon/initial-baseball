# Archive-beta server issuance composition

Status: implementation plan

## Scope contract

- **Goal:** bind the reviewed portable archive-beta issuance service to the authoritative editorial repository, current public clue materialization, and archive-beta Supabase repository using one server-only service-role client.
- **Owning layer:** `apps/web` server-only composition.
- **In scope:** beta-specific clue-materializer facade over the existing shared Daily pitch/hint logic; server composition requiring an already-resolved `ArchiveBetaDailyIdentity`; one Supabase client reused for editorial read + beta issued-puzzle repository; fail-closed missing editorial/player/hint behavior; exact retry/idempotency through the portable service; focused tests; canonical docs.
- **Out of scope:** beta epoch/current-date derivation, environment activation, scheduler/cron, HTTP/admin route, actual hosted issuance, archive route/gameplay/results/history, reset/delete tooling, or permanent launch policy.
- **Acceptance checks:** exact identity date drives editorial lookup; same public initials/layout/hints as current Daily/permanent issuance are frozen; missing editorial/player/hint causes no repository write; scheduled/published + exact slots remain owned by the portable service; retries preserve first issue time; one client is shared by both repositories; no code path invokes the service automatically.
- **Stop conditions:** any activation policy, hosted write, route/auth, scheduling, new storage semantics, or archive runtime change is a separate PR.

## Architecture

Keep the portable beta issuance service authoritative for lifecycle/order/immutability rules. The web layer only provides the already-existing provider concerns:

1. one service-role Supabase client;
2. authoritative editorial row lookup by the supplied beta identity date;
3. canonical player lookup + `createDailyPuzzlePitch` + shared hint config to freeze current public clues;
4. archive-beta immutable Supabase repository.

The existing clue snapshot implementation is already series-neutral in data shape. Add a beta-named facade that delegates to one internal materializer so diagnostics remain series-specific without duplicating hint logic.

Construction alone performs no read or write. The caller must explicitly invoke `issue({ identity, issuedAt })`; this PR adds no invoker, clock-based identity resolution, route, or scheduler, so production storage remains untouched.
