# Initial Baseball Current Work

Status: Active ordered implementation plan  
Last updated: 2026-07-31

Completed history belongs in PRs, canonical docs, or `tasks/lessons.md`. Durable resumption context belongs in `docs/START-HERE.md`.

Current order: verify instant hints and hosted operations, then build compact results and the lineup-content system.

## 0. Continuity

- [x] Reconcile hosted configuration, scoring, hints, and lineup-content direction in canonical docs.
- [x] Add tested documentation-impact CI and PR checklist.
- [ ] Decide/test a safe branch-ruleset configuration before making the check mandatory; issue #123.

## 1. Production and hosted verification

- [x] Configure progression, Supabase, and admin secrets for Preview/Production.
- [x] Apply editorial migration and verify RLS/service-role boundaries.
- [x] Verify admin challenge and prior successful editor authentication.
- [x] Merge points-v1 and verify production READY/aliased with `0/45 PTS`, `0/9 AB`, signed ruleset token, hidden-answer QA, full CI/data/build, and no recent runtime errors.
- [ ] Verify midnight-Pacific rollover without redeploy.
- [ ] Verify instant-hint production payload contains only batter one’s hints and no answer/future-batter data.
- [ ] Verify active client chunks contain no exact `/api/daily/hint` request.
- [ ] Verify saved-session `/api/daily/hints` hydration and refresh recovery.
- [ ] Verify seven-day Supabase horizon and missing-draft generation.
- [ ] Preview/search/replace/revalidate one future slot.
- [ ] Schedule one future puzzle and verify public scheduled/published consumption.
- [ ] Verify deterministic fallback for missing/draft records.
- [ ] Verify correct guess, wrong guesses, third strike, Give Up, all-nine continuation, completion, action responses/logs, and common iPhone/iPad behavior.
- [ ] Reconcile issues #97, #91, and #86 after the full hosted checklist.

## 2. Versioned scoring/completion

- [x] `points-v1` and `legacy-inning-v1` contracts.
- [x] Native raw at-bat facts independent of final score.
- [x] `5/4/3/2/1/0`, all scheduled at-bats, legacy compatibility, token/persistence/result/share versioning, focused tests.

## 3. Immediate active-batter hints

- [x] Define an authorized four-hint current-batter bundle with signed later-depth checkpoints.
- [x] Include batter one’s bundle in bootstrap without answer/reveal/future-batter data.
- [x] Return refreshed same-pitch bundle after wrong guesses and next-pitch bundle after terminal resolution.
- [x] Hydrate only the verified current bundle for compatible saved progress.
- [x] Reveal hints locally with no network request on Hint click.
- [x] Prevent returned checkpoints from reducing strike count or reveal depth.
- [x] Keep the legacy one-hint route server-compatible while removing it from the active client path.
- [x] Amend answer-integrity/product/API/architecture docs for the active-hint threat model.
- [ ] Pass focused bundle/checkpoint/client/restore/leakage tests, full CI, preview, review, merge, and production verification.

## 4. Completed-game comparison

- [ ] Define one compact idempotent submission from native raw facts.
- [ ] Persist puzzle identity, ruleset version, ordered facts, and score; no per-action writes.
- [ ] Add same-puzzle/same-ruleset percentile, sample size, average, outcome distribution, solve depth, K and Give Up rates.
- [ ] Preserve recalculation from raw facts.

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
