# Source Map

Use this map to find the owning document or code layer before changing behavior.

## Product and current state

| Change needed | Go here |
|---|---|
| Resume accurately | `docs/START-HERE.md` |
| Daily behavior and launch promise | `docs/product/daily-inning-blueprint.md` |
| Recognizability, profiles, themes, recipes | `docs/product/lineup-content-system.md` |
| Package ownership and architecture | `docs/architecture-and-scale-plan.md` |
| Active ordered work | `tasks/todo.md` |
| Durable corrections | `tasks/lessons.md` |
| Documentation controls | `docs/engineering/documentation-governance.md` |
| Answer-integrity decision | `docs/decisions/0001-daily-answer-integrity.md` |

## Game and Daily logic

| Change needed | Go here |
|---|---|
| Shared game/result/ruleset types | `packages/shared/src/types/daily.ts` |
| Outcome by hint depth | `packages/engine/src/scoring/getHitResultForRevealCount.ts` |
| Versioned scoring/completion | `packages/engine/src/daily/applyDailyRuleset.ts` |
| Legacy inning application | `packages/engine/src/daily/applyDailyOutcomeToInning.ts` |
| Result/share calculation | `packages/engine/src/daily/createDailyShareResult.ts` and `formatDailyShareText.ts` |
| Guess/search behavior | `packages/engine/src/guesses/` |
| Puzzle recipes/selection/lifecycle/horizon | `packages/daily/src/` |
| Engine contract | `docs/spec/engine.md` |

## Web runtime

| Change needed | Go here |
|---|---|
| Daily page/components | `apps/web/app/` |
| Initial game state | `apps/web/app/dailyClientState.ts` |
| Terminal raw facts | `apps/web/app/dailyAtBatResolution.ts` |
| Local Hint transition | `apps/web/app/dailyHintBundle.ts` |
| Active hint-bundle contract | `apps/web/app/dailyRuntimeContracts.ts` |
| Bootstrap/bundle/resolve authorization | `apps/web/app/dailyRuntimeService.ts` |
| Saved-token bundle hydration route | `apps/web/app/api/daily/hints/route.ts` |
| Legacy one-hint compatibility route | `apps/web/app/api/daily/hint/route.ts` |
| Resolution route | `apps/web/app/api/daily/resolve/route.ts` |
| Signed progression | `apps/web/app/dailyProgressionToken.ts` |
| Browser persistence/migration | `apps/web/app/dailyLocalStorage.ts` |
| API contract | `docs/spec/api.md` |
| Hidden-answer/client-route build QA | `apps/web/scripts/qa-hidden-answer-build.mjs` |
| Canonical runtime composition | `apps/web/app/serverCanonicalRuntime.ts` |
| Admin composition/authorization | `apps/web/app/dailyAdminComposition.ts`, `dailyAdminAuthorization.ts`, `dailyAdminPaths.ts` |
| Supabase editorial adapter | `apps/web/app/supabaseDailyPuzzleRepository.ts` |

## Persistence

| Change needed | Go here |
|---|---|
| Current data model | `docs/spec/data-model.md` |
| Editorial migration | `supabase/migrations/20260721143000_create_daily_editorial_puzzles.sql` |
| Inactive legacy scaffold | `supabase/migrations/000001_initial_schema.sql` |
| Future profile/recipe/result tables | Define portable contracts first, then separate migrations |

## Canonical baseball data

Reviewed source pins/checksums live under `packages/baseball-data/data/canonical/`; generation and QA live under `packages/baseball-data/scripts/`; runtime index/reveal access lives under `packages/baseball-data/src/runtime/`; pipeline rules live in `packages/baseball-data/README.md` and `docs/data/`.

## Boundary rules

- Fix baseball facts in source/normalization/auditable correction.
- Put scoring in engine, recipe evaluation in Daily, and rendering/transport in web.
- Supabase stores operational inputs behind ports; it does not define meaning.
- Do not patch generated artifacts or React to make one player/lineup appear correct.
