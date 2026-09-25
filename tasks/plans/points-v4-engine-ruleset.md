# Points-v4 portable Daily Nine rules

Status: row F implementation scope; portable rules only, not public activation  
Date: 2026-09-25

## Scope contract

- **Goal:** define one explicit `points-v4` Daily Nine scoring version in shared/engine while leaving `points-v3` as the current public default.
- **Owning layer:** `packages/shared` owns the portable version ID/type guard; `packages/engine` owns scoring, score range/step, live allowance, terminal interpretation, and all-nine completion.
- **In scope:** v4 outcome values, wrong-guess semantics, Give Up/K semantics, live points remaining, signed nine-at-bat range/step, focused version-boundary tests, and canonical documentation.
- **Out of scope:** result/AB transport acceptance, Supabase schema/RPCs, comparison histograms, browser saves/journal/outbox, scorecards/sharing/how-to UI, archive route activation, and switching the current public ruleset.
- **Acceptance checks:** HR/3B/2B/1B/BB/K score 4/3/2/1/0/-1; wrong guesses one and two do not deduct; a third wrong guess is K; Give Up uses the same K score; nine HRs score 36; nine Ks score -9; all nine at-bats are played; v3 remains 0..63 and remains `CURRENT_DAILY_RULESET_VERSION`.
- **Stop conditions:** if supporting v4 requires widening persisted result contracts, SQL/database constraints, browser persistence, API acceptance, or the live default, stop and leave that work to roadmap rows G/H.

## Rule semantics

`points-v4` scores the native terminal outcome rather than subtracting a separate wrong-guess penalty:

| Outcome | Points |
| --- | ---: |
| HR | 4 |
| 3B | 3 |
| 2B | 2 |
| 1B | 1 |
| BB | 0 |
| K / Give Up | -1 |

Correct outcomes continue to follow the existing reveal ladder: zero through four revealed hints correspond to HR, 3B, 2B, 1B, and BB. Wrong guesses one and two do not change that value. The third wrong guess is terminal K. Existing terminal normalization also represents Give Up as K, so both terminal paths use the same -1 engine rule.

Daily Nine still plays all scheduled at-bats under v4. For nine at-bats the exact score domain is -9 through 36 with integer step 1. The engine exposes that range explicitly so downstream validation/comparison work does not need to duplicate it.

## Compatibility boundary

`points-v4` is added to the broad portable Daily ruleset identity so pure rules can be addressed and tested. It is intentionally not added to schema-1 at-bat or completed-result submission types/validators in this PR. Those contracts remain points-v3 (plus Classic where already supported), as do persistence, comparison, browser delivery, scorecards, archive activation, and public bootstrap selection.

Historical points-v3 scoring remains max(0, 7 - hints - wrong guesses), with K/Give Up at zero and a 0..63 nine-at-bat range. No historical result is reinterpreted.

## Verification

Focused checks:
- `pnpm --filter @initial-baseball/shared test`
- `pnpm --filter @initial-baseball/engine test`
- `pnpm --filter @initial-baseball/shared typecheck`
- `pnpm --filter @initial-baseball/engine typecheck`

Repository-required checks remain the normal CI gate: typecheck, tests, file-size guard, data audit/generation QA, package build order, documentation-impact gate, exact-head Preview, and fresh-eye diff review.

## Documentation impact

Update `docs/spec/engine.md`, `docs/spec/data-model.md`, `docs/product/daily-inning-blueprint.md`, `docs/product/beta-launch-results-archive.md`, `docs/architecture-and-scale-plan.md`, `docs/START-HERE.md`, `tasks/todo.md`, and the September 24 roadmap so they distinguish “portable v4 rule exists” from “v4 is live.” No Supabase or web runtime documentation changes are needed because those layers are deliberately unchanged.
