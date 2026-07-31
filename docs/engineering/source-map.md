# Source Map

Use this map to find the owning document or code layer before changing behavior.

## Product and current state

| Change needed | Go here |
|---|---|
| Resume project accurately | `docs/START-HERE.md` |
| Daily product behavior and launch promise | `docs/product/daily-inning-blueprint.md` |
| Recognizability, gameplay profiles, themes, and recipes | `docs/product/lineup-content-system.md` |
| Package ownership and launch architecture | `docs/architecture-and-scale-plan.md` |
| Active ordered work | `tasks/todo.md` |
| Durable mistakes/corrections | `tasks/lessons.md` |
| Documentation/continuity controls | `docs/engineering/documentation-governance.md` |
| PR checklist | `.github/pull_request_template.md` |
| Documentation-impact gate | `scripts/check-docs-impact.mjs` and `.github/workflows/ci.yml` |

## Game and Daily logic

| Change needed | Go here |
|---|---|
| Shared serialized game/result types | `packages/shared/src/types/` |
| Outcome by hint depth | `packages/engine/src/scoring/getHitResultForRevealCount.ts` |
| Daily outcome application and current inning state | `packages/engine/src/daily/applyDailyOutcomeToInning.ts` |
| Runner/base advancement | `packages/engine/src/scoring/advanceRunners.ts` |
| Guess evaluation/search behavior | `packages/engine/src/guesses/` |
| Engine contract | `docs/spec/engine.md` |
| Puzzle selection, recipes, validation, lifecycle, and horizon | `packages/daily/src/` |
| Public editorial selection contract | `docs/spec/public-daily-editorial-runtime.md` |

## Web runtime

| Change needed | Go here |
|---|---|
| Daily pages/components | `apps/web/app/` |
| Browser persistence/migration | `apps/web/app/dailyLocalStorage.ts` |
| Guarded bootstrap, hints, and resolution | `apps/web/app/dailyRuntimeService.ts` |
| Signed progression | `apps/web/app/dailyProgressionToken.ts` |
| Canonical runtime composition | `apps/web/app/serverCanonicalRuntime.ts` |
| Search/hint/resolution routes | `apps/web/app/api/players/` and `apps/web/app/api/daily/` |
| Admin composition | `apps/web/app/dailyAdminComposition.ts` |
| Admin authorization | `apps/web/app/dailyAdminAuthorization.ts` and `apps/web/app/dailyAdminPaths.ts` |
| Supabase client | `apps/web/app/serverSupabaseClient.ts` |
| Editorial repository adapter | `apps/web/app/supabaseDailyPuzzleRepository.ts` |
| Editorial row codec | `apps/web/app/supabaseDailyPuzzleRowCodec.ts` |

## Persistence

| Change needed | Go here |
|---|---|
| Current data model | `docs/spec/data-model.md` |
| Editorial migration | `supabase/migrations/20260721143000_create_daily_editorial_puzzles.sql` |
| Inactive legacy scaffold | `supabase/migrations/000001_initial_schema.sql` |
| Future gameplay-profile/recipe/result tables | Define provider-neutral contracts first, then add separate migrations |

## Canonical baseball data

| Change needed | Go here |
|---|---|
| Reviewed source pins/checksums | `packages/baseball-data/data/canonical/` |
| Identity/canonical universe generation | `packages/baseball-data/scripts/` canonical identity/universe modules |
| Season facts and aggregates | canonical season generation scripts |
| Career facts and enrichment | canonical career generation scripts |
| Runtime index/reveal shards | `packages/baseball-data/src/runtime/` and runtime generation scripts |
| Runtime QA | `packages/baseball-data/scripts/qa-canonical-runtime-consumer.mjs` |
| Pipeline overview | `packages/baseball-data/README.md` |
| Enrichment rules | `docs/data/canonical-career-enrichment.md` |
| Runtime payload contract | `docs/data/canonical-runtime-payload.md` |

## Boundary rules

- Fix factual baseball errors in source, normalization, or auditable corrections.
- Put scoring/completion in the engine, recipe evaluation in Daily, and rendering/transport in web.
- Store operational inputs behind repository ports; do not make Supabase rows the owner of domain meaning.
- Do not patch generated artifacts or React to make one player or one lineup appear correct.
