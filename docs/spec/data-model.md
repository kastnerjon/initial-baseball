# Data Model Spec

This app uses Supabase Postgres. Clients should not directly write authoritative game state. Edge Functions perform mutations using server-side validation.

## Core tables

| Table | Purpose |
|---|---|
| `profiles` | User profile, username, display name. |
| `feature_flags` | Toggle risky/social features. |
| `players` | Canonical player identity. |
| `player_aliases` | Accepted names/nicknames for guess matching. |
| `player_career_stats` | Normalized career stats used for Stats hint. |
| `game_settings_proposals` | Pregame proposal/counterproposal/acceptance. |
| `games` | Current authoritative game state. |
| `game_members` | Users in a game and home/away side. |
| `at_bats` | Submitted pitches/guesses/hints. |
| `game_events` | Append-only event log. |
| `inning_lines` | Box score line by half-inning. |
| `game_messages` | Game-only chat. |
| `blocks` | User blocks. |
| `user_reports` | User/game behavior reports. |
| `message_reports` | Message-level reports. |
| `moderation_actions` | Admin/moderation action audit trail. |
| `matchmaking_queue` | Random opponent queue. |
| `user_stats` | Cached overall records. |
| `head_to_head_stats` | Cached two-user records. |
| `leagues` | League Lite container. |
| `league_members` | League membership. |
| `league_games` | Which games count toward league standings. |
| `push_tokens` | Expo push tokens. |

## Player data

`players` stores canonical identity. A pitch must reference `players.id`.

`player_career_stats` stores nullable career stat fields:

- Hitter: `bwar`, `hr`, `rbi`, `ba`, `obp`, `slg`, `ops`, `sb`.
- Pitcher: `bwar`, `w`, `l`, `era`, `whip`, `k`, `sv`, `ip`.

If WAR is sourced from Baseball Reference, use field/label `bwar`.

## Game settings

Settings are stored as JSONB on proposals and copied to `games.settings` on acceptance.

Accepted settings are immutable after the game starts.

## Hints

`at_bats` stores:

| Field | Meaning |
|---|---|
| `auto_hints` | Hints generated from database/settings. |
| `submitted_hints` | Final pitcher-edited hints shown to hitter. |
| `player_id` | Correct canonical answer; hidden from hitter before resolution. |

## Game events

Every meaningful mutation writes a `game_events` row, including:

- `game_created`
- `settings_accepted`
- `at_bat_submitted`
- `hint_revealed`
- `guess_submitted`
- `at_bat_resolved`
- `half_inning_ended`
- `game_completed`
- `message_sent`
- `user_blocked`
- `message_reported`

`game_events` enables replay, debugging, stats backfills, and auditability.

## Social safety

Because random opponents and chat are alpha scope, these are required from day one:

- `blocks`
- `user_reports`
- `message_reports`
- `moderation_actions`
- feature flags for chat/random/leagues

## RLS posture

Default posture: enable RLS and avoid direct client writes for authoritative state.

Edge Functions should use service role for writes, after authenticating and validating the user.

Read policies should be added narrowly as screens are implemented.

## Practice Mode tables

Practice history is optional for alpha, but the schema should leave room for it. Practice data must stay separate from competitive records.

Suggested future tables:

| Table | Purpose |
|---|---|
| `practice_sessions` | User solo practice sessions. |
| `practice_rounds` | Individual random computer pitches within a session. |

Practice rounds may reference `players.id`, but should not update `user_stats`, `head_to_head_stats`, or league standings.


## Daily Inning tables

Daily Inning should use the same Supabase backend as the H2H app.

| Table | Purpose |
|---|---|
| `anonymous_players` | First-party anonymous browser/device identity. |
| `daily_puzzles` | One daily puzzle per date/number. |
| `daily_puzzle_pitches` | Ordered list of canonical player pitches for a daily puzzle. |
| `daily_attempts` | One anonymous or authenticated user's attempt. |
| `daily_pitch_results` | Per-pitch outcome, hints used, and strikeout data. |

Anonymous attempts may later be claimed into a real `profiles.id` account.
