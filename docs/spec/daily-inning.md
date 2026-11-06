# Daily Inning Spec

## Purpose

Daily Inning is the web-first daily puzzle and top-of-funnel product for Initial Baseball.

The user plays one inning against an ordered lineup of canonical players. The user sees initials, may reveal hints, guesses the player, and scores baseball outcomes based on how many hints were used.

## Product relationship

- **Daily Inning**: no-login daily web puzzle, fast sharing, aggregate crowd comparison.
- **Initial Baseball H2H**: later mobile app for friend games, random opponents, chat, records, and leagues.
- Both use the same player database, same engine, same hint logic, same guess matching, same eventual account.

## Official edition preparation

The private preparation step consumes a server-allocated occurrence UUID and a scheduled or published nine-slot editorial selection. It orders slots, validates the publication date, assigns a default Puzzle N title when omitted, and freezes the dated clue snapshot under points-v4. Equal ordered rosters may produce distinct puzzle IDs. The prepared payload contains answers and stays on the server. Database issuance, admin authorization and public play are separate delivery steps.

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
| After Stats | SAC |
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

## SAC rule

SAC is not a hit.

SAC always creates exactly 1 out.

- Batter is out.
- All existing baserunners advance exactly one base.
- Runner on 3rd scores.
- Batter does not reach base.

SAC is strictly worse than a single because it costs an out and the batter never reaches base.

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

KG: HR
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
| KG | HR | 22% HR, 8% K, avg 2.6 bases |
| PM | 2B | 14% HR, 31% 2B+, 12% K |

## Aggregate stats

For each puzzle pitch, compute:

- HR percentage.
- 3B percentage.
- 2B percentage.
- 1B percentage.
- SAC percentage.
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

## Private frozen edition materialization (staged, not a public route)

A newly issued official secondary edition is stored by an immutable occurrence
ID with nine frozen canonical player IDs, exact initials, date-specific hint
labels/order and all four frozen clue values per pitch. The server-only
materialization adapter reuses the *same* frozen-clue composition as legacy
permanent/archive Daily puzzles, producing a standard DailyPuzzle for the
existing shared engine. Current canonical baseball records supply the player
identity, but stored initials and hint values always override current
regenerated values. No second scoring or gameplay engine is introduced.

This capability is not a public admission decision. Until a separately reviewed
exact-ID runtime and single-hint transport are deployed, no endpoint may return
its private DailyPuzzle or unrevealed answers. Validate signed progression
against exact puzzle ID and date; keep future editions undiscoverable; isolate
score and browser-state cohorts by immutable edition ID. The legacy primary
materialization path retains identical behavior.

## Secondary official Daily browser-save identity (staged, source only)

An independently issued official edition uses a dedicated browser gameplay-save
namespace keyed by its immutable daily-ed-v1 occurrence ID, scoring ruleset
and game date. Two same-date editions may have identical batting orders and
still retain independent saves, resets and resume state. The new namespace
never adopts the old date-only/pre-scoped Daily save, even when that old value
is corrupted or has an unknown puzzle identity. Resetting an edition never
deletes an older Daily Nine or other edition's save.

Previously shipped primary points-v4 migration fallback, Classic keys,
permanent/archive keys, and the existing identity-keyed at-bat journals and
completed-result outbox are unchanged. Official editions also require an
exact scoring-ruleset match when loading a saved game; historical points-v3
cross-version compatibility applies only to historic current Daily saves.

This is a browser-side storage boundary, not public gameplay or scoring
admission. Server-side result isolation, signed exact-ID progression, lost
response handling, multi-tab play and mobile QA remain release gates.
