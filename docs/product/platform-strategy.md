# Platform Strategy

## Strategy

Build **Daily Inning by Initial Baseball** as the first playable web product. Keep the Initial Baseball H2H mobile app in the same monorepo and architecture, but build it after the daily game has signal.

## Product surfaces

| Surface | Platform | Purpose | Priority |
|---|---|---|---:|
| Daily Inning | Web | Daily puzzle, sharing, acquisition | 1 |
| Practice | Web/app | Training/reps | 2 |
| Initial Baseball H2H | iOS/Android | Multiplayer, records, chat, leagues | Later |

## Shared platform

Both Daily Inning and H2H use:

- Same Supabase project per environment.
- Same auth/profile system.
- Same anonymous-to-account claim path.
- Same player database.
- Same shared TypeScript engine.
- Same guess matching and hint generation.

## Why web first

Daily Inning has lower friction:

- No App Store approval.
- No install.
- No required login.
- No opponent needed.
- Easier sharing.
- Faster validation.

The app becomes the deeper retention product if Daily Inning proves fun.
