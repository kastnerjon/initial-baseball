# Daily Five and variable-length Custom Lineup — approved product migration
Status: **Stage 1 portable policy implemented; issuance and production rollout pending** (2026-10-13)

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
2. New five-player Universal Daily requires an explicit prospective activation/series or compatible issuance version and a matching five-slot editorial/puzzle generator. The **existing Supabase `daily_editorial_puzzles.selections` and `permanent_daily_issued_puzzles.canonical_player_ids` constraints currently require nine**. Land an isolated additive, version-conditional database constraint/migration PR, then apply and verify it on hosted Supabase **before issuing or scheduling any five-slot inventory**; preserve all nine-player historical versions. Determine the activation date after checking scheduled/published records; never truncate nine-player scheduled content or mutate a published nine.
3. Validations, signed progression and replay/restoration must accept the length authorized for that **specific immutable puzzle**, not the current default for new Dailies. A 5-AB result cannot be accepted against a 9-AB puzzle or vice versa.
4. Dynamic 5-stage progress, `Your Five`, at-bat comparisons, end-of-game charts, share text, game average, max score and score histograms must use five for a new Daily and retain nine for historical Archive/completed views.
5. If the current public Daily and archived Classic share one nine-player lineup, select a safe strategy for Classic (its own frozen nine-player content/issuance or an explicit separately approved change) **before** activating Daily Five. Never silently convert Classic to a five-player game.

### Custom, one through ten

1. Introduce a versioned issued-challenge contract for variable-length challenges; **v1 remains exact-nine**. Keep v1 `custom-nine-v1-` IDs valid and unchanged. Future variable-length issues must be distinguishable and accepted only under their own exact frozen schema.
2. Update pure canonical selection and immutable hint-snapshot validation to enforce `1 <= N <= 10` and exactly `N` unique, supported, ordered canonical IDs with four approved hint values per batter. Error on zero, eleven, duplicates, bad IDs, missing facts, or mismatched snapshot lengths.
3. **Database comes before Custom runtime.** In an isolated SQL-only PR, add reviewed version-conditional Supabase constraints/RPC(s) for the new issued challenge JSON shape, exact immutable `N`-length ledger terminal facts, completed-result arrays and `maximumPoints`/totals (up to 40), slots up to 10, and atomic admission/compare rules. Merge and **hosted-verify the additive migration** before deploying code which depends on it. Preserve v1 rows, RLS, service-role restrictions, append-only behavior and creator-exclusion. Do not replay/rename historical hosted migrations.
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

1. **Implemented — portable length policy (no deployment switch).** `packages/daily` now exports separate legacy Daily/Classic/Custom v1 exact-nine and future Daily Five exact-five/Custom 1–10 length checks with boundary and Custom v1 compatibility tests. The existing nine-player issued puzzle, clue snapshot and Custom v1 validators use the legacy policy, retaining historical errors and schemas. Future policies are not connected to issuance; versioned five-player frozen clue validation remains a later stage.
2. **Daily schema preparation — SQL predecessor prepared; hosted work pending.** Add `lineup_contract_version` to editorial (v1 default: 9; v2: 5) and issued schema v3 (5 frozen clues), retaining exact-nine issued v1/v2. This is a separately scoped migration with transactional rollback tests; independently review, merge, apply to hosted Supabase and verify constraints/permissions **before** any five-slot inserts/inventory. It does not deploy an issuing consumer or enable public Daily Five.
3. **Daily Five issuance and editor/content preparation.** Versioned five-slot generator/editor/issuance validation with nine-slot read compatibility; only after stage 2 hosted verification. Inspect existing scheduled lineup inventory and reconcile approvals, without truncating nine-player records.
4. **Daily Five browser/server result compatibility.** In separately scoped PRs as necessary, update five-stage progression, signed attempts, authoritative completed-result validation, browser hydration and history, score/comparison charts and share UX, while retaining Archive nine and Classic independence. No public switch until all checks pass.
5. **Custom schema and RPC predecessor — database-only.** Add versioned 1–10 constraints and service-role-only atomic admission/bucket functions, while retaining exact-nine Custom v1 behavior. Review SQL/RLS and transaction-rollback fixtures, merge, apply and hosted-verify **before** any variable-length runtime consumer deploys. Neither public creation nor competition activated.
6. **Custom portable challenge contract and issuance.** A separate portable `packages/daily` PR for versioned 1–10 selection and immutable hint snapshot, plus a bounded Web/private issuance/adapter PR after stage 5 hosted verification; the currently issued v1 exact-nine contract remains supported.
7. **Custom signed/private runtime.** In narrow sequential Web-owned PRs, update server-monotonic signed bootstrap/hints/resolve, exact-N terminal/completion/admission, and then comparison population reads. Every step must fail closed if a required hosted object or version is missing; no browser-chosen count.
8. **Custom creator/player presentation.** Enable selecting and playing 1–10 via responsive accessible UI and challenge-scoped scores, with separate guarded activation/abuse review. Old v1 links and results remain playable. Maintain default-disabled Custom submission/comparison switches until authorized.
9. **Controlled prospective Daily Five cutover.** Only after five-player approved inventory, Classic nine-player independence, client/server/schema compatibility, CI/Preview, mobile QA, cohort isolation and rollback plan. Release via explicit new date/version, with full post-merge and hosted verification.

Each implementation PR must define its own scope contract, docs impact, independent review, exact-head CI, READY Vercel Preview and production verification. Never combine Daily and Custom schema changes, and never deploy a consumer before its hosted dependency is verified.

## Acceptance at final rollout

- Current Daily Five: exactly five, max 20, complete after fifth terminal resolution.
- Custom Lineup: exactly the creator's 1–10 ordered distinct selections, max `4 × N`; completion only after all N.
- Previously issued nine-player Daily/Archive/Custom and Classic flows remain intact at their original lengths and scores.
- No cross-population contamination, stale save reassignment, spoofed completion, hidden-answer leak, unsafe migration, or unintended activation.
