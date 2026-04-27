# Daily Inning Spec

## Purpose

Daily Inning is the web-first daily puzzle and top-of-funnel product for Initial Baseball.

The user plays one inning against a computer-selected sequence of canonical players. The user sees initials, may reveal hints, guesses the player, and scores baseball outcomes based on how many hints were used.

## Product relationship

- **Daily Inning**: no-login daily web puzzle, fast sharing, aggregate crowd comparison.
- **Initial Baseball H2H**: later mobile app for friend games, random opponents, chat, records, and leagues.
- Both use the same player database, same engine, same hint logic, same guess matching, same eventual account.

## Identity model

Daily Inning starts anonymous.

- Browser creates/stores an `anonymous_player_id` in first-party local storage/cookie.
- Daily attempts are stored against this anonymous ID.
- If the user later creates/logs into an Initial Baseball account, prior anonymous attempts can be claimed into the user profile.
- H2H games require real auth; Daily Inning does not.

## Daily puzzle

Each published daily puzzle has:

- Puzzle number.
- Calendar date.
- Fixed ordered pitch list.
- Fixed daily hint ladder.
- Published status.

Recommended MVP behavior:

- The puzzle contains more possible pitches than most users need.
- User keeps batting until three outs.
- Player names are hidden during play.
- Player names may be shown on the results page after completion.

## Default daily hint ladder

Daily Inning should use fixed rules for comparability:

| Guess point | Outcome |
|---|---|
| Initials only | HR |
| After Main decade played in | 3B |
| After Teams | 2B |
| After Position | 1B |
| After Stats | Bunt |
| Three wrong guesses | K/out |

Do not support custom settings in Daily Inning v0.

## Guessing UX

Players do not submit free-text guesses.

Flow:

- User types into a search box.
- App returns matching players using substring search over normalized names and aliases.
- User selects a player from results.
- App submits canonical `player_id`.

Game rule:

- Guess correctness is determined by exact `player_id` equality.
- No fuzzy matching.
- No string comparison at evaluation time.

## BUNT rule

BUNT is not a hit and never scores a run.

BUNT always creates exactly 1 out.

Case A — No runner on 3rd:

- Batter is out.
- All existing runners advance one base.
- No run scores.

Case B — Runner on 3rd:

- Runner on 3rd is out.
- Batter reaches 1st.
- Other runners advance one base.
- No run scores.

Notes:

- BUNT is strictly worse than a single.
- BUNT can change base state but cannot produce runs.

## Share result

Copied share text must be spoiler-safe.

Architecture boundary:

- `createDailyShareResult` builds spoiler-safe share data from final `DailyGameState`.
- `formatDailyShareText` converts `DailyShareResult` into copyable text.
- Share output must use final engine score totals.

It should show:

- Daily puzzle number.
- Runs/hits/outs.
- Each pitch's initials.
- User's outcome for each pitch.
- Link.

It must not show player names.
It must show initials and outcomes only for pitch-level results.

Example:

```text
Daily Inning #42
by Initial Baseball

4 R / 5 H / 3 OUT

KGJ: HR
PM: 2B
DW: K
EDLC: 1B
CS: 3B

https://dailyinning.com
```

## Results page

After completion, show:

- User's final line.
- Initials and outcome for each pitch.
- How the field did for each pitch.
- Player names may be revealed only after completion.

Example field comparison:

| Initials | You | Field |
|---|---|---|
| KGJ | HR | 22% HR, 8% K, avg 2.6 bases |
| PM | 2B | 14% HR, 31% 2B+, 12% K |

## Aggregate stats

For each puzzle pitch, compute:

- HR percentage.
- 3B percentage.
- 2B percentage.
- 1B percentage.
- Bunt percentage.
- Strikeout percentage.
- Average bases.
- Number of attempts.

Aggregates should be based on completed or meaningfully-started attempts according to a defined anti-spam rule. Avoid showing aggregates until a minimum sample threshold is met.

## Monetization

Daily Inning should remain free at launch.

Future monetization:

- Web ads after meaningful traffic.
- Sponsorships.
- Newsletter sponsorship.
- Optional account/streak/history.
- App conversion into H2H Initial Baseball.

## MVP exclusions

- No payments.
- No login requirement.
- No H2H inside Daily web MVP.
- No daily custom settings.
- No public comments/chat.
- No player-name spoilers in share text.
