# Initial Baseball Current Work

Status: Active ordered implementation plan  
Last updated: 2026-09-16

Completed history belongs in PRs, canonical docs, or `tasks/lessons.md`. Durable resumption context belongs in `docs/START-HERE.md`.

Current order: PR #155 is merged; finish/review/merge PR #156 for the approved mode-aware Classic browser experience; complete physical iPhone/iPad presentation and resolution-latency QA on the now-corrected production runtime; then completed-result contracts/persistence and the lineup-content system. The secure conversational Daily lineup bridge is active in production and is the preferred routine lineup-entry path.

## September 15 approved product work

- [x] Implement private initials/answer/outcome scorecard with additive local answer retention and separate spoiler-safe Copy share card (PR #140).
- [x] Define and implement classic-inning-v1 in portable rules, preserving existing policies (PR #141).
- [x] Merge PR #155: typed new-session bootstrap selection, signed Classic mode identity, engine-owned three-out/nine-batter completion, and no successor hint bundle after completion. Public `/classic` activation remains in the stacked browser PR.
- [ ] Finish/review/merge PR #156: activate `/classic` with navigation, isolated saves, compatible default keys, mode-aware refresh/reset/results/sharing, and hidden unplayed answers.
- [ ] Verify both modes, terminal/complete refresh, clipboard success/failure, answer safety and responsive layouts; retain physical-device QA as distinct.

## 0. Continuity

- [x] Reconcile hosted configuration, scoring, hints, and lineup-content direction in canonical docs.
- [x] Add tested documentation-impact CI and PR checklist.
- [ ] Decide/test a safe branch-ruleset configuration before making the check mandatory; issue #123.

## 1. Production and hosted verification

- [x] Configure progression, Supabase, and admin secrets for Preview/Production.
- [x] Apply editorial migration and verify RLS/service-role boundaries.
- [x] Verify admin challenge and prior successful editor authentication.
- [x] Merge/verify `points-v1` production with `0/45 PTS`, `0/9 AB`, signed ruleset token, hidden-answer QA, full CI/data/build, and no runtime errors.
- [x] Merge PR #126 and verify instant-hint production payload/build boundaries.
- [x] Merge PR #128 and verify production deployment from merge SHA `9ba0a44198799fe71b0520d5245b16b39e056fc2` is READY/canonically aliased.
- [x] Verify the pre-v3 production bootstrap contract (`0/36 PTS`, `0/9 AB`, signed `points-v2` token, one current-batter hint bundle, no answer/reveal/future-batter bundle); retain this as compatibility evidence.
- [ ] Deploy and verify the points-v3 bootstrap (`0/63 PTS`, `0/9 AB`, signed `points-v3` token) with hidden-answer QA and no runtime errors.
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
- [ ] Verify physical iPhone Submit Guess and Give Up end-to-end latency against handler timing after PR #133; CI/browser emulation alone cannot establish a phone latency improvement.
- [ ] Verify compact presentation on physical iPhone/iPad, including search dropdown/selection, hint and pending states, local reveal-table scrolling, history, completion/share and no accidental zoom/overflow.
- [ ] Verify resolved `points-v3` outcome plus hint/wrong-guess deductions, banner total/active-at-bat allowance, and awarded-point presentation.
- [ ] Verify saved-session `/api/daily/hints` hydration and refresh recovery.
- [ ] Verify correct guess, wrong guesses, third strike, Give Up responsiveness/reveal, all-nine continuation, final reveal/completion, action responses/logs, and common iPhone/iPad behavior.

### Authenticated editorial workflow

Admin redesign is deferred. The user may supply a future date and nine ordered player names for assisted entry. Resolve ambiguous identities, validate the lineup and use normal revision/lifecycle controls; never bypass published-puzzle immutability. The private conversational bridge is active in production and is the preferred routine entry path; `/admin/daily` remains a supported interface over the same editorial records.

- [x] Merge PR #152: atomic nine-player replacement plus private machine-authenticated server adapter; no direct Supabase editorial writes and no future lineup payloads in public GitHub surfaces.
- [x] Merge PR #153, connect the Supabase app, apply the private `pg_net` transport, store the matching `DAILY_CHATOPS_TOKEN` only in Vercel server environment and Supabase Vault, and redeploy production.
- [x] Smoke-test conversational editing on a future draft: verify atomic rejection for an ineligible candidate, exact nine-player readback/order/revision for the corrected lineup, explicit scheduling, and `chatops:assistant` audit attribution.
- [ ] Verify seven-day Supabase horizon and missing-draft generation.
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
- [x] `points-v3` current contract: 7 points per at-bat minus verified hints/wrong guesses; third wrong guess or Give Up is 0; 63-point maximum for nine.
- [x] Native raw at-bat facts independent of final score.
- [x] Ruleset versioning through signed tokens, local persistence, results, and sharing.
- [x] Resolved at-bat display derives and shows awarded points beside the baseball outcome for point rulesets only.
- [x] Focused tests, full CI, preview, three review passes, merge, production bootstrap verification, and runtime-error verification for `points-v2`.
- [x] Add points-v3 engine/web/storage regression coverage and reconcile canonical scoring docs; production verification remains pending this PR.

## 3. Immediate active-batter hints

- [x] Authorized four-hint current-batter bundle with signed later-depth checkpoints.
- [x] First bundle in bootstrap; refreshed same-pitch/next-pitch bundles after resolution.
- [x] Verified-current saved hydration route and local no-network Hint transitions.
- [x] Legacy one-hint route removed from active client path.
- [x] Answer-integrity/product/API/architecture docs amended.
- [x] Focused tests, full CI, preview, P1 review fixes, merge, production payload/build QA, and runtime-error verification.
- [ ] Real-browser saved hydration and interaction QA remains under hosted verification.

## 4. Completed-game comparison

### 4A. Portable result contract

- [ ] Define a compact transport submission using puzzle identity, ruleset version, client-generated idempotency ID, and nine ordered native at-bat facts.
- [ ] Validate exact puzzle/date/number, pitch order/initials, outcome-to-hint consistency, wrong-guess/resolution consistency, and supported ruleset.
- [ ] Derive score and maximum from engine rules; never trust a submitted total.
- [ ] Define an atomic idempotent repository port: same ID/same payload returns the existing record; same ID/different payload conflicts.
- [ ] Add focused valid, malformed, spoofed-puzzle, inconsistent-fact, retry, and conflict tests.

### 4B. Provider and submission API

- [ ] Add a separate current-results migration rather than reusing inactive legacy attempt/result tables.
- [ ] Add server-only Supabase codec/adapter with RLS and least-privilege grants.
- [ ] Add one public completed-game POST route and generate/persist a stable client submission ID.
- [ ] Submit at most once after completion and retry idempotently after ordinary failures/refresh.
- [ ] Verify no per-action writes and no answer/credential leakage.

### 4C. Aggregate comparison

- [ ] Add same-puzzle/same-ruleset completion count, average score, score distribution, outcome/hint-depth/K/Give Up aggregates.
- [ ] Settle percentile tie treatment and minimum sample copy.
- [ ] Add understandable percentile/sample-size UI by extending the compact scorebook system and preserve raw-fact recalculation.

## 5. Lineup-content system

- [ ] Define gameplay-profile contracts separately from facts.
- [ ] Define versioned lineup recipes with slot groups, filters, difficulty, repeats, and diversity constraints.
- [ ] Make Standard Daily one saved recipe.
- [ ] Establish a conservative “I could have gotten that” pool; only final slot may be deliberate deep challenge.
- [ ] Add reproducible All-Star/award/bWAR enrichment.
- [ ] Add provider-neutral profile/recipe persistence/admin editing in bounded PRs.
- [ ] Preserve manual review/replacement of exact generated nine.

## 6. Launch surfaces

- [ ] Analytics/error monitoring.
- [ ] Finish real-device iPhone/iPad polish and payload measurement after the compact revision is deployed.
- [x] Refine the heritage baseline into the compact baseball scorebook direction after September 8 screenshot review.
- [ ] Privacy, terms, canonical domain, social metadata.

## Deferred public products

Accounts/streaks/cross-device history; native clients; head-to-head/social; public custom/theme libraries before core Daily proves itself; payments before demand.
