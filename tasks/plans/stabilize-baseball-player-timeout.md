# Stabilize exhaustive baseball-player test timeout

Status: Active scope contract  
Date: 2026-09-17

## Goal

Remove a repeated CI-only timeout from the existing exhaustive player-field validation without changing baseball facts, generated data, runtime behavior, or assertion coverage.

## Owning layer

Baseball-data test only.

## In scope

- raise the per-test timeout only for the existing exhaustive `includes required fields for every player` assertion;
- preserve every assertion and the generated player universe unchanged;
- verify the previously timing-out test and full CI pass.

## Out of scope

- baseball-data generation, eligibility, facts, runtime code, or schemas;
- result collection/browser work;
- global Vitest timeout changes;
- performance rewrites unrelated to this bounded CI stability issue.

## Acceptance

The same exhaustive assertion body passes with a realistic explicit timeout; no product/runtime source file changes.

## Documentation impact

No canonical product or architecture behavior changes. This bounded scope contract is the only documentation change required for the test-only timeout stabilization.

The canonical product/architecture docs remain accurate because the exhaustive assertions and runtime behavior are unchanged; only the test's execution budget changes.
