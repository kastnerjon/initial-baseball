# Initial Baseball

Async 1v1 mobile baseball guessing game. One player pitches a canonical MLB player by initials; the hitter guesses with optional hints. Fewer hints means a better hit. Baseball scoring turns guesses into innings, runs, outs, records, random matchups, and private leagues.

## Build stance

- Mobile-first: iOS + Android via Expo React Native.
- One monorepo. No separate iOS/Android/backend repos.
- Supabase for Auth, Postgres, Realtime, Edge Functions.
- Pure TypeScript game engine shared by client and server.
- Seeded baseball database. No live third-party baseball API during gameplay.
- Free alpha. No payments in alpha.
- Alpha includes friend games, random opponents, game-only chat, and League Lite.
- Codebase optimized for AI-assisted maintenance: small files, explicit names, colocated tests, folder READMEs, source map, and `AGENTS.md`.

## First commands

```bash
pnpm install
pnpm test
pnpm lint
```

The first real engineering task is **not UI polish**. It is shared types + pure engine + tests.

Read in order:

1. `AGENTS.md`
2. `tasks/todo.md`
3. `docs/engineering/source-map.md`
4. The spec file for the current task

## Repository layout

```text
apps/mobile/              Expo React Native app
packages/engine/          Pure game rules and scoring
packages/shared/          Shared types, constants, validators
packages/baseball-data/   Player data ingestion/normalization helpers
supabase/migrations/      Database schema migrations
supabase/functions/       Edge Function skeletons
docs/                     Product, spec, engineering, QA docs
tasks/                    Ordered tasks and lessons learned
```

## Environments

Use three Supabase projects:

- `initial-baseball-dev`
- `initial-baseball-staging`
- `initial-baseball-prod`

Production keys should not be given to coding agents early. Use dev/staging for agent work.
