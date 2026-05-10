# Game Engine Spec

## Principle

The engine is pure TypeScript. It contains no React, Supabase, storage, network, time, randomness, or platform APIs.

The engine answers deterministic rule questions:

- What initials should be shown?
- What hint text should be generated from player data/settings?
- What hit result corresponds to the number of revealed hints?
- How do runners advance?
- Does a run score?
- Does a half-inning/game end?

## Hit results

| Correct guess timing | Result |
|---|---|
| Initials only | Home Run |
| After hint slot 1 | Triple |
| After hint slot 2 | Double |
| After hint slot 3 | Single |
| After hint slot 4 | Sacrifice |

The hint type does not determine the result. The slot does.

## SAC rule

SAC is not a hit.

SAC always creates exactly 1 out.

- Batter is out.
- All existing baserunners advance exactly one base.
- Runner on 3rd scores.
- Batter does not reach base.

SAC is strictly worse than a single because it costs an out and the batter never reaches base.

## Strikes

Wrong guess = strike.

Default: 3 strikes per at-bat, configurable 1–5.

When strike count reaches `strikesPerAtBat`, batter is out.

## Extra innings

If tied after scheduled innings, play extras.

If `extrasGhostRunner = true`, each half-inning in extras starts with runner on second.

## Walk-off

In the bottom half of the final scheduled inning or extra inning, if home team takes the lead, the game ends immediately.

## Hints

Pitcher-selected player generates pre-populated hints from the player database. Pitcher may edit hint text before submission. The submitted/edited hint text is what the hitter sees.

The canonical answer remains the selected `player_id`.

## Guessing UX

Players do not submit free-text guesses.

Flow:

- User types into a search box.
- App returns matching players using substring search over normalized names and aliases.
- User selects a player from results.
- App submits canonical `player_id`.

Engine rule:

- Guess correctness is determined by exact `player_id` equality.
- No fuzzy matching.
- No string comparison at evaluation time.

## Share Boundary

- `createDailyShareResult` builds spoiler-safe share data from `DailyGameState`.
- `formatDailyShareText` converts `DailyShareResult` into copyable text.
- Share output must use final engine score totals.
- Share output must include initials and outcomes only.
- Share output must never include player names.

## Required tests

- Initials: Ken Griffey Jr., CC Sabathia, J.D. Martinez, Ichiro, Elly De La Cruz.
- Hit result by reveal count.
- Sacrifice with 0, 1, 2 outs.
- Base advancement for single/double/triple/HR.
- Ghost runner on/off.
- Walk-off.
- Settings validation.
- Stats hint building with configurable fields and bWAR label.

## Practice Mode engine reuse

Practice Mode must reuse the same engine functions as multiplayer:

- initials generation
- hint generation
- stats hint rendering
- guess matching
- hit-result mapping by reveal count

Do not create separate practice-only scoring logic.
