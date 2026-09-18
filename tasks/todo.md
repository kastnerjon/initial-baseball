# Initial Baseball Current Work

Status: Active ordered implementation plan  
Last updated: 2026-09-17

Completed history belongs in PRs, canonical docs, or `tasks/lessons.md`. Durable resumption context belongs in `docs/START-HERE.md`.

Current order: the routine conversational future-lineup path is operationally complete; completed-result 4A validation, 4B idempotency, the hardened Supabase provider, and the server POST API are merged. The current bounded concern is browser completion-only activation with immutable persisted payloads, refresh-safe retry, native-fact provenance gating, and replay-safe local reset semantics. Draft #161 must not be merged unchanged. Remaining authenticated-editor slot QA, timed public editorial rollover/fallback checks, and physical iPhone/iPad QA stay open but do not block the results pipeline. Production `daily_completed_results` was empty immediately before browser activation. Comparison and permanent archive/local history remain subsequent concerns. Current beta numbering is disposable; broad launch later restarts at Daily #1 after the owner chooses the surviving game/final rules.

## September 15–16 approved product work

- [x] Implement private initials/answer/outcome scorecard with additive local answer retention and separate spoiler-safe Copy share card (PR #140).
- [x] Define and implement classic-inning-v1 in portable rules, preserving existing policies (PR #141).
- [x] Merge PR #155: typed new-session bootstrap selection, signed Classic game identity, engine-owned three-out/nine-batter completion, and no successor hint bundle after completion.
- [x] Merge PR #156: activate `/classic` with navigation, isolated saves, compatible default keys, game-aware refresh/reset/results/sharing, and hidden unplayed answers; exact production deployment is READY and both public routes return the same Daily puzzle with their correct signed ruleset identities.
- [ ] Verify both games interactively through terminal/complete refresh, clipboard success/failure, answer safety and responsive layouts; retain physical-device QA as distinct.
- [x] Settle beta/launch direction: Daily Nine and Classic are distinct beta games sharing a lineup today; either may ultimately be removed or separated, and infrastructure must not require both forever.
- [x] Settle permanent-history direction: current numbering is beta; broad launch explicitly restarts at Daily #1 and only post-launch Dailies enter the permanent archive.
- [x] Settle comparison direction: result populations are stable-puzzle + ruleset/game specific; Daily Nine gets per-AB/whole-game comparison, while Classic gets separate baseball-native comparison.
- [x] Settle initial personal-history direction: archive completion/scores are remembered on the current browser/device; cross-device history waits for accounts.

## 0. Continuity

- [x] Reconcile hosted configuration, scoring, hints, and lineup-content direction in canonical docs.
- [x] Add tested documentation-impact CI and PR checklist.
- [ ] Decide/test a safe branch-ruleset configuration before making the check mandatory; issue #123.

## 1. Production and hosted verification

- [x] September 17 verified production code baseline is PR #163 (`0001f51c15b9e7b4e5e9647ce471365a96f19bc7`) with READY production `dpl_APaPW1hwmzghnoRg4fEXhcFnNCCw` on that exact merge SHA and successful Vercel status; 4A/4B are merged. #162 broadens authorized manual selection without changing automatic generation, and #163 makes public scheduled/published resolution use that editorial candidate universe. Supabase has an empty `daily_completed_results` table, but draft #161 is not live. This does not replace the outstanding interactive/physical-device QA.
- [x] Verify exact merge-SHA production for the public editorial-candidate fix and reconcile hosted handoff: production `dpl_APaPW1hwmzghnoRg4fEXhcFnNCCw` is READY on PR #163 merge SHA `0001f51c15b9e7b4e5e9647ce471365a96f19bc7`.
- [x] Configure progression, Supabase, and admin secrets for Preview/Production.
- [x] Apply editorial migration and verify RLS/service-role boundaries.
- [x] Verify admin challenge and prior successful editor authentication.
- [x] Merge/verify `points-v1` production with `0/45 PTS`, `0/9 AB`, signed ruleset token, hidden-answer QA, full CI/data/build, and no runtime errors.
- [x] Merge PR #126 and verify instant-hint production payload/build boundaries.
- [x] Merge PR #128 and verify production deployment from merge SHA `9ba0a44198799fe71b0520d5245b16b39e056fc2` is READY/canonically aliased.
- [x] Verify the pre-v3 production bootstrap contract (`0/36 PTS`, `0/9 AB`, signed `points-v2` token, one current-batter hint bundle, no answer/reveal/future-batter bundle); retain this as compatibility evidence.
- [x] Verify the current points-v3 production bootstrap (`0/63 PTS`, `0/9 AB`, signed `points-v3` token) and Classic bootstrap (`classic-inning-v1`) on the same public Daily puzzle; hidden-answer build QA passes for both initial payloads and no error/fatal runtime logs were present after PR #156 deployment.
- [x] Merge PR #132 and verify production deployment from merge SHA `a942bab74a68077a1c6ed1aff37b16af45ccc685` is READY/canonically aliased.
- [x] Merge PR #133 and verify production deployment `dpl_AyXpSu9VyQaVUrmANTqJVNQVFf4k` from exact merge SHA `543adf1038f780313870ed3ff30c163648bd86f3` is READY/canonically aliased with hidden-answer build QA passing.

### Public real-browser gameplay

- [x] Add immediate Give Up and Submit Guess pending feedback plus initial resolve timing instrumentation.
- [x] Confirm from production device/log evidence that Submit Guess can still take roughly two seconds even when requests succeed, establishing a real hot-path performance defect rather than an error/retry issue.
- [x] Implement and merge the bounded hot-path optimization: cache the fully materialized server-only puzzle, lazy-load lineup/Supabase composition on cache miss, separate search initialization from resolution, avoid full canonical-index loading for ordinary canonical guesses, and use direct reveal-shard access for terminal resolution.
- [x] Keep resolve `Server-Timing` as the handler-level diagnostic and use it with phone end-to-end timing to separate remaining platform/network overhead from server work.
- [x] Merge/deploy the original heritage baseline as PR #135, production `dpl_32hGx8N4TKEGKsCaoqHxVbBfVxtf` at `d2de746664e7d154294f54dc9ae4b1d55f651ad8`; verified September 8.
- [x] Implement and merge the authorized compact scorebook revision as PR #137: readable typography, compact header/status, single current-strike indicator, history after play, quiet secondary controls, continuation before long reveals, and compact Season/Team tables; scope in `tasks/plans/compact-scorebook.md`.
- [x] Fix issue #136 in PR #138: use dense canonical recognizability ranks beginning September 2 while preserving earlier v2 lineups, the 90-day repeat window, published/manual puzzles, and hosting settings; regression coverage includes the 173-of-250 reproduction, cutover compatibility, and continuous generation through October 2027.
- [x] Verify production deployment `dpl_8e7N4n8E34rXCgmYj9rJEKBdsKHu` from merge SHA `7c568f3253d62b8fab11becc3e68d94628fa6b0a` is READY/canonically aliased, serves `/` with HTTP 200 and the compact scorebook UI, and has no error/fatal logs on the new deployment at verification time.
- [x] Normalize the Daily desktop surface to the 960px reveal/statistics rail and keep scorecard fields in a compact left-aligned group; scope in `tasks/plans/unified-daily-rail.md`.
- [x] Clarify the points-v3 scorebug with four equal-width metrics ordered At bat, Points possible this AB, Points so far, and Strikeouts; compatibility scorebugs retain their existing metrics.
- [x] Verify on physical iPhone that Daily Nine/Classic navigation is visible, switches cleanly, and the two games maintain independent active saves/hint state.
- [ ] Verify physical iPhone Submit Guess and Give Up end-to-end latency against handler timing after PR #133; CI/browser emulation alone cannot establish a phone latency improvement.
- [ ] Complete compact presentation QA on physical iPhone/iPad: search dropdown/selection, hint and pending states, local reveal-table scrolling, history, terminal completion/share, reset, and no accidental zoom/overflow.
- [ ] Verify resolved `points-v3` outcome plus hint/wrong-guess deductions, banner total/active-at-bat allowance, and awarded-point presentation.
- [ ] Verify saved-session `/api/daily/hints` hydration and refresh recovery in both games, including Classic third-out completion with no unplayed answer exposure.
- [ ] Verify correct guess, wrong guesses, third strike, Give Up responsiveness/reveal, all-nine continuation, final reveal/completion, action responses/logs, and common iPhone/iPad behavior.

### Authenticated editorial workflow

Admin redesign is deferred. The user may supply a future date and nine ordered player names for assisted entry. Resolve ambiguous identities, validate the lineup and use normal revision/lifecycle controls; never bypass published-puzzle immutability. The private conversational bridge is active in production and is the preferred routine entry path; `/admin/daily` remains a supported interface over the same editorial records.

- [x] Merge PR #152: atomic nine-player replacement plus private machine-authenticated server adapter; no direct Supabase editorial writes and no future lineup payloads in public GitHub surfaces.
- [x] Merge PR #153, connect the Supabase app, apply the private `pg_net` transport, store the matching `DAILY_CHATOPS_TOKEN` only in Vercel server environment and Supabase Vault, and redeploy production.
- [x] Smoke-test conversational editing on a future draft: verify atomic rejection for an ineligible candidate, exact nine-player readback/order/revision for the corrected lineup, explicit scheduling, and `chatops:assistant` audit attribution.
- [x] Separate automatic eligibility from manual editorial eligibility: automatic generation remains restricted to ranked `dailyEligiblePlayers`, while authorized manual admin/ChatOps curation may select any canonical, reveal-ready Daily-compatible player and receives `outside-automatic-daily-pool` when the player is outside the automatic pool (PR #162).
- [x] Exercise routine owner-supplied future-lineup entry through Dailies #149–#151: exact nine-player order persisted, explicit scheduling reached revision 2 with `chatops:assistant` attribution, and a `pg_net` timeout-after-commit case was safely reconciled by authoritative readback before retry.
- [x] Verify seven-day Supabase horizon and missing-record creation: Dailies #145–#151 are persisted, all seven are public-consumable lifecycle states, and owner-supplied #149–#151 were created/replaced/scheduled through the private ChatOps path.
- [x] Make public scheduled/published resolution use the existing manual editorial candidate universe without changing the automatic pool; add rejection/fallback/order regression coverage.
- [ ] Preview/search/replace/revalidate one future slot through the authenticated editor workflow.
- [ ] Verify public scheduled/published consumption for an editorially scheduled future puzzle.
- [ ] Verify deterministic fallback for missing/draft records.
- [ ] Reconcile issues #97, #91, and #86 after the full hosted checklist.

### Timed production observation

- [x] Verify midnight-Pacific rollover without a coincident redeploy: production advanced from July 31, 2026 / Daily #96 to August 1, 2026 / Daily #97 while deployment `dpl_Bp2gX76FqxQXpjCgAbMY76nUyqwC` remained current.

## 2. Versioned scoring/completion

- [x] `legacy-inning-v1` compatibility contract.
- [x] `points-v1` compatibility contract: `5/4/3/2/1/0`, 45-point maximum.
- [x] `points-v2` compatibility contract: `4/3/2/1/0.5/0`, 36-point maximum.
- [x] `points-v3` current Daily Nine beta contract: 7 points per at-bat minus verified hints/wrong guesses; third wrong guess or Give Up is 0; 63-point maximum for nine.
- [x] `classic-inning-v1` current Classic beta contract: runner advancement/run scoring, three outs or nine at-bats.
- [x] Native raw at-bat facts independent of final score.
- [x] Ruleset versioning through signed tokens, local persistence, results, and sharing.
- [x] Resolved at-bat display derives and shows awarded points beside the baseball outcome for point rulesets only.
- [x] Add points-v3 engine/web/storage regression coverage and verify production bootstrap.
- [ ] Before broad launch, explicitly choose the surviving game and final launch rules; do not silently treat current beta policy as immutable launch policy.

## 3. Immediate active-batter hints

- [x] Authorized four-hint current-batter bundle with signed later-depth checkpoints.
- [x] First bundle in bootstrap; refreshed same-pitch/next-pitch bundles after resolution.
- [x] Verified-current saved hydration route and local no-network Hint transitions.
- [x] Legacy one-hint route removed from active client path.
- [x] Answer-integrity/product/API/architecture docs amended.
- [x] Focused tests, full CI, preview, P1 review fixes, merge, production payload/build QA, and runtime-error verification.
- [ ] Real-browser saved hydration and interaction QA remains under hosted verification.

## 4. Completed-game results and comparison

### 4A. Portable result contract

- [x] Define schema-1 transport/result types in shared using stable puzzle identity, exact ruleset/game identity, client idempotency ID, and ordered native at-bat facts; initially accept only `points-v3` and `classic-inning-v1`.
- [x] Validate exact puzzle/date/number/game, faced pitch order/initials, completion shape, outcome-to-hint consistency, wrong-guess/resolution consistency, and supported schema/ruleset in the engine.
- [x] Derive Daily Nine points/maximum/strikeouts and Classic baseball summary through existing engine rules; discard submitted totals/extras.
- [x] Preserve copied normalized raw facts for later recalculation without changing anonymous authority or legacy gameplay compatibility.
- [x] Cover valid, malformed, spoofed, inconsistent, incomplete, overlong/after-completion, game-isolation, and normalization behavior with focused engine tests.

### 4B. Portable repository/service

- [x] Define `DailyCompletedResultRepository` and `createDailyCompletedResultService` in the portable Daily layer; scope: `tasks/plans/completed-result-repository.md`.
- [x] Make `insertIfAbsent(result)` the atomic first-write-wins repository primitive keyed by `submissionId`; no read-then-save idempotency sequence.
- [x] Same ID/same normalized payload returns the existing record; same ID/different normalized payload returns `idempotency_conflict` without overwrite.
- [x] Compare explicit normalized result fields, including ordered raw facts and derived summary, without JSON-order/object-identity dependence.
- [x] Preserve the complete normalized result/raw facts and cover insert, retry, conflict, cross-game ID reuse, and Classic shorter-fact-list behavior with focused tests.
- [x] Keep Supabase, API, browser persistence/retry, aggregates, comparison UI, and archive/history out of 4B.

### 4C-1. Supabase provider

- [x] Reconcile the already-applied `20260917132147_create_daily_completed_results` migration into source control rather than reusing inactive legacy result tables.
- [x] Add the server-only Supabase row codec/adapter behind `DailyCompletedResultRepository.insertIfAbsent`.
- [x] Preserve insert-first first-write-wins semantics: only a unique-key conflict reads the existing winner; no update/upsert path.
- [x] Keep RLS enabled with no browser policies and harden `service_role` to direct `SELECT, INSERT` only via migration `20260918004822_harden_daily_completed_results_privileges`.
- [x] Pass focused/full CI, preview, advisor verification, merge, and exact production/source reconciliation.

### 4C-2. Completed-result submission API

- [x] Add one public completed-game POST route with private/no-store responses.
- [x] Parse and reject malformed schema/date/ruleset/future routing before authoritative puzzle construction.
- [x] Load the authoritative public puzzle through the existing Daily runtime without minting progression tokens/hint bundles and call engine `validateDailyCompletedResult`; never trust submitted totals.
- [x] Store only the engine-normalized result through 4B/provider and map created/existing/conflict/invalid/provider-unavailable outcomes deliberately.
- [x] Pass focused/full CI, preview, merge, and exact production verification with no browser submission code in the diff.

### 4C-3. Browser completion submission/retry — current bounded concern

- [x] Persist the exact immutable schema-1 submission payload, including one stable client-generated submission ID, before the first POST.
- [x] Create new submissions only from genuine native `points-v3` / `classic-inning-v1` completion; never create from compatibility-reconstructed or pre-feature completed history.
- [x] Retry the exact stored payload after network/408/425/429/5xx failure or refresh and deduplicate same-tab in-flight requests.
- [x] Make async status writes ownership-safe by comparing the current stored submission ID before mutation.
- [x] Keep result-delivery bookkeeping independent from gameplay save/reset state so replay cannot mint another browser aggregate contribution for the same puzzle/ruleset.
- [x] Preserve Classic shorter faced-at-bat lists and reject unsupported compatibility rulesets client-side.
- [ ] Pass final focused/full CI and preview, merge, verify exact production activation, and perform a controlled native completion/readback plus identical retry row-count check.

### 4D. Daily Nine comparison

- [ ] Add same-Daily/same-ruleset completion count and average total points.
- [ ] Add per-at-bat average points for each of the nine slots plus useful outcome/hint/K/Give Up rates.
- [ ] Add score distribution.
- [ ] Settle percentile tie treatment and minimum sample copy before percentile UI.
- [ ] Add understandable total/per-AB comparison UI by extending the compact scorebook system.

### 4E. Classic comparison

- [ ] Add same-Daily/same-ruleset runs, hits, at-bats reached, per-at-bat outcome, strikeout, and reach-rate aggregates.
- [ ] Keep later-batter reach population distinct from all Classic completions.
- [ ] Do not invent a single Classic percentile/ordering metric until explicitly settled.
- [ ] Avoid elaborate Classic-only analytics until beta feedback justifies retaining Classic.

## 5. Permanent archive and local history

- [ ] Define stable permanent Daily identity/launch-epoch contract without choosing the launch date yet.
- [ ] Build archive infrastructure to begin at future permanent Daily #1; do not import current beta history.
- [ ] Freeze each issued permanent Daily so later lineup-generation/profile changes cannot change historical answers.
- [ ] Add archive routes/navigation with Daily Nine/Classic choice while both games remain supported.
- [ ] Isolate archived-game saves from current Daily and from the other game.
- [ ] Remember per-browser/device completion and recorded score/result for each stable Daily + game/ruleset.
- [ ] Keep archived results shareable and eligible for same-Daily/same-ruleset global comparison.
- [ ] Defer cross-device history until accounts.
- [ ] Before launch, explicitly choose the surviving game, final launch rules, and launch date; reset permanent numbering to Daily #1.

## 6. Lineup-content system

- [ ] Define gameplay-profile contracts separately from facts.
- [ ] Define versioned lineup recipes with slot groups, filters, difficulty, repeats, and diversity constraints.
- [ ] Make Standard Daily one saved recipe.
- [ ] Establish a conservative “I could have gotten that” pool; only final slot may be deliberate deep challenge.
- [ ] Add reproducible All-Star/award/bWAR enrichment.
- [ ] Add provider-neutral profile/recipe persistence/admin editing in bounded PRs.
- [x] Preserve manual review/replacement of exact generated nine and allow intentional canonical reveal-ready manual choices outside the automatic pool without changing automatic eligibility (PR #162).

## 7. Launch surfaces

- [ ] Analytics/error monitoring.
- [ ] Finish real-device iPhone/iPad polish and payload measurement after the compact revision is deployed.
- [x] Refine the heritage baseline into the compact baseball scorebook direction after September 8 screenshot review.
- [ ] Privacy, terms, canonical domain, social metadata.

## Deferred public products

Accounts/cross-device history; native clients; head-to-head/social; public custom/theme libraries before the core game proves itself; payments before demand. Advanced mode-specific analytics remain deferred until beta selects the launch game.
