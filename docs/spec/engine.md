# Game Engine Spec

Status: Current implemented rules plus approved policy boundary  
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

## Current implemented Daily policy

Production `main` currently applies outcomes to baseball inning state:

- HR, 3B, 2B, and 1B advance runners;
- BB applies force advancement;
- K adds an out and strikeout;
- runs, hits, outs, strikeouts, and bases are tracked;
- completion may occur at three outs or puzzle end.

This describes current implementation.

## Approved versioned-policy direction

The next gameplay architecture separates:

1. raw at-bat facts;
2. scoring policy;
3. completion policy.

Provisional `points-v1`:

| Outcome | Points |
|---|---:|
| HR | 5 |
| 3B | 4 |
| 2B | 3 |
| 1B | 2 |
| BB | 1 |
| K | 0 |

`points-v1` completes after all nine at-bats.

A future `baseball-inning-v1` may reuse the existing base/runner functions and three-out completion. Do not delete the baseball engine merely because Standard Daily adopts points.

Do not create a broad plugin framework. Use explicit small versioned policies and stable shared contracts.

## Raw result facts

A completed at-bat/result contract should preserve enough information to reinterpret scoring later:

- puzzle identity and ruleset version;
- slot;
- outcome;
- revealed hint count;
- wrong-guess count;
- correct, strikeout, or Give Up resolution.

A final numeric score alone is insufficient.

## Hints

Hint text is generated from canonical player data/settings. The engine may build and validate hint values, but network authorization and delivery belong to web adapters.

The product invariant is that current-at-bat Hint presses are immediate. The engine must not depend on whether hints arrived individually or as an authorized bundle.

## Guessing

Players select canonical search results. Correctness is exact canonical `playerId` equality after approved redirects. No fuzzy string comparison occurs at evaluation time.

## Share boundary

- Share output contains puzzle/result metadata, initials, and spoiler-safe outcomes.
- It never contains player names or hidden answer IDs.
- Share/result totals come from the selected ruleset.
- Different ruleset versions must not be compared as the same score distribution.

## Required tests

- outcome by hint count;
- three-strike and Give Up behavior;
- walk force advancement;
- single/double/triple/HR advancement;
- current baseball completion;
- provisional points mapping and all-nine completion when implemented;
- ruleset-version serialization;
- raw-fact preservation;
- settings validation;
- spoiler-safe share output;
- representative initials and hint generation.

## Reuse

Practice or future modes reuse the same outcome, hint, search, and policy functions. Do not create separate UI-owned scoring logic.
