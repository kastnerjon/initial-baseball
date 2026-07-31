# Initial Baseball Current Work

Status: Active ordered implementation plan  
Last updated: 2026-07-31

Completed history belongs in pull requests, canonical documentation, or `tasks/lessons.md`. Durable resumption context and approved deferred decisions belong in `docs/START-HERE.md`.

Current execution order: verify the merged points ruleset and hosted operations, make hints immediate, then build compact results and the lineup-content system.

## 0. Preserve verified continuity

- [x] Reconcile PRs #120–#121, hosted configuration, deployment state, and the scoring/hint/lineup-content direction in canonical docs.
- [x] Add a CI documentation-impact gate and explicit PR checklist.
- [ ] Decide and test a safe branch-ruleset configuration before making documentation-impact a mandatory merge check; issue #123 tracks this.

## 1. Complete hosted operational verification

- [x] Configure `DAILY_PROGRESSION_SECRET` for Vercel Preview and Production.
- [x] Apply `supabase/migrations/20260721143000_create_daily_editorial_puzzles.sql`.
- [x] Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_ADMIN_USERNAME`, and `DAILY_ADMIN_PASSWORD`.
- [x] Deploy current pre-points `main`; production was `READY` before the points change.
- [x] Verify unauthenticated admin challenge and successful editor authentication.
- [x] Check the latest pre-points production build for hidden-answer client-bundle leakage.
- [x] Check the prior 24-hour production runtime-error window; no errors were reported.
- [ ] Verify the merged `points-v1` production deployment is `READY` and aliased.
- [ ] Verify the seven-day Supabase-backed horizon and generate only missing drafts.
- [ ] Preview, search, replace, and revalidate one future slot.
- [ ] Schedule one future puzzle and verify public scheduled/published consumption.
- [ ] Verify deterministic fallback for a missing/draft record.
- [ ] Verify hint, correct guess, incorrect guesses, third strike, Give Up, all-nine continuation, refresh recovery, and completion.
- [ ] Check action-network responses and production logs for answer/credential leakage.
- [ ] Verify the public Daily rolls over after midnight Pacific without a redeploy.
- [ ] Reconcile issues #97, #91, and #86 after the full hosted checklist passes.

## 2. Versioned scoring and completion

- [x] Define explicit `points-v1` and `legacy-inning-v1` ruleset identifiers at the shared boundary.
- [x] Preserve raw at-bat facts independently of final score: outcome, hints revealed, wrong guesses, correct/K/Give Up resolution, slot, initials, puzzle ID, and ruleset version.
- [x] Implement `points-v1`: HR/3B/2B/1B/BB/K = `5/4/3/2/1/0`.
- [x] Make new Standard Daily sessions complete all scheduled at-bats under `points-v1`.
- [x] Preserve the existing runner-advancement/three-out engine as `legacy-inning-v1` compatibility behavior.
- [x] Carry ruleset version through signed progression, browser state, result contracts, and spoiler-safe share output.
- [x] Normalize old signed/saved sessions without silently changing their completion policy.
- [x] Add focused progression, completion, persistence, raw-fact, and spoiler-safe tests.

## 3. Make gameplay interactions immediate

- [ ] Deliver all four authorized hints for the active at-bat before that at-bat appears.
- [ ] Reveal hints locally with no visible network wait.
- [ ] Use the prior at-bat’s mandatory resolution response to prepare the next at-bat where practical.
- [ ] Keep answers, canonical answer IDs, future reveal records, and unrelated future-player data server-side.
- [ ] Measure interaction latency on common mobile connections and devices.

## 4. Add completed-game comparison

- [ ] Define one compact idempotent completed-game submission from the native raw facts now recorded locally.
- [ ] Store raw per-at-bat facts plus ruleset version; do not write every hint or guess.
- [ ] Add total score and same-puzzle/same-ruleset percentile comparison.
- [ ] Add completion count, average score, outcome distribution, solve depth, K rate, and Give Up rate.
- [ ] Show sample size and use understandable percentile copy.
- [ ] Preserve recalculation from raw outcomes when formulas change.

## 5. Build the lineup-content system

- [ ] Define the canonical gameplay-profile contract separately from objective baseball facts.
- [ ] Define a versioned lineup-recipe contract with slot groups, filters, difficulty requirements, repeat policy, and diversity constraints.
- [ ] Make “Standard Daily” one saved recipe rather than the only hardcoded selector.
- [ ] Establish a conservative provisional Standard Daily pool whose normal reveals produce “I could have gotten that.”
- [ ] Treat only the final slot as a possible deliberate deep challenge unless later playtesting supports otherwise.
- [ ] Generate and inspect representative lineups across many dates before activating a new policy.
- [ ] Add approved All-Star, award, and bWAR sources only through reproducible versioned enrichment.
- [ ] Add provider-neutral persistence and admin editing for gameplay profiles and reusable recipes in later bounded PRs.
- [ ] Preserve manual review/replacement of the exact generated nine players.

## 6. Complete launch surfaces

- [ ] Verify refresh recovery and already-played behavior after the points migration.
- [ ] Add analytics and error monitoring.
- [ ] Verify common iPhone and iPad layouts.
- [ ] Measure initial payload size.
- [ ] Apply the approved heritage ballpark / scorecard / 1970s-card visual direction after mechanics are dependable.
- [ ] Add privacy policy, terms/disclaimer, canonical domain, and social metadata.

## Deferred public products

- Accounts, streaks, and cross-device history.
- Native iOS or Android clients.
- Head-to-head play, chat, leagues, and matchmaking.
- Public user-created games.
- Exposed decade/team/theme libraries until the core Daily loop proves itself.
- Payments or monetization before demand is demonstrated.
