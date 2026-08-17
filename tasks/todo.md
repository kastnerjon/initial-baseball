# Initial Baseball Current Work

Status: Active ordered implementation plan  
Last updated: 2026-08-16

Completed history belongs in PRs, canonical docs, or `tasks/lessons.md`. Durable resumption context belongs in `docs/START-HERE.md`.

Current order: finish the resolution hot-path fix and production mobile latency retest as part of public real-browser gameplay QA, then authenticated admin QA when the editor is available, then completed-result contracts and persistence, then the lineup-content system.

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
- [x] Verify production bootstrap shows `0/36 PTS`, `0/9 AB`, a signed `points-v2` token, one current-batter hint bundle, no answer/reveal/future-batter bundle, and no recent runtime errors.
- [x] Merge PR #132 and verify production deployment from merge SHA `a942bab74a68077a1c6ed1aff37b16af45ccc685` is READY/canonically aliased.

### Public real-browser gameplay

- [x] Add immediate Give Up and Submit Guess pending feedback plus initial resolve timing instrumentation.
- [x] Confirm from production device/log evidence that Submit Guess can still take roughly two seconds even when requests succeed, establishing a real hot-path performance defect rather than an error/retry issue.
- [x] Implement the bounded hot-path optimization: cache the fully materialized server-only puzzle, lazy-load lineup/Supabase composition on cache miss, separate search initialization from resolution, avoid full canonical-index loading for ordinary canonical guesses, and use direct reveal-shard access for terminal resolution.
- [x] Keep resolve `Server-Timing` as the handler-level diagnostic and use it with phone end-to-end timing to separate remaining platform/network overhead from server work.
- [ ] After merge, verify production iPhone Submit Guess and Give Up end-to-end latency and compare it with the handler-level server timing; do not mark responsiveness solved from CI/preview alone.
- [ ] Verify resolved `points-v2` outcome plus awarded-point presentation.
- [ ] Verify saved-session `/api/daily/hints` hydration and refresh recovery.
- [ ] Verify correct guess, wrong guesses, third strike, Give Up responsiveness/reveal, all-nine continuation, final reveal/completion, action responses/logs, and common iPhone/iPad behavior.

### Authenticated editorial workflow

- [ ] Verify seven-day Supabase horizon and missing-draft generation.
- [ ] Preview/search/replace/revalidate one future slot.
- [ ] Schedule one future puzzle and verify public scheduled/published consumption.
- [ ] Verify deterministic fallback for missing/draft records.
- [ ] Reconcile issues #97, #91, and #86 after the full hosted checklist.

### Timed production observation

- [x] Verify midnight-Pacific rollover without a coincident redeploy: production advanced from July 31, 2026 / Daily #96 to August 1, 2026 / Daily #97 while deployment `dpl_Bp2gX76FqxQXpjCgAbMY76nUyqwC` remained current.

## 2. Versioned scoring/completion

- [x] `legacy-inning-v1` compatibility contract.
- [x] `points-v1` compatibility contract: `5/4/3/2/1/0`, 45-point maximum.
- [x] `points-v2` current contract: `4/3/2/1/0.5/0`, 36-point maximum.
- [x] Native raw at-bat facts independent of final score.
- [x] Ruleset versioning through signed tokens, local persistence, results, and sharing.
- [x] Resolved at-bat display derives and shows awarded points beside the baseball outcome for point rulesets only.
- [x] Focused tests, full CI, preview, three review passes, merge, production bootstrap verification, and runtime-error verification for `points-v2`.

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
- [ ] Add understandable percentile/sample-size UI and preserve raw-fact recalculation.

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
- [ ] iPhone/iPad polish and payload measurement.
- [ ] Heritage ballpark/scorecard/1970s-card presentation after mechanics.
- [ ] Privacy, terms, canonical domain, social metadata.

## Deferred public products

Accounts/streaks/cross-device history; native clients; head-to-head/social; public custom/theme libraries before core Daily proves itself; payments before demand.
