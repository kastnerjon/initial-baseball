# Game Engine Spec

Status: Current implemented rules and versioned policy boundary  
Last updated: 2026-07-31

## Principle

The engine is pure TypeScript. It contains no React, Next.js, Supabase, storage, network, time, randomness, or platform APIs.

It owns deterministic game questions:

- What outcome follows a correct answer at a given hint depth?
- What happens after an incorrect guess?
- How are points or baseball state calculated under a named ruleset?
- How do runners advance under baseball-inning rules?
- When is a game complete?
- What raw result facts and spoiler-safe share facts are produced?

## Stable Daily outcomes

| Correct timing | Outcome |
|---|---|
| Initials only | HR |
| After hint 1 | 3B |
| After hint 2 | 2B |
| After hint 3 | 1B |
| After hint 4 | BB |

The hint type does not determine the outcome. The revealed slot count does.

Three wrong guesses or Give Up produces `K`.

These outcomes are the stable vocabulary. Scoring and completion policies interpret them.

## Versioned Daily policies

### `points-v1` — current Standard Daily

| Outcome | Points |
|---|---:|
| HR | 5 |
| 3B | 4 |
| 2B | 3 |
| 1B | 2 |
| BB | 1 |
| K | 0 |

Rules:

- all scheduled at-bats are played;
- a third strikeout does not complete the game;
- nine standard at-bats produce a maximum of 45 points;
- point completion, signed server progression, browser state, result formatting, and share output carry the same ruleset version;
- baseball inning state may stop advancing after three outs, but it does not control `points-v1` completion.

### `legacy-inning-v1` — compatibility policy

The pre-points behavior remains explicit for compatible already-started sessions:

- HR, 3B, 2B, and 1B advance runners;
- BB applies force advancement;
- K adds an out and strikeout;
- runs, hits, outs, strikeouts, and bases are tracked;
- completion occurs at three outs or puzzle end.

New Standard Daily bootstraps do not use this policy. It exists so an old signed token or saved game is not silently reinterpreted after deployment, and so the runner engine remains available for a future approved alternate mode.

Do not create a broad plugin framework. Use explicit small versioned policies and stable shared contracts.

## Raw result facts

Each resolved at-bat now preserves spoiler-safe stable facts independently from the numeric point total:

- pitch/slot number;
- initials;
- HR/3B/2B/1B/BB/K outcome;
- revealed hint count;
- wrong-guess count;
- correct, strikeout, or Give Up resolution.

The game state also carries puzzle identity and ruleset version. A final numeric score alone is insufficient for future result persistence or recalculation.

Legacy saved lines that predate this contract are normalized conservatively for local display only. Future aggregate submission must use natively recorded raw facts.

## Hints

Hint text is generated from canonical player data/settings. The engine may build and validate hint values, but network authorization and delivery belong to web adapters.

The product invariant is that current-at-bat Hint presses are immediate. The engine does not depend on whether hints arrive individually or as an authorized bundle.

## Guessing

Players select canonical search results. Correctness is exact canonical `playerId` equality after approved redirects. No fuzzy string comparison occurs at evaluation time.

## Share boundary

- Share output contains puzzle/result metadata, initials, spoiler-safe outcomes, and the ruleset-derived point total.
- It never contains player names or hidden answer IDs.
- Legacy results retain their legacy baseball summary rather than being mislabeled as a points result.
- Different ruleset versions must not be compared as the same score distribution.

## Required tests

- outcome by hint count;
- three-strike and Give Up behavior;
- walk force advancement;
- single/double/triple/HR advancement;
- legacy three-out completion;
- `points-v1` mapping and all-scheduled-at-bats completion;
- continuation after a third recorded out under `points-v1`;
- ruleset-version token serialization and legacy normalization;
- raw-fact preservation;
- local saved-state compatibility;
- settings validation;
- spoiler-safe share output;
- representative initials and hint generation.

## Reuse

Practice or future modes reuse the same outcome, hint, search, and policy functions. Do not create separate UI-owned scoring logic.
