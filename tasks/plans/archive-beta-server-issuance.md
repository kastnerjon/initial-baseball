# Archive-beta server issuance composition

Status: complete; merged and production-verified
Last updated: 2026-10-05

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


## Implementation note

`createServerArchiveBetaDailyIssuanceService` mirrors the established permanent server composition without sharing activation policy. Construction creates one server Supabase client, the editorial repository, and the archive-beta issued-puzzle repository. Only an explicit `issue({ identity, issuedAt })` call performs the authoritative read/materialization/write path. No production caller is added in this PR, so merely deploying this code cannot create a beta row.

## Verification checkpoint

PR #289 completed clean review, exact-head CI #1007, and READY exact-head Preview `dpl_MSD5HJTQKSHsBmkTiqJcxGVxPRfc` for `928e6458cb1e7f29c7f2b6a729384ad103c586ee`. The authenticated Preview fetch returned HTTP 200 and its build passed hidden-answer QA. The PR merged at `64235b774e229c93284caaf800d88512325c9a19`; push CI #1012 passed and exact-merge production `dpl_HBVajLLYRFbWwQEpFi5Rqm6KaNJe` is READY. The canonical site returned HTTP 200, runtime checks found no error/fatal logs, and `public.permanent_daily_issued_puzzles` still contained zero rows. Activation, epoch selection, and the first immutable hosted issue remain separate work.
