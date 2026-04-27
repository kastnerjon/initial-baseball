# API / Edge Function Spec

All authoritative mutations go through Supabase Edge Functions.

## Required rules

Every function must:

1. Authenticate caller.
2. Validate input.
3. Check permissions.
4. Use transactions/row locks where game state can race.
5. Write `game_events` for meaningful actions.
6. Return sanitized data.
7. Never leak hidden answer data to hitter.

## Game settings functions

| Function | Purpose |
|---|---|
| `create-game-proposal` | Create invite/proposal with settings. |
| `counter-game-proposal` | Edit/counter latest proposal. |
| `accept-game-proposal` | Accept latest proposal and create/activate game. |

## Gameplay functions

| Function | Purpose |
|---|---|
| `submit-at-bat` | Pitcher selects canonical player, reviews/edit hints, submits at-bat. |
| `reveal-hint` | Hitter reveals next configured hint. |
| `submit-guess` | Hitter submits guess; server resolves strike/hit/out/game state. |

## Random opponent functions

| Function | Purpose |
|---|---|
| `join-matchmaking` | Enter random opponent queue with proposed settings. |
| `leave-matchmaking` | Exit queue. |

Matchmaking must respect blocks and feature flag `random_opponents_enabled`.

## Chat/safety functions

| Function | Purpose |
|---|---|
| `send-game-message` | Send game-only text message. |
| `report-message` | Report a specific game message. |
| `block-user` | Block user and prevent future random matches. |

Chat must respect:

- `chat_enabled`
- `chat_links_enabled`
- `chat_media_enabled`

Alpha should reject links/media.

## League Lite functions

| Function | Purpose |
|---|---|
| `create-league` | Create private league with invite code/link. |
| `join-league` | Join league by invite code. |
| `create-league-game` | Create game that counts toward league standings. |

Alpha league scope: private creation, invite/join, members, games, standings. No playoffs, no league chat, no paid leagues.

## Idempotency and race protection

Use idempotency keys for user actions that can be double-tapped:

- submit guess
- reveal hint
- submit at-bat
- accept proposal
- send message

Game mutations should lock the relevant `games` / `at_bats` rows while resolving state.

## Practice endpoints

Practice Mode may start with a simple backend endpoint and evolve later.

- `start-practice-round`: choose a random canonical player from the seeded database and return safe practice payload.
- `submit-practice-guess`: optional server-authoritative guess check for practice.

Practice endpoints must reuse shared engine functions for initials, hint generation, and guess matching. Practice results must not mutate competitive records.
