# Initial Baseball

Initial Baseball is currently one product: **Daily Inning**, a browser-first daily baseball guessing game. Everyone receives the same nine-player inning, guesses players from their initials and revealed hints, then sees accurate career and season information after each at-bat.

A future native client or head-to-head mode is possible, but neither is a committed roadmap item. The code should preserve inexpensive portability without adding infrastructure for hypothetical products.

## Current product state

The Daily web game is implemented and deployed through Next.js/Vercel. Current work is focused on:

1. replacing the legacy player dataset with the validated canonical identity and statistics pipeline;
2. connecting the canonical runtime payload to search and player reveals;
3. completing the season-by-season reveal experience;
4. applying the nine-slot recognizability curve and repeat protections;
5. adding an editorial workflow for tomorrow's lineup;
6. adding aggregate results, monitoring, and launch hardening.

The canonical data pipeline currently produces identity, season, career, enrichment, and runtime-serving artifacts as shadow outputs. The live game is not migrated merely because a shadow artifact exists.

## Architecture stance

- One monorepo.
- Browser-first Daily Inning through Next.js.
- Pure TypeScript game rules and Daily logic outside React.
- Generated baseball data owned by `packages/baseball-data`.
- Daily puzzle construction owned by `packages/daily`.
- No live third-party baseball API during gameplay.
- Client-driven anonymous gameplay; persistence is added only behind repository/service boundaries.
- Vercel is the current web host, not a permanent data or domain lock-in.
- A custom domain can be attached without changing the game engine or canonical data contracts.

## Repository layout

```text
apps/web/                 Next.js Daily Inning website
apps/mobile/              Inactive future-client scaffold
packages/shared/          Stable cross-platform types and schemas
packages/engine/          Pure game and baseball rules
packages/baseball-data/   Sources, canonical identity/stats pipeline, QA, runtime artifacts
packages/daily/           Daily numbering, lineup generation, overrides, session logic
supabase/                  Persistence scaffolding and future adapters
docs/                     Product, architecture, specifications, QA, and data contracts
tasks/                    Current ordered work and durable lessons
```

## First commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
```

Read in order:

1. `AGENTS.md`
2. `tasks/todo.md`
3. `docs/architecture-and-scale-plan.md`
4. `docs/product/daily-inning-blueprint.md`
5. the specification or data contract for the current task

## Canonical baseball-data flow

```text
canonical identity
  -> Lahman-first player universe
  -> season source facts
  -> player-season aggregates
  -> season cards
  -> career aggregates
  -> career cards
  -> season and career enrichment
  -> lightweight player index + reveal shards + legacy redirects
  -> later web runtime migration
```

Identity owns display names and aliases. Season records own season facts. Career records summarize seasons. Enrichment owns derived or separately sourced facts. The runtime payload joins these layers but does not calculate baseball statistics.

See `packages/baseball-data/README.md` and `docs/data/canonical-runtime-payload.md`.

## Daily web development

Local development:

```bash
corepack pnpm install
corepack pnpm --filter @initial-baseball/web dev
```

Production build:

```bash
corepack pnpm build:web
```

Vercel deployment notes:

- Deploy the monorepo as the existing Next.js project.
- Set `NEXT_PUBLIC_SITE_URL` to the canonical public origin when a domain is connected.
- Daily puzzles reset at midnight Pacific Time.
- Manual Daily puzzle configuration remains code-based in `apps/web/app/dailyPuzzleOverrides.ts` until the admin publication workflow replaces it.
