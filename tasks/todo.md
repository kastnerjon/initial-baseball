# Initial Baseball Current Work

Status: Active ordered implementation plan  
Last updated: 2026-07-31

Completed history belongs in PRs, canonical docs, or `tasks/lessons.md`. Durable resumption context belongs in `docs/START-HERE.md`.

Current order: finish hosted browser/admin verification, then build compact completed-result contracts and persistence, then build the lineup-content system.

## 0. Continuity

- [x] Reconcile hosted configuration, scoring, hints, and lineup-content direction in canonical docs.
- [x] Add tested documentation-impact CI and PR checklist.
- [ ] Decide/test a safe branch-ruleset configuration before making the check mandatory; issue #123.

## 1. Production and hosted verification

- [x] Configure progression, Supabase, and admin secrets for Preview/Production.
- [x] Apply editorial migration and verify RLS/service-role boundaries.
- [x] Verify admin challenge and prior successful editor authentication.
- [x] Merge/verify `points-v1` production with `0/45 PTS`, `0/9 AB`, signed ruleset token, hidden-answer QA, full CI/data/build, and no runtime errors.
- [x] Merge PR #126 and verify production deployment `dpl_DLPirNAwyebFCmyD7cf6xU4MPBnJ` is READY/canonically aliased.
- [x] Verify production initial payload contains exactly one active four-hint bundle with signed checkpoints and no answer/reveal/future-batter bundle.
- [x] Verify active client chunks contain no exact `/api/daily/hint` request and production runtime errors are empty.
- [ ] Verify midnight-Pacific rollover without redeploy.
- [ ] Verify saved-session `/api/daily/hints` hydration and refresh recovery in a real browser.
- [ ] Verify seven-day Supabase horizon and missing-draft generation.
- [ ] Preview/search/replace/revalidate one future slot.
- [ ] Schedule one future puzzle and verify public scheduled/published consumption.
- [ ] Verify deterministic fallback for missing/draft records.
- [ ] Verify correct guess, wrong guesses, third strike, Give Up, all-nine continuation, final reveal/completion, action responses/logs, and common iPhone/iPad behavior.
- [ ] Reconcile issues #97, #91, and #86 after the full hosted checklist.

## 2. Versioned scoring/completion

- [x] `points-v1` and `legacy-inning-v1` contracts.
- [x] Native raw at-bat facts independent of final score.
- [x] `5/4/3/2/1/0`, all scheduled at-bats, legacy compatibility, token/persistence/result/share versioning, focused tests.

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
