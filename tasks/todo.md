# Initial Baseball Current Work

Status: Active ordered implementation plan  
Last updated: 2026-07-31

Completed history belongs in pull requests, canonical documentation, or `tasks/lessons.md`. Durable resumption context and approved deferred decisions belong in `docs/START-HERE.md`.

Current execution order: make hints immediate, finish hosted browser/admin verification, then build compact results and the lineup-content system.

## 0. Preserve verified continuity

- [x] Reconcile hosted configuration, deployment state, scoring, hint, and lineup-content direction in canonical docs.
- [x] Add a tested CI documentation-impact gate and explicit PR checklist.
- [ ] Decide and test a safe branch-ruleset configuration before making documentation-impact mandatory; issue #123 tracks this.

## 1. Production and hosted verification

- [x] Configure `DAILY_PROGRESSION_SECRET`, Supabase credentials, and Daily admin credentials for Vercel Preview and Production.
- [x] Apply `supabase/migrations/20260721143000_create_daily_editorial_puzzles.sql` and verify RLS/service-role boundaries.
- [x] Verify unauthenticated admin challenge and successful editor authentication.
- [x] Merge PR #124 and verify production deployment `dpl_GcC8FtpbPnk2mUAzNVuNvo683wmN` is `READY` and canonically aliased.
- [x] Verify production public HTML shows `0/45 PTS`, `0/9 AB`, and a signed `points-v1` token.
- [x] Verify the points deployment passed hidden-answer build QA and the complete test/data/build pipeline.
- [x] Check recent production runtime errors; none were reported during the scoring verification window.
- [ ] Verify the public Daily rolls over after midnight Pacific without a redeploy.
- [ ] Verify the seven-day Supabase-backed horizon and generate only missing drafts.
- [ ] Preview, search, replace, and revalidate one future slot.
- [ ] Schedule one future puzzle and verify scheduled/published public consumption.
- [ ] Verify deterministic fallback for a missing/draft record.
- [ ] Verify hint, correct guess, incorrect guesses, third strike, Give Up, all-nine continuation, refresh recovery, and completion in a real browser.
- [ ] Check action-network responses and production logs for answer/credential leakage.
- [ ] Reconcile issues #97, #91, and #86 after the full hosted checklist passes.

## 2. Versioned scoring and completion

- [x] Define `points-v1` and `legacy-inning-v1` at the shared boundary.
- [x] Preserve spoiler-safe raw at-bat facts independently of final score.
- [x] Implement `5/4/3/2/1/0` scoring and all-scheduled-at-bats completion for new Standard Daily sessions.
- [x] Preserve runner advancement and three-out completion as explicit legacy compatibility behavior.
- [x] Carry ruleset version through signed progression, browser state, results, and share output.
- [x] Normalize compatible old signed/saved sessions without silently changing their policy.
- [x] Add focused progression, completion, persistence, raw-fact, and spoiler-safe tests.

## 3. Make Hint actions immediate

- [ ] Define one authorized active-at-bat hint-bundle contract containing all four current hints and signed reveal-depth checkpoints.
- [ ] Include the first bundle in bootstrap without exposing an answer ID, answer name, reveal record, or future-batter data.
- [ ] Return an updated same-pitch bundle after an incorrect guess and the next-pitch bundle after a terminal resolution.
- [ ] Hydrate the current bundle from a compatible saved progression token before showing an interactive restored at-bat.
- [ ] Reveal hints locally with no network request on Hint click.
- [ ] Prevent checkpoint use from reducing strike count or resetting already revealed hint depth.
- [ ] Keep `/api/daily/hint` only if required for compatibility; remove it from the active client path.
- [ ] Add focused bootstrap, bundle, token, refresh, client, leakage, and latency tests.
- [ ] Verify preview initial HTML contains only the active batter’s authorized hints and no future-batter/answer data.

## 4. Add completed-game comparison

- [ ] Define one compact idempotent completed-game submission from native raw facts.
- [ ] Persist puzzle identity, ruleset version, ordered at-bat facts, and score; do not write every hint or guess.
- [ ] Add same-puzzle/same-ruleset percentile comparison.
- [ ] Add completion count, average score, outcome distribution, solve depth, K rate, and Give Up rate.
- [ ] Show sample size and understandable percentile copy.
- [ ] Preserve recalculation from raw facts when formulas change.

## 5. Build the lineup-content system

- [ ] Define gameplay-profile contracts separately from objective baseball facts.
- [ ] Define a versioned lineup-recipe contract with slot groups, filters, difficulty, repeats, and diversity constraints.
- [ ] Make Standard Daily one saved recipe rather than the only hardcoded selector.
- [ ] Establish a conservative pool whose normal reveals produce “I could have gotten that.”
- [ ] Treat only the final slot as a possible deliberate deep challenge unless playtesting supports otherwise.
- [ ] Add approved All-Star, award, and bWAR sources only through reproducible enrichment.
- [ ] Add provider-neutral persistence/admin editing for profiles and recipes in bounded follow-up PRs.
- [ ] Preserve manual review/replacement of the exact generated nine.

## 6. Complete launch surfaces

- [ ] Add analytics and error monitoring.
- [ ] Verify common iPhone and iPad layouts and measure initial payload size.
- [ ] Apply the approved heritage ballpark / scorecard / 1970s-card visual direction after mechanics are dependable.
- [ ] Add privacy policy, terms/disclaimer, canonical domain, and social metadata.

## Deferred public products

- Accounts, streaks, and cross-device history.
- Native iOS or Android clients.
- Head-to-head play, chat, leagues, and matchmaking.
- Public user-created games or exposed decade/team/theme libraries before the core Daily loop proves itself.
- Payments before demand is demonstrated.
