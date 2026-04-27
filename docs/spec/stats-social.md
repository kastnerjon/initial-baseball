# Stats, Social, Random Opponents, Chat, and League Lite

## Profiles

Users must create/login before playing. Profiles include username, display name, avatar placeholder, record, and preferences.

## Records

Track:

- Overall record.
- Friend/head-to-head record.
- Random opponent record.
- League record.
- Basic offensive/pitching game outcomes if useful later.

`game_events` is the source needed to rebuild records if cached stats become wrong.

## Random opponents

Random opponent matchmaking is alpha scope.

Rules:

- Users can enter matchmaking queue.
- Blocks must be respected.
- Matched users negotiate settings before game starts.
- Matchmaking can be disabled by feature flag.
- No anonymous/public-chat framing; it is a random baseball opponent.

## Game-only chat

Chat is alpha scope, but constrained.

Rules:

- Text-only.
- Game-scoped only.
- No public rooms.
- No league-wide chat in alpha.
- No images/media/attachments.
- No links initially.
- Report message.
- Report user.
- Block user.
- Basic profanity/slur filtering for usernames and messages.
- Chat can be disabled by feature flag.

## League Lite

Alpha includes League Lite:

- Private league creation.
- Invite code/link.
- League member list.
- Start games within a league.
- League standings.

Alpha excludes:

- Playoffs.
- Scheduled seasons.
- Commissioner dispute tools.
- Paid leagues.
- League-wide chat.
- Public league discovery.

## League standings

Minimum standings columns:

| Field | Meaning |
|---|---|
| W | League wins |
| L | League losses |
| RS | Runs scored |
| RA | Runs allowed |
| Diff | Run differential |

Standings can be computed from completed `league_games` and cached later.

## Safety tables

Required from day one:

- `blocks`
- `user_reports`
- `message_reports`
- `moderation_actions`

Reports should retain enough context to review abuse without exposing private data broadly.
