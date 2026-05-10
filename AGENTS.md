# Initial Baseball — Agent Operating Manual

Read this before touching code. This repo is optimized for AI-assisted development and maintenance.

## Product summary

Initial Baseball is a baseball guessing-game platform built around player initials, hints, and baseball scoring.

The first product surface is **Daily Inning by Initial Baseball**: a web-first daily puzzle where users bat through one inning against computer-selected players, share their run total and pitch-by-pitch outcomes, and compare how the field did.

The later product surface is the **Initial Baseball mobile app**: async H2H multiplayer with friend games, random opponents, game-only chat, records, and League Lite.

Both surfaces must share the same player database, game engine, hint logic, guess matching, stats formatting, and eventual account/profile system.

## Current build priority

The first playable milestone is **Daily Inning web MVP**.

Do not start broad mobile H2H implementation until the following are working:

- Shared engine and tests.
- Curated player seed.
- Daily puzzle flow.
- Anonymous attempt tracking.
- Spoiler-safe share result.
- Results page with field comparison stats.
- Mobile-friendly web UI.

## Product surfaces

| Surface | Folder | Priority | Purpose |
|---|---|---:|---|
| Daily Inning website | `apps/web` | First | Daily puzzle, anonymous play, sharing, aggregate stats |
| Initial Baseball mobile app | `apps/mobile` | Later | H2H games, random opponents, chat, leagues, records |

## Daily Inning MVP scope

Daily Inning includes:

- Mobile-friendly web experience.
- No login required.
- Anonymous browser/session ID.
- One daily inning shared by all users.
- Computer-selected daily pitches from the seeded player database.
- Initials, hints, guesses, and baseball scoring.
- Play until three outs.
- Shareable result showing initials + user outcome only.
- Results page showing initials + user outcome + aggregate field performance.
- Player names hidden until completion.
- Anonymous Daily history claimable into a real account later.

Daily Inning excludes initially:

- Required login.
- App Store / Play Store.
- Payments.
- H2H multiplayer.
- Chat.
- Leagues.
- Public leaderboards.

## Later mobile app scope

The later Initial Baseball app should include:

- iOS + Android via Expo React Native.
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

Later mobile app excludes initially:

- Paid app / paid leagues / payments.
- League playoffs.
- League-wide chat.
- Public chat rooms.
- Chat media, images, attachments, links.
- Live third-party baseball API calls during gameplay.

## Default scoring

- Initials-only correct guess = Home Run.
- Guess after Hint 1 = Triple.
- Guess after Hint 2 = Double.
- Guess after Hint 3 = Single.
- Guess after Hint 4 = Sacrifice.
- Three wrong guesses = Out / strikeout.

Default Daily hint order:

1. Main decade played in = Triple
2. Teams = Double
3. Position = Single
4. Stats = Sacrifice

## H2H default settings, later

- 3 innings.
- 3 strikes per at-bat.
- 3 outs per half-inning.
- Extra-innings ghost runner ON.
- Allowed innings: 1–9.
- Game settings are proposed/countered/accepted before first pitch.
- Accepted settings are immutable once the game starts.

## Stats hint rules

- Stats hint is configurable in H2H game settings.
- If Stats is included, the Custom Stats Picker requires at least 1 hitter stat and at least 1 pitcher stat.
- If WAR is sourced from Baseball Reference, label it `bWAR` everywhere.
- Alpha hitter stat fields: `bWAR`, `HR`, `RBI`, `BA`, `OBP`, `SLG`, `OPS`, `SB`.
- Alpha pitcher stat fields: `bWAR`, `W`, `L`, `ERA`, `WHIP`, `K`, `SV`, `IP`.
- Daily Inning should use a fixed daily stat configuration unless the spec explicitly changes.

## Non-negotiable engineering rules

1. **Pure engine.** No React, Supabase, network, storage, date reads, or platform APIs inside `packages/engine`.
2. **Shared rules.** Web, mobile, and backend must use the same engine/types where practical.
3. **Canonical players.** A pitch stores `player_id`, not a text answer.
4. **No answer leakage.** Hidden player names/IDs must not be exposed to users before the appropriate reveal/completion point.
5. **Append-only event/result trail.** Store enough per-pitch/per-attempt data to reconstruct Daily results and aggregate stats.
6. **Server authoritative for competitive modes.** H2H game mutations go through Supabase Edge Functions. Clients never directly update authoritative game state.
7. **Small files.** Target <300 lines/source file; hard-review anything >500 lines. No 1,000-line screens.
8. **Obvious names.** Avoid generic `utils.ts`, `helpers.ts`, `misc.ts`. File names should say what behavior lives there.
9. **Tests next to logic.** Every baseball rule gets colocated tests.
10. **Feature flags.** Risky/social features must be disable-able when introduced: random opponents, chat, links, leagues.
11. **No production experiments.** Use dev/staging before production.

## Where to find things

| Need | File/folder |
|---|---|
| Current ordered work | `tasks/todo.md` |
| Prior corrections | `tasks/lessons.md` |
| Product scope | `docs/product/prd.md` |
| Monetization | `docs/product/monetization.md` |
| Platform strategy | `docs/product/platform-strategy.md` |
| Daily Inning | `docs/spec/daily-inning.md` |
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
