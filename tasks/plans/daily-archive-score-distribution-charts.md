# Daily and Archive end-of-game score distributions

Status: chart UI stage in review, October 11, 2026.

## Scope contract

**Goal:** Show real per-AB 100% stacked point distributions and completed-game score histogram on terminal Daily Nine and playable Archive points-v4 scorecards.

**Owner:** apps/web comparison presentation and React components. Use existing engine-owned score ranges, browser comparison histograms, and exact-puzzle/ruleset population reads.

**In scope:** Preserve received completed histogram in comparison state; pure browser presentation models deriving actual bucket counts and labels from engine rules; accessible compact stacked bars and final histogram with own-score markers and tap/keyboard inspect controls; loading/zero/single/irregular/tie/reset cases; documentation.

**Out of scope:** New SQL/API, score-rule changes, new dependencies, Custom Nine comparison activation, new authentication or result identity, archive population mixing, and refactoring existing gameplay.

**Acceptance:** Peer-only 100% column normalization, sparse half-point score histogram, marker alignment, strict-lower BEAT and inclusive percentile retained, nine slots and 0–36 v4 range derived from the engine, empty/unavailable distinction, mobile no-overflow rendering, focused regressions, exact-head CI, READY preview, one independent review, postmerge verification.

**Stop:** Any need to change comparison API/schema, eligibility, engine scoring, persisted result identity or Custom competitive feature flags requires a separate PR.

After chart release, immediately resume the private Custom Nine comparison-provider/decoder stage documented in `tasks/plans/custom-nine-mvp.md` and `docs/START-HERE.md`. No public Custom Nine feature setting is modified here.
