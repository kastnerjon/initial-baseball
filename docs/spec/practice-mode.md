# Practice Mode Spec

## Purpose

Practice Mode is the app's batting cage. The user plays as hitter against the computer, which randomly pitches canonical players from the seeded player database.

Practice is meant to help users learn the game, test hint settings, and play when no friend/random opponent is available.

## Alpha scope

Practice Mode includes:

- A dedicated Practice section from Home.
- Computer randomly selects a canonical player.
- User sees initials first.
- User can reveal hints in the selected practice settings order.
- User guesses free-text.
- Correct guesses produce HR/Triple/Double/Single/Sacrifice based on reveal count.
- Wrong guesses produce strikes.
- Practice can use the same default settings and Custom Stats Picker as multiplayer.
- Practice uses the same seeded player database and same hint generation code.

Practice Mode excludes in alpha:

- Practice results affecting public records.
- Practice results affecting head-to-head records.
- Computer batting against the user.
- AI-written clues.
- Chat.
- Leaderboards.

## Product rule

Practice results are separate from competitive records.

Competitive stats answer: "How did I do against people?"
Practice stats answer: "How am I training?"

## Default practice settings

Default practice settings should mirror the alpha multiplayer defaults:

| Setting | Default |
|---|---:|
| Innings/session style | Quick practice round |
| Strikes per player | 3 |
| Triple hint | Main decade played in |
| Double hint | Teams |
| Single hint | Position |
| Sacrifice hint | Stats |
| Stats Picker | Default alpha stats |

Practice may later support timed drills, streak mode, or nine-player rounds, but alpha should start simple.

## Plain-English flow

1. User taps Practice.
2. App starts a practice round.
3. Computer selects a random canonical player from the seeded database.
4. App shows initials.
5. User may guess immediately or reveal hints.
6. App checks guess against the canonical player and aliases.
7. App shows result and moves to the next random player.

## Data and architecture

Practice should reuse existing systems:

- `players` table for canonical player selection.
- `player_career_stats` for Stats hint.
- shared hint generation functions.
- shared guess matching functions.
- shared game settings validation.

Practice should not duplicate baseball logic.

## Backend approach

Alpha may implement Practice in either of two ways:

### Simple alpha approach

Client requests a random player and generated hints from an Edge Function. The client stores the active practice answer in local state while the round is active. This is acceptable because Practice is not competitive.

### More authoritative approach

Server creates `practice_sessions` and `practice_rounds`, stores the canonical `player_id`, and exposes only safe hint payloads to the client. Guesses are submitted to the server.

Recommendation: start with the simple alpha approach unless it becomes easy to use the more authoritative approach while implementing multiplayer server functions.

## Storage

Practice history is optional for alpha. If stored, it must be separated from competitive game records.

Suggested tables:

- `practice_sessions`
- `practice_rounds`

Do not include practice wins/losses in `user_stats` or `head_to_head_stats`.

## Random player selection

Initial alpha can use simple random selection from the eligible seeded player pool.

Future filters may include:

- all-time players
- active players
- Hall of Famers
- hitters only
- pitchers only
- decade
- difficulty tier

## QA cases

- Practice starts without opponent.
- Random player has valid initials.
- Hints match practice settings.
- Stats hint uses selected stats.
- Guess matching accepts aliases.
- Wrong guesses add strikes.
- Correct guesses produce correct hit result.
- Practice results do not affect multiplayer records.
