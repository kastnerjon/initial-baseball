# Stabilize full-player required-field test

Status: Active scope contract
Date: 2026-09-17

## Goal

Remove CI flakiness from the exhaustive generated-player required-field assertion without changing baseball data, generation, runtime behavior, or eligibility rules.

## Owning layer

Baseball-data test harness only.

## Evidence

The unchanged `includes required fields for every player` test timed out twice at Vitest's 5-second default while validating the full generated player universe during PR #168. Neighboring baseball-data tests passed. The test is intentionally exhaustive and can legitimately exceed 5 seconds under shared CI load.

## In scope

- give only this exhaustive test an explicit 15-second timeout;
- run normal CI and preview/documentation gates as applicable.

## Out of scope

- player data changes;
- generator/performance work;
- changing assertions;
- browser completed-result work;
- global Vitest timeout changes.

## Acceptance

- test semantics remain identical;
- only the test file plus this scope contract change;
- full CI passes.
