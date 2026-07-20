# QA Spec

## Daily alpha readiness gates

Before wider friend alpha:

- Engine tests pass.
- Canonical runtime generation and consumer QA pass.
- Daily Inning can be completed end to end by correct guesses, strikes, and Give Up.
- Search distinguishes genuine same-name players with career, role, position, and team context.
- Refresh restores the active Daily game without restoring private answer data.
- Share text contains no player names.
- Common iPhone and iPad layouts are usable.

## Manual Daily scenarios

- Correct guess with zero through four revealed hints.
- Incorrect guess followed by a correct guess.
- Third-strike and Give Up reveal paths.
- Nine scheduled at-bats and an inning ending on three outs.
- Reset and refresh recovery.
- Hitter, pitcher, two-way, multi-team, incomplete historical, and same-name reveal cases.

## Answer-integrity tests

- Initial HTML and serialized props contain no answer ID, display name, hint value, or reveal record.
- Client chunks contain no generated legacy player universe or Daily answer records.
- Incorrect resolution responses contain no reveal.
- Correct, third-strike, and Give Up responses contain only the resolved player's canonical reveal.
- Public search results expose candidate identity context but not Daily answer relationships.
- Browser and server logs contain no hidden answer data.

## Regression rule

Every bug fix should add a test when the bug is in engine, validators, database logic, or Edge Function behavior.
