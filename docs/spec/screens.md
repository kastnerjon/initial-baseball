# Screens Spec

## Alpha navigation

- Browse/landing
- Auth
- Username setup
- Home / game inbox
- Create game proposal
- Review/counter proposal
- Active game
- Pitcher submit at-bat
- Hitter turn
- Scoreboard / box score
- Game chat
- Random opponent queue
- Practice home
- Practice at-bat
- League list
- League home
- Create/join league
- Profile/records
- Report/block flows

## Create game settings

Must support:

- innings 1–9
- strikes per at-bat 1–5
- ghost runner ON/OFF
- hint order
- Custom Stats Picker

Stats Picker must require at least 1 hitter stat and 1 pitcher stat if Stats hint is included.

## Pitcher submit at-bat

Flow:

1. Search/select canonical player.
2. App generates initials.
3. App pre-populates hints from database.
4. Pitcher can edit hint text.
5. Submit.

The pitcher cannot change the canonical answer after submitting.

## Hitter turn

Show:

- initials
- current max hit result
- next reveal button
- revealed hints
- guess input
- strikes
- scoreboard/bases/outs

Do not show hidden answer data.

## Practice Mode

Practice section should show:

- start practice button
- optional practice settings
- active practice at-bat with initials, hints, guesses, and strikes
- next random player after round resolves

Practice must not show chat or opponent UI. Practice results must not affect competitive records.

## Random opponent

Show queue state, cancel option, and matched proposal review.

## Chat

Game-only text chat. No links/media in alpha. Include report/block affordances.

## League Lite

League home should show:

- league name
- invite code/link
- members
- standings
- start league game button
- league games list
