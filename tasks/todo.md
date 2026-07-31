# Initial Baseball Current Work

Status: Active ordered implementation plan  
Last updated: 2026-07-31

Completed history belongs in pull requests, canonical documentation, or `tasks/lessons.md`. Durable resumption context and approved deferred decisions belong in `docs/START-HERE.md`.

Current execution order: complete hosted end-to-end verification, establish flexible gameplay/content sockets, then build results and launch surfaces.

## 0. Restore verified continuity

- [x] Reconcile PRs #120–#121, hosted configuration, current deployment state, and the new scoring/hint/lineup-content direction in canonical docs.
- [x] Add a CI documentation-impact gate and explicit PR checklist.
- [ ] Ensure the documentation-impact status is treated as required before merge.

## 1. Complete hosted operational verification

- [x] Configure `DAILY_PROGRESSION_SECRET` for Vercel Preview and Production.
- [x] Apply `supabase/migrations/20260721143000_create_daily_editorial_puzzles.sql`.
- [x] Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_ADMIN_USERNAME`, and `DAILY_ADMIN_PASSWORD`.
- [x] Deploy current `main`; production deployment is `READY`.
- [x] Verify unauthenticated admin challenge and successful editor authentication.
- [ ] Verify the seven-day Supabase-backed horizon and generate only missing drafts.
- [ ] Preview, search, replace, and revalidate one future slot.
- [ ] Schedule one future puzzle and verify public scheduled/published consumption.
- [ ] Verify deterministic fallback for a missing/draft record.
- [ ] Verify hint, correct guess, incorrect guesses, third strike, Give Up, refresh recovery, and completion.
- [ ] Check initial HTML, network responses, client chunks, and logs for answer/credential leakage.
- [ ] Check production runtime errors.
- [ ] Investigate and resolve the public Daily date/cache discrepancy.
- [ ] Reconcile issues #97, #91, and #86 after the full hosted checklist passes.

## 2. Establish flexible gameplay sockets

- [ ] Define a versioned scoring and completion policy at the owning portable layer.
- [ ] Preserve raw at-bat facts independently of final score: outcome, hints revealed, wrong guesses, correct/K/Give Up resolution, slot, puzzle ID, and ruleset version.
- [ ] Implement provisional `points-v1`: HR/3B/2B/1B/BB/K = `5/4/3/2/1/0`.
- [ ] Make Standard Daily complete all nine at-bats under `points-v1`.
- [ ] Preserve the existing runner-advancement/baseball-inning engine for a future alternate policy.
- [ ] Update share/result contracts and browser-save migration safely.
- [ ] Add focused progression, completion, persistence, and spoiler-safe tests.

## 3. Make gameplay interactions immediate

- [ ] Deliver all four authorized hints for the active at-bat before that at-bat appears.
- [ ] Reveal hints locally with no visible network wait.
- [ ] Use the prior at-bat’s mandatory resolution response to prepare the next at-bat where practical.
- [ ] Keep answers, canonical answer IDs, future reveal records, and unrelated future-player data server-side.
- [ ] Measure interaction latency on common mobile connections and devices.

## 4. Build the lineup-content system

- [ ] Define the canonical gameplay-profile contract separately from objective baseball facts.
- [ ] Define a versioned lineup-recipe contract with slot groups, filters, difficulty requirements, repeat policy, and diversity constraints.
- [ ] Make “Standard Daily” one saved recipe rather than the only hardcoded selector.
- [ ] Establish a conservative provisional Standard Daily pool whose normal reveals produce “I could have gotten that.”
- [ ] Treat only the final slot as a possible deliberate deep challenge unless later playtesting supports otherwise.
- [ ] Generate and inspect representative lineups across many dates before activating a new policy.
- [ ] Add approved All-Star, award, and bWAR sources only through reproducible versioned enrichment.
- [ ] Add provider-neutral persistence and admin editing for gameplay profiles and reusable recipes in later bounded PRs.
- [ ] Preserve manual review/replacement of the exact generated nine players.

## 5. Add completed-game comparison

- [ ] Define one compact idempotent completed-game submission.
- [ ] Store raw per-at-bat facts plus ruleset version; do not write every hint or guess.
- [ ] Add total score and same-puzzle/same-ruleset percentile comparison.
- [ ] Add completion count, average score, outcome distribution, solve depth, K rate, and Give Up rate.
- [ ] Show sample size and use understandable percentile copy.
- [ ] Preserve recalculation from raw outcomes when formulas change.

## 6. Complete launch surfaces

- [ ] Verify refresh recovery and already-played behavior.
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
