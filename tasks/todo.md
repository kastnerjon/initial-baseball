# Initial Baseball Current Work

Status: Active ordered implementation plan
Last updated: 2026-07-21

Completed work should not remain here as future work. Historical rationale belongs in pull requests, canonical documentation, or `tasks/lessons.md`. Durable resumption context, approved deferred decisions, and open decisions belong in `docs/START-HERE.md`.

Current execution order: preserve the durable handoff, complete representative reveal QA, then finalize lineup mechanics and build a seven-day editorial administration workflow. The Vercel deployment task in issue #97 remains operationally required but does not block GitHub development.

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
- [ ] Add representative reveal QA for David Ortiz, Mariano Rivera, Shohei Ohtani, Ken Griffey Jr., David Wright, Willie Mays, and the distinct Ben Taylor identities.

## 2. Finalize Daily lineup quality

- [ ] Apply the nine-slot recognizability curve: top 250 for at-bats 1-2, top 1,000 for 3-4, top 2,500 for 5-6, and top 5,000 for 7-9.
- [ ] Avoid recently used players within the approved repeat window, currently 90 days.
- [ ] Confirm deterministic generation for a date and reviewed data version.
- [ ] Verify historical overrides and saved references still resolve after runtime migration.
- [ ] Produce validation details suitable for editorial review: rank band, recent usage, duplicate status, and required reveal-data readiness.

## 3. Add future-lineup administration

- [ ] Support generation, viewing, and editing for at least the next seven Daily lineups.
- [ ] Show each future date, puzzle number, lifecycle status, and all nine slots in one operational workflow.
- [ ] Show canonical ID, display name, career years, role/position, fan-facing teams, recognizability rank, last Daily usage, selection source, and data-quality warnings.
- [ ] Allow an authorized editor to search, preview, and replace any future slot through a repository/service boundary.
- [ ] Validate duplicates, recognizability tier, recent repeats, and required reveal data after generation and replacement.
- [ ] Support draft, scheduled, published, and archived states.
- [ ] Keep published puzzles immutable except through an explicit editorial/versioning action.
- [ ] Persist canonical player IDs and editorial metadata without duplicating baseball statistics.

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
