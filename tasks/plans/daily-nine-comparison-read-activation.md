# Daily Nine comparison read activation

Status: implemented and production-verified on PR #204  
Date: 2026-09-19

## Scope contract

- **Goal:** activate the already-implemented Daily Nine comparison GET routes after representative performance evidence, while preserving an explicit emergency shutoff and keeping comparison fully outside gameplay's critical path.
- **Owning layer:** `apps/web` route availability/configuration.
- **In scope:** replace the pre-activation opt-in gate with a post-activation default-on/fail-closed disable switch; update focused gate/route tests; update environment examples and canonical docs; verify enabled Preview behavior before merge; verify exact-merge Production behavior after merge.
- **Out of scope:** browser fetching; React/UI; comparison retry policy; caching; Supabase schema/functions/indexes; result-write behavior; scoring; Classic comparison; rollups; R5/R6/R8.
- **Acceptance checks:** absent disable flag enables reads; exact `false` enables reads; exact `true` disables reads before server composition; blank/malformed disable values fail closed; success/error responses remain `private, no-store`; public route identity remains authoritative/server-derived; Preview returns valid versioned responses before merge; Production returns valid versioned responses after merge; runtime errors remain clean.
- **Stop conditions:** any browser/UI change, data-model change, cache/rollup work, result-write change, scoring change, or new infrastructure moves to a separate PR.

## Activation model

The old flag `DAILY_NINE_COMPARISON_READS_ENABLED` was intentionally default-off while performance was unproven.

PR #203 established representative disposable PostgreSQL 17 evidence at the 10,000-result checkpoint:

- resolved AB p95: 1.807 ms;
- completed comparison p95: 6.254 ms.

PR #204 therefore moved the activation gate from opt-in to default-on.

Use a new server-only emergency switch:

`DAILY_NINE_COMPARISON_READS_DISABLED`

Semantics:

- variable absent -> enabled;
- exact trimmed `false` -> enabled;
- exact trimmed `true` -> disabled;
- blank or malformed value -> disabled.

This deliberately makes accidental/malformed explicit configuration fail closed while avoiding a permanent requirement to carry a positive enable flag after activation.

The old `DAILY_NINE_COMPARISON_READS_ENABLED` setting is no longer consulted. If it remains configured in a hosted environment, it is inert.

## Why not vercel.json

Do not hard-code activation in `vercel.json`. Vercel recommends Project Settings for environment variables, and values declared in `vercel.json` take precedence over project-level values, which would make an emergency operational disable harder.

The default-on code path plus project-level disable switch preserves:

- code-reviewed activation;
- an operational kill switch;
- no secret/public browser configuration;
- one implementation seam;
- straightforward rollback.

## User-experience boundary

Activation does not make gameplay wait for comparison.

Later browser/UI work must preserve:

1. terminal baseball outcome and awarded points render immediately;
2. comparison request starts asynchronously;
3. Next At Bat/completion/share never await comparison;
4. comparison failure degrades only the comparison presentation.

## Verification sequence

1. focused unit tests for flag semantics and route behavior;
2. full repository CI;
3. exact-head Vercel Preview;
4. Preview smoke:
   - at-bat route returns versioned success for a valid Daily/ruleset/slot;
   - completed route returns versioned success;
   - responses remain private/no-store;
5. merge one PR;
6. exact-merge Production deployment READY;
7. repeat route smoke on production;
8. inspect comparison-route runtime errors;
9. reconcile canonical docs if hosted reality differs from expected behavior.

## Production verification

PR #204 merged as `178e58cb6fcb8f09ad9ebc3e6ba69cca7a725a01`. Exact production deployment `dpl_F87hcE51cQT6zhoCp8MgGKwCSX38` reached `READY` and owns the canonical `https://initial-baseball-web.vercel.app` alias.

Post-merge September 19 smoke verified:

- `GET /api/daily/comparison/at-bat?date=2026-09-19&ruleset=points-v3&pitch=1` returned HTTP 200 with a schema-1 live payload; at verification time it reported puzzle #146, four observations, and average points 2;
- `GET /api/daily/comparison/completed?date=2026-09-19&ruleset=points-v3` returned HTTP 200 with a schema-1 live payload; at verification time it reported two completed games, average total points 28.5, and the 64-entry points-v3 histogram;
- both responses carried `Cache-Control: private, no-store`;
- the comparison-route runtime-error scan was clean.

This activates only the server read path. Browser/UI comparison consumption is still not implemented and remains the next bounded concern.

## Documentation impact

PR #204 updated `.env.example`, `docs/engineering/environments.md`, `docs/START-HERE.md`, `docs/architecture-and-scale-plan.md`, `tasks/todo.md`, and the prior read-API plan for the new activation semantics. The docs-only activation-proof follow-up reconciles those canonical files with the exact post-merge production proof and the next bounded browser/UI concern.
