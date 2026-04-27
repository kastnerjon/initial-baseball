# Initial Baseball — Agent Operating Manual

Read this before touching code. This repo is optimized for AI-assisted development and maintenance.

## Product summary

Initial Baseball is an async 1v1 mobile baseball guessing game. The pitcher selects a canonical MLB player. The hitter sees initials and may reveal hints. Fewer hints means a better hit. Baseball scoring turns at-bats into innings, runs, wins/losses, head-to-head records, random matchups, and private leagues.

## Alpha scope

Alpha includes:

- iOS + Android via Expo React Native, portrait-only.
- Auth and username required to play.
- Friend games by invite link/code.
- Random opponent matchmaking.
- Game-only text chat.
- Block/report from day one.
- League Lite: private league creation, invite code/link, member list, league games, standings.
- Custom game settings proposal/counterproposal/acceptance before first pitch.
- Configurable hint order.
- Custom Stats Picker for the Stats hint.
- Pitcher-selected canonical player from seeded database.
- Hints pre-populated from the database and editable by pitcher before submission.
- Server-authoritative game mutations.
- Free app; no payments or ads in alpha.

Alpha excludes:

- Computer opponent.
- Paid app / paid leagues / payments.
- League playoffs.
- League-wide chat.
- Public chat rooms.
- Chat media, images, attachments, links.
- Live third-party baseball API calls during gameplay.

## Default alpha settings

- 3 innings.
- 3 strikes per at-bat.
- 3 outs per half-inning.
- Extra-innings ghost runner ON.
- Hint order:
  1. Main decade played in = Triple
  2. Teams = Double
  3. Position = Single
  4. Stats = Bunt
- Initials-only correct guess = Home Run.

## Stats hint rules

- Stats hint is configurable in game settings.
- If Stats is included, the Custom Stats Picker requires at least 1 hitter stat and at least 1 pitcher stat.
- If WAR is sourced from Baseball Reference, label it `bWAR` everywhere.
- Alpha hitter stat fields: `bWAR`, `HR`, `RBI`, `BA`, `OBP`, `SLG`, `OPS`, `SB`.
- Alpha pitcher stat fields: `bWAR`, `W`, `L`, `ERA`, `WHIP`, `K`, `SV`, `IP`.

## Non-negotiable engineering rules

1. **Pure engine.** No React, Supabase, network, storage, date reads, or platform APIs inside `packages/engine`.
2. **Server authoritative.** All game mutations go through Supabase Edge Functions. Clients never directly update authoritative game state.
3. **Canonical players.** A pitch stores `player_id`, not a text answer.
4. **No answer leakage.** Hitter cannot receive hidden answer data before resolution.
5. **Append-only event log.** Every meaningful game action gets a `game_events` row.
6. **Settings immutable after start.** Proposals can change pregame; accepted settings freeze when the game becomes active.
7. **Small files.** Target <300 lines/source file; hard-review anything >500 lines. No 1,000-line screens.
8. **Obvious names.** Avoid generic `utils.ts`, `helpers.ts`, `misc.ts`. File names should say what behavior lives there.
9. **Tests next to logic.** Every baseball rule gets colocated tests.
10. **Feature flags.** Risky social features must be disable-able: random opponents, chat, links, leagues.
11. **No production experiments.** Use dev/staging before production.

## Where to find things

| Need | File/folder |
|---|---|
| Current ordered work | `tasks/todo.md` |
| Prior corrections | `tasks/lessons.md` |
| Product scope | `docs/product/prd.md` |
| Monetization | `docs/product/monetization.md` |
| Platform strategy | `docs/product/platform-strategy.md` |
| Game settings | `docs/spec/game-settings.md` |
| Game rules/engine | `docs/spec/engine.md` |
| Database schema | `docs/spec/data-model.md` |
| API contracts | `docs/spec/api.md` |
| Player data ETL | `docs/spec/etl.md` |
| Random/chat/leagues/social | `docs/spec/stats-social.md` |
| QA | `docs/spec/qa.md` |
| Repo structure | `docs/engineering/repo-structure.md` |
| Environments | `docs/engineering/environments.md` |
| Deployment | `docs/engineering/deployment.md` |
| Source map | `docs/engineering/source-map.md` |
| AI maintenance workflow | `docs/engineering/ai-maintenance.md` |

## Work protocol

1. Pick the next task from `tasks/todo.md`.
2. Read only the relevant specs and source-map entries.
3. Write a brief implementation plan.
4. Implement code and tests together.
5. Run tests/typecheck/file-size check.
6. Update `tasks/lessons.md` when corrected.
7. Do not mark a task complete until tests pass and specs still agree.


## Current product priority

The first playable milestone is Daily Inning web MVP. Do not start broad mobile H2H implementation until shared engine, player seed, daily puzzle flow, sharing, and aggregate stats are working.
