# Redefine points-v4 before activation

Status: implementation scope; redefine inactive points-v4 across all already-merged infrastructure before H browser/default activation  
Date: 2026-09-26

## Decision

Redefine `points-v4` as:

| Outcome | Points |
| --- | ---: |
| HR | 4 |
| 3B | 3 |
| 2B | 2 |
| 1B | 1 |
| BB | 0.5 |
| K / Give Up | 0 |

Wrong guesses one and two do not deduct points. A third wrong guess is terminal K and therefore scores 0. Give Up normalizes to K and scores 0. Daily Nine still plays all nine scheduled at-bats.

Nine at-bats span **0..36** in **0.5-point steps**.

This is a redefinition of the not-yet-public `points-v4` contract, not a new `points-v5`. Production currently contains zero persisted `points-v4` resolved-at-bat rows and zero persisted `points-v4` completed-result rows, and `CURRENT_DAILY_RULESET_VERSION` remains `points-v3`.

## Why a dedicated PR

The scoring change is not just an engine constant update. Earlier v4 infrastructure deliberately assumed signed integer values:

1. engine range/step and focused rules tests;
2. schema-1 result validation and service fixtures;
3. comparison normalization/histogram indexing;
4. Supabase result codecs and database constraints;
5. `daily_at_bat_results.awarded_points` physical type (`smallint`);
6. comparison RPC return types (`bigint` / `smallint`);
7. provider decoders that accept safe integers only;
8. canonical docs/plans describing negative/integer v4 semantics;
9. H1 server-write tests currently staged on a separate branch around -1/-9 behavior.

Changing all already-merged v4 semantics in one bounded compatibility PR keeps the exact-version contract coherent before any public v4 data exists. H1 remains a separate activation-layer PR and will be rebased/adjusted after this PR merges.

## Scope

### In scope

- redefine engine v4 mapping to 4/3/2/1/0.5/0;
- change v4 score range to 0..36 with step 0.5;
- preserve v3, v2, v1 and Classic behavior exactly;
- update v4 result-validator/service tests and fixtures;
- make portable comparison math support exact half-point v4 sums/buckets/histograms;
- update Supabase result codecs for v4 half-point values;
- widen `daily_at_bat_results.awarded_points` from integer storage to exact decimal storage while preserving v3 integer enforcement;
- update v4 completed-summary database constraint for 0.5 steps;
- update comparison RPC return types to exact numeric values;
- update Supabase comparison decoder for safe half-point values;
- update provider/domain tests;
- reconcile canonical docs and prior v4 plan records to the final pre-activation contract;
- record the implications for the separate H1 branch.

### Out of scope

- switching `CURRENT_DAILY_RULESET_VERSION`;
- browser journal/outbox/save identity;
- browser completed-result delivery;
- public comparison HTTP/browser acceptance;
- scorecard/share UI activation;
- archive route activation;
- How to play UI;
- historical v3/v2/v1 rescoring;
- unrelated Supabase advisor findings or schema cleanup.

## Compatibility and migration strategy

### No v5

A new version is unnecessary because v4 has not been activated publicly and production currently has zero v4 result rows. Therefore no user result or comparison population exists whose historical meaning would be changed.

### Do not rewrite applied migrations

Existing migration files remain immutable historical records. Add a new migration that supersedes the old v4 integer/signed assumptions in the live schema.

### Exact decimal storage

`daily_at_bat_results.awarded_points` must no longer be `smallint`. Use an exact Postgres numeric type, not floating point.

The new constraint must preserve:
- v3: integer 0..7 only;
- v4: 0..4 in 0.5 increments only.

Completed-result points remain JSON numeric values. Their constraint must preserve:
- v3: integer 0..63;
- v4: 0..36 in 0.5 increments;
- Classic bypasses the points-summary range check as before.

### Comparison RPCs

Because the at-bat sum and completed score buckets can now be fractional, the two comparison functions must return exact numeric point values instead of integer point types. Changing a Postgres function return type requires replacing the function definition deliberately while restoring the current security posture:

- `STABLE`;
- `SECURITY INVOKER`;
- `search_path = ''`;
- explicit v3/v4 ruleset gate;
- EXECUTE revoked from PUBLIC/anon/authenticated and granted to service_role only.

SQL continues to aggregate persisted engine-derived points; it must not copy the scoring formula.

### Portable comparison math

Keep counts as safe integers. Treat point values as exact values aligned to the engine-provided score step.

For v4:
- one-AB range: 0..4, step 0.5;
- nine-AB range: 0..36, step 0.5;
- histogram length: 73;
- score 0 -> index 0;
- score 0.5 -> index 1;
- score 36 -> index 72.

For v3, existing integer behavior and 64-entry 0..63 histogram remain unchanged.

## Acceptance checks

- engine returns HR/3B/2B/1B/BB/K = 4/3/2/1/0.5/0;
- wrong guesses 0-2 do not affect correct v4 outcome score;
- third wrong and Give Up score 0;
- nine Ks score 0; nine HRs score 36;
- v4 range reports 0..36, step 0.5;
- v3 range/scoring unchanged;
- schema-1 v4 result validation derives 0.5 walks and 0 Ks;
- comparison accepts half-point sums and buckets and rejects misaligned quarter-point values;
- v4 histogram has 73 entries and strict-lower semantics remain correct;
- Supabase codecs round-trip 0.5 and reject 0.25/out-of-range values;
- database constraints enforce v3 integer and v4 half-step domains;
- comparison RPCs return fractional exact values without exposing browser access;
- no durable verification rows remain;
- production still has zero v4 rows before H activation;
- current public/browser default remains points-v3.

## H1 interaction

H1 was rebuilt from post-redefinition `main` rather than merging the stale pre-redefinition branch. Its bounded server-write scope is documented in `tasks/plans/points-v4-result-write-api.md`.

H1 proves the finalized contract at the write boundary with a 0.5-point v4 walk and a 4.5-point nine-walk completed game, while leaving browser producers, comparison HTTP/browser acceptance and the public default on v3. The activation guardrails below remain later H work.

## H activation guardrails discovered in the high-level audit

This PR deliberately stops below browser activation. The next H work must preserve these currently intentional seams:

- `dailyAtBatAttemptJournal.ts` still owns a points-v3-only attempt identity/submission contract;
- `dailyAtBatGameplayLifecycle.ts` still retires non-v3 durable Daily attempt state;
- `useDailyGameplayPersistence.ts` still coordinates owner/outbox contribution only for points-v3;
- `dailyCompletedResultClient.ts` still accepts only points-v3 or Classic;
- shared comparison HTTP/request/browser layers remain points-v3-only;
- `CURRENT_DAILY_RULESET_VERSION` remains points-v3;
- most importantly, current non-archive `isDailyModeSaveCompatible` treats any non-Classic saved ruleset as compatible with any requested non-Classic ruleset. Before a v4 default cutover, H must make current-Daily save compatibility exact-version (or otherwise explicitly migrate/fence it) so an already-started v3 game is never silently restored as v4. Archive saves already use exact-version compatibility.

These are not defects to broaden into this PR. They are explicit cutover prerequisites.

## Verification

Required before merge:

- focused shared/engine/Daily/web tests for every changed scoring, result, comparison and provider seam;
- full repository CI and typecheck;
- exact-head Vercel Preview;
- hosted Supabase migration/readback;
- rollback-only fractional v4 proof through table constraints and both comparison RPCs;
- verify RLS, direct grants and function ACL/security posture unchanged;
- Supabase security/performance advisors, separating pre-existing findings from regressions;
- fresh-eye diff review for copied scoring logic, accidental browser/default activation, and migration-history edits.

## Documentation impact

Update all canonical/current v4 descriptions that still say `4/3/2/1/0/-1`, signed/negative, integer step, `-9..36`, or that a later BB 0.5/K 0 change would require a new version. Historical PR/migration facts may still describe what those earlier checkpoints implemented, but current architecture and roadmap language must make clear that the inactive v4 contract was redefined before activation.
