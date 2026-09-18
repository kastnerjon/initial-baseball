# Stabilize baseball-data test/build ordering

Status: Active scope contract  
Date: 2026-09-17

## Goal

Eliminate a reproducible CI race where `@initial-baseball/baseball-data` can build twice concurrently during `turbo test`, causing concurrent TypeScript emission into `dist/generated/players.json` and occasionally exposing a partially written JSON file to dependent Daily tests.

## Root cause

- Root `pnpm test` runs `turbo test`.
- Turbo's `test` task already depends on upstream package builds via `^build`.
- `@initial-baseball/baseball-data` additionally defines `pretest: pnpm --filter @initial-baseball/shared build && pnpm build`.
- During the workspace test graph, another package can require `@initial-baseball/baseball-data#build` while the baseball-data package's npm `pretest` independently launches the same build.
- Both builds emit the same `dist/**` outputs. Observed failures included a malformed `dist/generated/players.json` and earlier exhaustive-player test timing instability.

## Owning layer

Build/test orchestration only.

## In scope

- remove the redundant baseball-data `pretest` self-build;
- leave the package's actual `test`, `build`, generated-data sources, and assertions unchanged;
- record the durable lesson that Turbo-owned build prerequisites must not be duplicated through npm lifecycle hooks when they write the same outputs;
- verify full CI repeatedly reaches the canonical-data and production-build stages without malformed generated JSON.

## Out of scope

- baseball facts, generation logic, runtime payload contents, eligibility, or schemas;
- changing the exhaustive player assertions or increasing their timeout;
- completed-result/browser feature code;
- global Turbo concurrency changes;
- changing generated artifacts by hand.

## Acceptance

- `packages/baseball-data/src/baseballPlayers.test.ts` is unchanged from `main`;
- `@initial-baseball/baseball-data` no longer launches its own build from `pretest`;
- root `pnpm test` relies on Turbo's dependency graph instead of duplicate package-level build invocation;
- full CI passes without malformed `dist/generated/players.json`;
- documentation-impact gate passes;
- no product/runtime behavior changes.
