# AB BEAT and one-other-result comparisons

## Decision and release sequence

The owner requests BEAT after each AB and on the final score with one other result. Green means personal points strictly exceed the average; red means they do not. Ties are not beaten. Counts describe other submitted results, not unique people. Read-only exclusion uses the durable first attempt/submission ID, including after Reset. No result creation/delivery policy changes.

Separate concerns ship from latest main: portable distribution contract, service-only filtered provider reads, browser exclusion transport, then presentation. Archive browser activation remains separate.

## PR 1 scope contract

- Goal: portable AB strict-lower percentages from exact-version score buckets.
- Owning layer: packages/daily comparison normalization; shared records transport shape only.
- In scope: optional AB histogram for additive rollout, exact one-slot ranges, strict-lower calculation shared with completed comparisons, optional excluded-result read identity, focused domain tests and product decision record.
- Out of scope: database, HTTP, browser storage, UI, archive activation, scoring and result writes.
- Acceptance: half points, ties, empty population, malformed histograms and mismatched sums/counts; package tests/typecheck/lint and repository size checks.
- Stop conditions: persistence or platform logic enters Daily; introduce separate provider/browser PRs instead.

## Status

Implementation in progress. Production presentation is unchanged until the final stage.
