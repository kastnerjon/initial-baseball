# Completed-result repository/service boundary

Status: Implementation scope for completed-result step 4B  
Date: 2026-09-17

## Goal

Add one provider-neutral, atomic, idempotent persistence boundary for already validated/derived completed-game results so a future server adapter can safely retry one completed-game write without duplicating or overwriting data.

Observable outcome: storing a `DailyCompletedResult` with a new `submissionId` creates one record; retrying the same normalized result with the same ID returns the existing record; reusing that ID with any different normalized result returns an idempotency conflict.

## Owning layer

Primary owner: `packages/daily`.

`shared` already owns the stable schema-1 submission/result contract. `engine` already owns validation and summary derivation. This step is orchestration/persistence-port behavior, so it belongs in the existing portable Daily layer. A later web/Supabase adapter will implement the port.

Allowed dependencies: `packages/daily` may consume the shared `DailyCompletedResult` type. This step does not require engine, React, Next.js, Supabase, browser APIs, clocks, or network dependencies.

## In scope

- Define `DailyCompletedResultRepository` in the Daily package.
- Give the repository one atomic first-write-wins operation, `insertIfAbsent(result)`.
- Require implementations to use `submissionId` as the atomic unique/idempotency key, never overwrite an existing record, and return either the inserted result or the already-stored result.
- Define `createDailyCompletedResultService(repository)` over that port.
- Return `created` for a new ID.
- Return `existing` for the same ID plus exactly the same normalized `DailyCompletedResult` payload.
- Return `idempotency_conflict` for the same ID plus any different normalized payload, including raw at-bat facts, puzzle identity, ruleset/game, or derived summary.
- Preserve the complete normalized result, including ordered raw completed-at-bat facts; do not reduce storage input to a presentation summary.
- Compare normalized results deterministically by their explicit contract fields rather than object identity or JSON property ordering.
- Add focused tests for insert, retry, conflict, game/ruleset isolation, raw-fact preservation, and repository-contract corruption.
- Export the new portable API from `@initial-baseball/daily`.
- Reconcile canonical architecture/data-model/handoff/todo documentation so 4C becomes the next bounded concern.

## Out of scope

- Supabase schema/migration, SQL, RLS, grants, codecs, or provider adapter.
- Any completed-result HTTP route.
- Browser generation/persistence of `submissionId` or submission retries.
- Re-running 4A validation or scoring inside the service.
- Per-hint/per-guess writes or durable anonymous sessions.
- Aggregate queries, averages, distributions, percentile rules, or comparison UI.
- Permanent archive identity/history.
- Accounts or cross-device identity.
- Changes to gameplay, scoring, completion, Daily Nine/Classic availability, or the beta launch model.

## Atomicity contract

The service must not implement idempotency as `getBySubmissionId` followed by `save`; that sequence can race across concurrent requests.

The provider contract is instead one atomic `insertIfAbsent(result)` operation:

1. If `submissionId` is absent, persist the complete normalized result and return `{ status: 'inserted', result }`.
2. If `submissionId` already exists, do not mutate the stored row and return `{ status: 'existing', result: existing }`.
3. The service compares the existing normalized record with the incoming normalized record.
4. Exact equality is an idempotent retry; any difference is a conflict.

A future Postgres adapter may satisfy this with a unique constraint plus a single atomic insert/conflict path, but provider-specific SQL is deliberately deferred to 4C.

## Architecture checks

1. **Which layer owns this?** Daily owns provider-neutral result orchestration/repository boundaries.
2. **Does an implementation already exist?** No completed-result repository/service exists. The editorial `DailyPuzzleRepository` is a useful pattern but has different revision semantics and is not reused as a generic repository.
3. **What may it depend on?** Shared completed-result types only.
4. **What must not depend on it?** Engine/shared remain below it and must not import Daily persistence concerns.
5. **Portable or platform-specific?** Portable; no provider/runtime APIs.
6. **Does it alter a contract?** It adds the approved 4B repository/service contract but does not alter schema-1 result transport or gameplay rules.
7. **Canonical docs?** `docs/spec/data-model.md`, `docs/architecture-and-scale-plan.md`, `docs/START-HERE.md`, and `tasks/todo.md`.

## Acceptance checks

Focused:

- `corepack pnpm --filter @initial-baseball/daily test`
- `corepack pnpm --filter @initial-baseball/daily typecheck`

Repository completion checks:

- `corepack pnpm test`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm check:file-sizes`
- `corepack pnpm build:web`
- documentation-impact CI
- one bounded review pass after intended implementation is complete

## Stop conditions

Stop and split follow-up work if implementation requires any of the following:

- a Supabase/database migration or provider-specific SQL;
- a new external dependency;
- a new API route or browser persistence behavior;
- changing client/server authority or the anonymous threat model;
- changing schema-1 result fields or engine validation/scoring;
- adding comparison/aggregate semantics;
- crossing the repository decomposition thresholds in `AGENTS.md`.
