# Daily Five and variable-length Custom Lineup — approved product migration
Status: **Approved product direction, implementation not started** (2026-10-13)

## Owner decision and current-state boundary

- **Universal Daily becomes Daily Five:** exactly five ordered at-bats, points-v4 outcomes/scoring unchanged, maximum 20 points.
- **Custom Lineup:** creator selects any integer number of distinct canonical players from **1 through 10**, inclusive, ordered as submitted. Points-v4 maximum is `4 × selected player count` (4–40). No mandatory minimum of five.
- Existing nine-player Daily/Archive puzzles and already-issued nine-player Custom challenges retain their frozen content, original score maxima, attempts, comparisons, URLs and share/history semantics. Do not retroactively shorten any issued game.
- **No feature is activated by this plan**. The current Daily Nine (nine) and Custom Nine v1 (exactly nine, privately staged) remain implemented/current until their separately reviewed releases. Custom competition remains default disabled.
- Rename player-facing concepts when functionality is ready: `Daily Five`, `Your Five`, and `Custom Lineup`. Existing stable internal identifiers/table names need not be renamed; old share links must still resolve.

## Architectural constraints

The existing `DAILY_AT_BAT_COUNT = 9` is shared by Universal selection, issued puzzle checks and Custom validation. Never turn it into `5` globally: that would reject old puzzles, break Classic and inadvertently affect Custom. Distinguish **mode-specific new-issuance policy** from **per-issued-puzzle historical length**, and derive gameplay totals from authoritative puzzle content.

### Issued Daily and archive

1. Preserve exact nine-player published/archived puzzles and previously accepted nine-player browser results. Classic stays its own versioned game, including its existing nine-player puzzle policy until separately decided.
2. New five-player Universal Daily requires an explicit prospective activation/series or compatible issuance version and a matching five-slot editorial/puzzle generator. Determine the activation date after checking scheduled/published records; never truncate nine-player scheduled content or mutate a published nine.
3. Validations, signed progression and replay/restoration must accept the length authorized for that **specific immutable puzzle**, not the current default for new Dailies. A 5-AB result cannot be accepted against a 9-AB puzzle or vice versa.
4. Dynamic 5-stage progress, `Your Five`, at-bat comparisons, end-of-game charts, share text, game average, max score and score histograms must use five for a new Daily and retain nine for historical Archive/completed views.
5. If the current public Daily and archived Classic share one nine-player lineup, select a safe strategy for Classic (its own frozen nine-player content/issuance or an explicit separately approved change) **before** activating Daily Five. Never silently convert Classic to a five-player game.

### Custom, one through ten

1. Introduce a versioned issued-challenge contract for variable-length challenges; **v1 remains exact-nine**. Keep v1 `custom-nine-v1-` IDs valid and unchanged. Future variable-length issues must be distinguishable and accepted only under their own exact frozen schema.
2. Update pure canonical selection and immutable hint-snapshot validation to enforce `1 <= N <= 10` and exactly `N` unique, supported, ordered canonical IDs with four approved hint values per batter. Error on zero, eleven, duplicates, bad IDs, missing facts, or mismatched snapshot lengths.
3. Update private storage with reviewed additive Supabase migration(s): issued challenge JSON shape; attempt ledger terminal fact count; completed-result per-AB arrays and `maximumPoints`/totals (up to 40); slot constraints up to 10; exact-length atomic submission/compare rules. Preserve v1 rows, RLS, service-role restrictions, append-only behavior and creator-exclusion. Do not replay/rename historical hosted migrations.
4. Bind Custom signed opening/hint/guess/terminal tokens, server-monotonic first attempt, completion verifier and private RPC admission to immutable challenge-specific `N`. Never trust a browser-supplied number of at-bats; reject replay/mismatch/early completion.
5. Private comparison and leaderboard populations remain keyed by exact immutable challenge identity/version, including a dynamic `N`-bucket set. Never combine Custom with Universal or different Custom lineups; percentages/averages must use the correct population.
6. Adjust admin Custom creator UI and eventual player-facing challenge page, progress, preview, results, sharing and accessibility for 1–10. Only enable public creation or competition after the separately required abuse/integrity decision.

### Scoring, safety, and compatibility

- Retain per-batter points-v4 awards: HR 4, 3B 3, 2B 2, 1B 1, BB 0.5, K 0. Maximum is `4 × N`; scores advance in 0.5 steps. No new per-batter ruleset is required merely by changing count.
- Keep signed server authority and no future-player answer leakage. Preserve idempotent first contribution, current hint boundaries, exact puzzle/ruleset cohort separation and browser save keys.
- Exact length must be enforced at issue, bootstrap, action/terminal resolution, result validation, storage and retrieval. UI-only `slice(0, 5)` and global constant replacement are explicitly prohibited.
- 1-, 5-, 9- and 10-AB cases plus malformed 0/11, mismatched frozen values, old v1 nine-player fixtures, score limits 4/20/36/40 and archive restoration are mandatory regression scenarios.
- No live data/production setting modification is authorized by this plan.

## Ordered, bounded PR stages (one PR at a time)

1. **Portable policy and exact-identity compatibility.** Identify separate Universal future-issuance, Classic legacy and Custom length policies; establish versioned canonical pure validation with tests (1, 5, 9, 10), preserving all existing nine-player behavior and persisted identities.
2. **New Daily Five issuance and source content.** Versioned five-slot editorial/generator/issuance validation, with read support for historical nine and no production activation. Check existing scheduled lineup inventory before rollout and reconcile editor tools.
3. **Daily Five browser/result semantics.** Five-stage score/progress, restored sessions, server-verified completion, signed hints, correct max, comparison/stat distributions, share, labels and Archive compatibility. No public switch until historical/Classic isolation is proven.
4. **Custom 1–10 storage and private runtime.** Reviewed additive schema migration and versioned challenge selection/issuance, private runtime signed progression, atomic N-fact admission and N-bucket comparison, with focused transaction-rollback fixtures. Apply hosted migration only after merge/approval. Keep submission/competition disabled.
5. **Custom creator/player UI and separate activation.** Up-to-10 creator selection and correct short/long challenge layouts, then distinct guarded release/abuse review and production checks. Historical Custom v1 links remain supported.
6. **Controlled prospective Daily Five cutover.** Only after editorial five-player inventory, Classic nine-player independence, client/server/DB compatibility, CI, preview, mobile QA, cohort isolation and rollback plan are verified. Release via explicit date/version, with full post-merge and hosted verification.

Each implementation PR must define its own scope contract, docs impact, independent review, exact-head CI, READY Vercel Preview and production verification. Avoid blending Daily rollout with Custom schema changes in one PR.

## Acceptance at final rollout

- Current Daily Five: exactly five, max 20, complete after fifth terminal resolution.
- Custom Lineup: exactly the creator's 1–10 ordered distinct selections, max `4 × N`; completion only after all N.
- Previously issued nine-player Daily/Archive/Custom and Classic flows remain intact at their original lengths and scores.
- No cross-population contamination, stale save reassignment, spoofed completion, hidden-answer leak, unsafe migration, or unintended activation.
