# Initial Baseball

Initial Baseball is a baseball guessing-game platform with two product surfaces:

1. **Daily Inning** — a web-first daily puzzle where everyone plays the same inning, shares a spoiler-safe result, and compares how the field did pitch-by-pitch.
2. **Initial Baseball H2H** — a later iOS/Android async multiplayer app with friend games, random opponents, chat, records, and League Lite.

Both surfaces share the same backend, player database, hint generation, guess matching, scoring engine, and eventual user account.

## Current build priority

The first playable milestone is **Daily Inning Web MVP**, not the full mobile app.

Build order:

1. Shared engine, shared types, seeded player database.
2. Daily Inning web private beta.
3. Daily Inning public web launch.
4. Optional account/streak/history layer.
5. Initial Baseball H2H mobile app.

## Build stance

- One monorepo. No separate repos for web/mobile/backend.
- Web-first Daily Inning via Next.js.
- Mobile H2H later via Expo React Native.
- Supabase for Auth, Postgres, Realtime, and Edge Functions.
- Pure TypeScript game engine shared by web, mobile, and server.
- Seeded baseball database. No live third-party baseball API during gameplay.
- Anonymous Daily Inning play by default; users may later claim history into an account.
- Free alpha. No payments in alpha.
- Future monetization: web ads/sponsorships, app Pro, private leagues.
- Codebase optimized for AI-assisted maintenance: small files, explicit names, colocated tests, folder READMEs, source map, and `AGENTS.md`.

## First commands

```bash
pnpm install
pnpm test
pnpm lint
```

Read in order:

1. `AGENTS.md`
2. `tasks/todo.md`
3. `docs/engineering/source-map.md`
4. The spec file for the current task

## Repository layout

```text
apps/web/                 Next.js Daily Inning website
apps/mobile/              Expo React Native H2H app, later milestone
packages/engine/          Pure game rules, scoring, sharing, daily aggregates
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
