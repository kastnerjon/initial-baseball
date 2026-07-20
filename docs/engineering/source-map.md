# Source Map

Use this to find the owning file or package before changing behavior.

## Product and architecture

| Change needed | Go here |
|---|---|
| Current product behavior and scope | `docs/product/daily-inning-blueprint.md` |
| Package ownership and launch architecture | `docs/architecture-and-scale-plan.md` |
| Player identity and data-quality rules | `docs/spec/player-data-quality.md` |
| Documentation maintenance rules | `docs/engineering/documentation-governance.md` |
| Current ordered implementation work | `tasks/todo.md` |
| Durable mistakes and corrections | `tasks/lessons.md` |

## Game and Daily logic

| Change needed | Go here |
|---|---|
| Shared game/stat types | `packages/shared/src/types/` |
| Initials generation | `packages/engine/src/hints/generateInitials.ts` |
| Stats hint formatting | `packages/engine/src/hints/buildStatsHint.ts` |
| Correct outcome by hint count | `packages/engine/src/scoring/getHitResultForRevealCount.ts` |
| Runner advancement, including walks | `packages/engine/src/scoring/advanceRunners.ts` |
| Guess matching | `packages/engine/src/guesses/matchGuessToPlayer.ts` |
| Daily numbering, lineup generation, legacy-hash preservation, canonical deduplication, overrides, and session behavior | `packages/daily/src/` |
| Interim manual Daily overrides | `apps/web/app/dailyPuzzleOverrides.ts` |
| Daily product rules | `docs/product/daily-inning-blueprint.md` |
| Engine rules | `docs/spec/engine.md` |

## Web application

| Change needed | Go here |
|---|---|
| Daily web routes and components | `apps/web/app/` |
| Browser persistence and saved-game migration | `apps/web/app/dailyLocalStorage.ts` |
| Public Daily session and guarded hint/reveal service | `apps/web/app/dailyRuntimeService.ts` |
| Signed Daily pitch/hint/strike/out progression | `apps/web/app/dailyProgressionToken.ts` |
| One-time token consumption and exact-retry idempotency | `apps/web/app/dailyProgressionReplayStore.ts` |
| Canonical reveal presentation, including two-way stat lines | `apps/web/app/canonicalRevealViewModel.ts` |
| Web canonical runtime and provider adapters | `apps/web/app/serverCanonicalRuntime.ts` |
| Search, hint, and resolution routes | `apps/web/app/api/players/` and `apps/web/app/api/daily/` |
| Admin UI and publication adapters | `apps/web/app/` behind repository/service boundaries |
| Supabase schema, when persistence is introduced | `supabase/migrations/` |
| Edge Functions, when a server function is required | `supabase/functions/` |

## Canonical baseball data

| Change needed | Go here |
|---|---|
| Reviewed Chadwick source pin | `packages/baseball-data/data/canonical/chadwick-source.json` |
| Committed reviewed identity snapshot | `packages/baseball-data/data/canonical/identity-snapshot/` |
| Pinned identity refresh orchestration | `packages/baseball-data/scripts/generate-reviewed-canonical-identities.mjs` |
| Identity snapshot update and exact verification | `packages/baseball-data/scripts/update-reviewed-identity-snapshot.mjs` |
| Offline snapshot materialization for production builds | `packages/baseball-data/scripts/materialize-reviewed-identity-snapshot.mjs` |
| Canonical identity candidate generation | `packages/baseball-data/scripts/generate-canonical-identities.mjs` |
| Identity graph and canonical IDs | `packages/baseball-data/scripts/canonical-identity-core.mjs` |
| Lahman-first player universe and redirects | `packages/baseball-data/scripts/generate-canonical-universe.mjs` |
| Universe eligibility and identity assembly | `packages/baseball-data/scripts/canonical-universe-core.mjs` |
| Canonical season source facts | `packages/baseball-data/scripts/generate-canonical-season-facts.mjs` |
| Player-season aggregation | `packages/baseball-data/scripts/generate-canonical-season-aggregates.mjs` |
| Season reveal cards | `packages/baseball-data/scripts/generate-canonical-season-cards.mjs` |
| Exhaustive season-card QA | `packages/baseball-data/scripts/qa-canonical-season-cards.mjs` |
| Career aggregation | `packages/baseball-data/scripts/generate-canonical-career-aggregates.mjs` |
| Career reveal cards and player classification | `packages/baseball-data/scripts/generate-canonical-career-cards.mjs` |
| Season advanced/enrichment fields | `packages/baseball-data/scripts/generate-canonical-season-enrichment.mjs` |
| Career advanced/enrichment fields and Hall of Fame | `packages/baseball-data/scripts/generate-canonical-career-enrichment.mjs` |
| Lightweight runtime index, redirects, and reveal shards | `packages/baseball-data/scripts/generate-canonical-runtime-payload.mjs` |
| Canonical index, redirect, and reveal-shard access | `packages/baseball-data/src/runtime/` |
| Runtime consumer regression QA | `packages/baseball-data/scripts/qa-canonical-runtime-consumer.mjs` |
| Canonical data scripts and current runtime distinction | `packages/baseball-data/README.md` |
| Enrichment contract and missing-data rules | `docs/data/canonical-career-enrichment.md` |
| Runtime serving contract | `docs/data/canonical-runtime-payload.md` |
| Canonical pipeline CI order and artifacts | `.github/workflows/ci.yml` |

## Boundary rule

Fix a wrong baseball fact in source data, normalization, or an auditable correction. Do not patch generated artifacts, React components, routes, or reveal formatting to make one player look correct.
