# Completed-result provider/API/browser integration

Status: Implementation scope for completed-result step 4C  
Date: 2026-09-17

## Goal

Connect the already-settled completed-result contract to one real provider path: validate a completed anonymous game against the authoritative Daily puzzle, persist the normalized result atomically in Supabase, and let the browser retry the same completion without creating duplicates.

Observable outcome: a newly completed native `points-v3` Daily Nine or `classic-inning-v1` Classic game receives one stable browser-generated submission ID, posts one compact schema-1 submission, and is stored once. A network retry reuses the same ID. An idempotency conflict never overwrites the first stored result.

## Owning layers

- `packages/shared`: unchanged schema-1 transport/result types.
- `packages/engine`: unchanged validation and summary derivation.
- `packages/daily`: unchanged provider-neutral first-write-wins repository/service boundary from 4B.
- `apps/web`: owns Supabase adapter/codec, server composition, HTTP transport, and browser submission adapter.
- `supabase/migrations`: owns the additive provider schema and access boundary.

This step must not move scoring, result equality, puzzle validation, or aggregate policy into React, Next routes, or Supabase.

## In scope

- Add `public.daily_completed_results` as a new additive table.
- Use `submission_id` as the primary/unique first-write-wins key.
- Persist `schema_version`, stable puzzle identity, puzzle number/date, exact supported ruleset, ordered normalized completed-at-bat facts, engine-derived summary, and server receipt `created_at`.
- Add a population index for future queries by puzzle date / ruleset / puzzle identity.
- Enable RLS; revoke `public`, `anon`, and `authenticated`; grant only the server service role the minimum table privileges needed by this adapter.
- Add an explicit Supabase row codec; malformed provider rows fail closed.
- Implement `DailyCompletedResultRepository.insertIfAbsent` with insert-first semantics. A unique violation reads the existing row; no update/upsert path exists.
- Add a small server submission service that extracts only routing fields, loads the authoritative public puzzle, delegates validation to engine `validateDailyCompletedResult`, then delegates persistence/idempotency to the 4B Daily service.
- Add `POST /api/daily/results` with private/no-store responses and sanitized status mapping.
- Add browser-only submission marker storage separate from the gameplay-save schema.
- Generate one browser UUID-style `submissionId` before the first request and persist it before network I/O.
- Reuse the same ID after transient/network/server failure; mark success, conflict, or non-retryable client rejection terminally.
- Wire only native current `points-v3` and `classic-inning-v1` completed games. Do not submit legacy/points-v1/points-v2 compatibility saves.
- Clear the submission marker when the user explicitly resets that local game.
- Add focused tests for provider encoding/decoding and unique conflict behavior, server validation/store composition, route status/privacy behavior, browser stable-ID/retry behavior, Classic early completion, and unsupported compatibility saves.
- Reconcile canonical API/data-model/architecture/handoff/task documentation.

## Out of scope

- Aggregate queries, averages, distributions, percentiles, or comparison UI.
- Any read endpoint for community results.
- Permanent archive/history or historical Daily numbering changes.
- Accounts, cross-device identity, authoritative streaks, leaderboards, or abuse prevention.
- Per-hint/per-guess server persistence or durable anonymous sessions.
- Reuse or migration of inactive legacy attempt/result tables.
- Any new scoring/completion policy or changes to 4A/4B result semantics.
- Submission of reconstructed legacy local facts without a separately approved migration rule.

## Provider contract

`daily_completed_results` is persistence, not game authority. The browser sends only schema-1 native facts. The server must resolve the requested puzzle date/ruleset through the existing authoritative Daily source, run engine validation, and persist only the returned normalized `DailyCompletedResult`.

The Supabase adapter uses this flow:

1. Attempt `INSERT` with the complete normalized result.
2. If insert succeeds, return `{ status: 'inserted', result }`.
3. If PostgreSQL returns unique violation `23505`, read the row for that exact `submission_id` and return `{ status: 'existing', result }`.
4. Any other provider failure is an adapter query error.
5. Never use `upsert`, `update`, or delete in this repository.

The unique constraint makes concurrent first writes race-safe. The follow-up read occurs only after PostgreSQL reports the unique conflict; it does not implement a race-prone preflight read.

## Browser retry contract

Submission state is separate from `dailyLocalStorage` gameplay state. The marker is scoped by puzzle identity and ruleset and contains only the stable submission ID plus transport state.

- Marker is persisted as `pending` before the first POST.
- `created` or `existing` becomes `submitted`.
- HTTP 409 becomes terminal `conflict`.
- Other 4xx validation rejection becomes terminal `rejected`.
- Network errors and 5xx responses remain `pending`, so a later completed-game mount/refresh retries the same ID.
- React may issue concurrent retries in development; server first-write-wins semantics make them safe.
- Reset removes both the gameplay save and this marker.

Gameplay remains usable if local submission-marker storage or remote result persistence is unavailable.

## HTTP contract

`POST /api/daily/results`

- success, first insert: `201 { "status": "created" }`
- success, idempotent retry: `200 { "status": "existing" }`
- invalid/unsupported/mismatched/incomplete result: `400 { "error": "<safe-code>" }`
- same ID with different normalized result: `409 { "error": "idempotency_conflict" }`
- unexpected provider/configuration failure: `500 { "error": "completed_result_unavailable" }`

All responses are `Cache-Control: private, no-store`. No answer IDs, credentials, provider error text, or full stored result are returned.

## Architecture checks

1. **Which layer owns persistence orchestration?** `packages/daily`; 4C implements its provider port in `apps/web`.
2. **Which layer owns validation/scoring?** Engine only.
3. **Which layer owns HTTP and browser storage?** Web adapters only.
4. **Does an implementation already exist?** Editorial Supabase patterns exist, but completed results have distinct first-write-wins semantics and receive a dedicated adapter.
5. **New dependency?** No.
6. **Provider-specific behavior leak upward?** No; PostgreSQL code `23505`, row names, RLS, and service-role behavior remain inside the Supabase adapter/migration.
7. **Client/server authority change?** Yes, bounded and intentional: completed results become server-stored only after engine validation. Anonymous play remains consistency-checked, not cheat-proof.
8. **Permanent archive?** No. Beta result persistence is not the permanent launch archive.

## Acceptance checks

Focused during implementation:

- `corepack pnpm --filter @initial-baseball/web test`
- `corepack pnpm --filter @initial-baseball/web typecheck`
- existing Daily/engine tests remain unchanged and green

Repository completion:

- `corepack pnpm test`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm check:file-sizes`
- full canonical baseball-data CI chain
- production package build order / web build
- documentation-impact CI
- exact migration applied to connected `initial-baseball-db`
- Supabase security/performance advisors reviewed after migration
- one bounded architecture/code review pass
- exact-SHA Vercel preview before merge and production verification after merge

## Stop conditions

Stop and split follow-up work if 4C requires:

- a second provider or external dependency;
- aggregate/comparison read semantics;
- account or cross-device identity;
- per-action event storage;
- a change to schema-1 transport fields, engine scoring, or 4B equality semantics;
- reuse of inactive legacy result tables;
- a provider function/RPC solely to work around an adapter design that can be expressed safely with the unique insert boundary;
- repository decomposition thresholds in `AGENTS.md` to be exceeded.
