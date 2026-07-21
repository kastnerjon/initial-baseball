# Initial Baseball Current Work

Status: Active ordered implementation plan
Last updated: 2026-07-21

Completed work should not remain here as future work. Historical rationale belongs in pull requests, canonical documentation, or `tasks/lessons.md`. Durable resumption context, approved deferred decisions, and open decisions belong in `docs/START-HERE.md`.

Current execution order: complete the public editorial Daily runtime PR, then finish hosted progression and administration configuration and verification. The Vercel deployment quota has recovered; missing secrets and hosted Supabase setup are now the active operational blockers.

## 0. Complete launch answer-integrity deployment

- [x] Approve the anonymous, client-driven launch threat model without claiming tamper-proof scoring — ADR 0001 / PR #94.
- [x] Add the provider-neutral HMAC token and production secret primitives — PR #95.
- [x] Implement stateless signed progression authorization — PR #96.
- [x] Prevent arbitrary future-pitch requests while keeping scoring and Daily transitions in their existing portable owners.
- [x] Preserve schema-3 refresh recovery without adding a replay cache, database write per action, durable anonymous server session, or hosting-specific dependency.
- [x] Re-run typecheck, tests, hidden-answer production build QA, the full canonical pipeline, and runtime-consumer QA.
- [ ] Configure `DAILY_PROGRESSION_SECRET` for Vercel Preview and Production and verify the deployed flow — issue #97.
- [ ] Close issues #91 and #86 after deployment verification.

## 1. Finish reveal correctness

- [x] Show the canonical career summary after each resolved at-bat — PR #84.
- [x] Show one ordered row per regular season, including multiple teams when applicable — PR #84.
- [x] Support configurable reveal columns without changing canonical data ownership — PR #100 / issue #99.
- [x] Display OPS for hitters and saves for pitchers when available — PR #84.
- [x] Keep WAR, OPS+, ERA+, awards, All-Star selections, voting finishes, and leader flags hidden until approved upstream data exists.
- [x] Normalize fan-facing team abbreviations through a centralized, season-aware baseball-data mapping — PR #103 / issue #101.
- [x] Add representative reveal QA and correct duplicate career abbreviations, legacy artifact fallback, and audited Angels display names — issue #104.
- [x] Keep public guess search name-only for unique players and show career years only for genuine same-name canonical players — PR #116.

## 2. Finalize Daily lineup quality

- [x] Apply a sustainable nine-slot recognizability curve: ranks 1-250 for at-bats 1-2, 251-1,000 for 3-4, 1,001-2,500 for 5-6, and 2,501-5,000 for 7-9.
- [x] Avoid canonically repeated players within the approved 90-day window.
- [x] Make generation deterministic for puzzle date, reviewed data version, and algorithm version.
- [x] Preserve published legacy lineups before the explicit quality-algorithm launch date and keep historical overrides resolvable.
- [x] Produce portable validation details for rank band, recent usage, duplicate status, lineup shape, and required reveal-data readiness.
- [x] Cache candidates, seeded usage history, and generated lineups in the server runtime instead of replaying all history on every action.

## 3. Add future-lineup administration and public consumption

- [x] Define the provider-neutral puzzle lifecycle and repository/service contract before selecting a database provider.
- [x] Define `draft`, `scheduled`, `published`, and `archived` transition invariants with optimistic revision writes.
- [x] Keep published and archived puzzles immutable for ordinary replacement; return edited scheduled puzzles to draft review.
- [x] Persist only canonical player IDs and editorial metadata in the repository contract, without duplicating baseball statistics.
- [x] Build the seven-day application service that generates missing drafts, lists the horizon, joins canonical review data, and returns validation warnings.
- [x] Choose Supabase/Postgres and implement the smallest relational adapter satisfying the repository contract — PR #114.
- [x] Select per-request HTTP Basic authentication for the single editor and compose a server-only Supabase service-role client/repository boundary — PR #115.
- [x] Show each future date, puzzle number, lifecycle status, and all nine slots in one authorized operational workflow — PR #117.
- [x] Show canonical ID, display name, career years, role/position, fan-facing teams, recognizability rank, last Daily usage, selection source, and data-quality warnings — PR #117.
- [x] Allow an authorized editor to search, preview, and replace any future slot through the service boundary — PR #118.
- [x] Validate duplicates, recognizability tier, recent repeats, and required reveal data after generation and replacement — PR #118.
- [x] Add explicit authorized schedule, publish, and archive actions through the existing portable lifecycle service — PR #119.
- [x] Make the public Daily runtime read approved scheduled or published editorial selections through the server repository boundary, retain deterministic fallback for missing/draft dates, preserve pre-launch legacy answers, and fail closed for archived records pending an explicit replay policy — current PR.
- [ ] Apply the committed migration and configure hosted Supabase/Vercel variables before deploying the admin and editorial public-runtime workflows.
- [ ] Verify hosted scheduled/published consumption, deterministic fallback, signed progression, and `/admin/daily` end to end.

## 4. Complete launch surfaces

- [ ] Add the field-comparison results screen from one compact completed-game submission.
- [ ] Add analytics and error monitoring.
- [ ] Verify refresh recovery and already-played behavior.
- [ ] Measure initial payload size and interaction latency.
- [ ] Verify common iPhone and iPad web layouts.
- [ ] Apply the approved heritage ballpark / scorecard / 1970s-card visual direction after mechanics and administration are dependable.
- [ ] Add privacy policy, terms/disclaimer, canonical domain, and social metadata.

## Deferred

- Accounts, streaks, and cross-device history.
- Native iOS or Android clients.
- Head-to-head play, chat, leagues, and matchmaking.
- Payments or other monetization work before the Daily loop proves demand.
