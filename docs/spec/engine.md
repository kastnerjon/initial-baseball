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

### `points-v2` — current Standard Daily

| Outcome | Points |
|---|---:|
| HR | 4 |
| 3B | 3 |
| 2B | 2 |
| 1B | 1 |
| BB | 0.5 |
| K | 0 |

Rules:

- all scheduled at-bats are played;
- a third strikeout does not complete the game;
- nine standard at-bats produce a maximum of 36 points;
- the resolved at-bat UI derives and displays the awarded points from this engine policy beside the baseball outcome;
- point completion, signed server progression, browser state, result formatting, and share output carry the same ruleset version;
- baseball inning state may stop advancing after three outs, but it does not control `points-v2` completion.

### `points-v1` — compatibility policy

The first points policy remains valid for compatible signed tokens and saved games:

- HR/3B/2B/1B/BB/K = `5/4/3/2/1/0`;
- nine at-bats produce a 45-point maximum;
- existing results are displayed and recalculated under `points-v1`, not silently converted to `points-v2`.

New Standard Daily bootstraps do not use this policy.

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

Each resolved at-bat preserves spoiler-safe stable facts independently from the numeric point total:

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
- `points-v2` mapping, fractional walks, 36-point maximum, and all-scheduled-at-bats completion;
- `points-v1` compatibility mapping and 45-point maximum;
- continuation after a third recorded out under both points policies;
- ruleset-version token serialization and legacy normalization;
- raw-fact preservation;
- local saved-state compatibility;
- resolved outcome plus awarded-point presentation;
- settings validation;
- spoiler-safe share output;
- representative initials and hint generation.

## Reuse

Practice or future modes reuse the same outcome, hint, search, and policy functions. Do not create separate UI-owned scoring logic.
