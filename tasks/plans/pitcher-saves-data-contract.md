# Pitcher saves data contract

Status: bounded prerequisite for hint-4 stat composition.

## Goal

Make the legacy Daily player stat substrate distinguish a sourced career save total of zero from an unavailable save total before hint 4 begins consuming structured pitcher stats.

## Owning layers

- `packages/baseball-data`: generated Lahman save artifact and legacy Daily player composition.
- `packages/shared`: truthful legacy player career-stat type.

No web presentation, Daily orchestration, engine, Supabase, or scoring ownership changes in this PR.

## In scope

- Generate a pitcher save total only when a matched pitcher has pitching-source rows.
- Preserve a sourced save total exactly, including `0`.
- Leave `careerStats.stats.SV` absent when the generated save artifact has no value for that player.
- Model career pitcher `SV` as optional without weakening season-row save typing.
- Add regression coverage proving both sourced zero and unavailable cases exist and remain distinct.
- Reconcile canonical docs.

## Out of scope

- Do not change hint 4 text or ordering.
- Do not change reveal ordering.
- Do not add WAR or another baseball source.
- Do not alter canonical runtime reveal facts.
- Do not change scoring, initials, archive routes, tokens, persistence, or database schema.
- Do not interpret a missing save source as evidence that the player had zero saves.

## Second- and third-order effects

Hint 4 can only safely add pitcher `SV` after this distinction exists. A later formatter must omit or render unavailable saves according to the shared display policy; it must not fall back to zero. Known zero-save pitchers must still display `0`. Season reveal rows remain stricter because their save values come from actual season pitching rows.

This change does not freeze clue text. Permanent clue immutability remains a separate prerequisite before permanent issuance.

## Acceptance checks

- Focused baseball-data tests pass.
- Full tests and typecheck pass.
- File-size and documentation gates pass.
- Canonical baseball-data pipeline regenerates cleanly.
- Production web package build passes.
- Generated artifacts do not gain incidental diffs.
- Exact-head GitHub CI and Vercel Preview pass before merge.
- Fresh-eye review confirms no hint/UI/scoring expansion.

## Stop conditions

Stop and split again if implementing truthful save availability requires a new external source, canonical-runtime schema change, web formatting change, or database migration.
