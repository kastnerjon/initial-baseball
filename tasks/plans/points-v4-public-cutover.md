# Points-v4 H5b public cutover

Status: final public scoring activation  
Date: 2026-09-27 / explicit same-puzzle cutover exception

## Release decision

The user explicitly authorized activating points-v4 immediately even though the September 27 Pacific Daily is already in progress.

That knowingly creates a same-puzzle split:
- sessions started before this deployment may have points-v3 state/results;
- new public sessions after this deployment use points-v4;
- H2-H4 intentionally keep those populations exact-version isolated.

This is an accepted release tradeoff for this cutover only. It does not weaken the general rule against silent mid-puzzle scoring changes.

## Goal

Switch the public Daily Nine default from points-v3 to finalized points-v4 only after re-verifying the already-deployed safety seams.

Final v4:
- initials = 4
- hint 1 = 3
- hint 2 = 2
- hint 3 = 1
- hint 4 = 0.5
- first two wrong guesses do not deduct
- third wrong guess / Give Up = K = 0
- all 9 at-bats
- max 36
- score step 0.5

## Preconditions already deployed

- H1: server result writes accept exact v4.
- H2: current-Daily v4 gameplay saves use a separate ruleset-keyed storage slot; v3 save remains untouched.
- H3: journal/outbox, ownership/takeover and completed-result delivery support exact v3/v4 identity.
- H4: comparison HTTP/read/browser path and scorecard/share presentation support exact v3/v4 and half-points.
- H5a: How-to dialog renders exact ruleset copy.

## Cutover changes

1. Change `CURRENT_DAILY_RULESET_VERSION` from points-v3 to points-v4.
2. Update current-default tests/fixtures that intentionally assert the public default.
3. Update default summary constants only where they semantically represent the current public default.
4. Update canonical docs from “pre-activation” to “points-v4 live,” while preserving historical v3 semantics.
5. Do not migrate, rewrite, copy, clear or merge existing v3 saves/results/comparison rows.

## Cutover QA

Automated coverage must continue to prove:
- v4 scoring range 0..36 with 0.5 step;
- wrong guesses 1/2 do not deduct and third strike scores 0;
- v3 scoring remains unchanged;
- v3 current save cannot be consumed/overwritten by v4;
- v3/v4 journals and ownership lock identities differ;
- v4 takeover only reconciles against v4 durable gameplay;
- v4 result retries keep exact frozen payload;
- v3/v4 completed-result records differ;
- v4 comparison transport/read/client supports half-points and 73-slot histogram;
- v4 scorecard/share/How-to render decimals and 36 max;
- archive restore remains exact-version.

## Invariants

- Existing v3 local save remains physically intact after v4 starts.
- Existing v3 server results remain points-v3 forever.
- v3 and v4 comparisons never merge.
- Archive attempts retain the ruleset they started with.
- Classic remains independent.
- No Supabase migration or provider mutation is required.
- No QA gate is weakened to ship the cutover.

## Verification

Before merge:
- fresh-eye source review;
- exact-head full CI;
- exact-head Vercel Preview READY;
- Preview public Daily shows v4 How-to copy and 36 max;
- Preview does not show v3 7/63 instructions;
- no Supabase changes.

After merge:
- exact `main` SHA;
- push CI success;
- production exact-SHA READY;
- live public Daily shows v4 copy;
- runtime error/fatal scan clean;
- no unexpected open PRs.

## Documentation impact

Mark points-v4 as the live public Daily Nine default in START-HERE, engine/API/data-model/product handoffs, roadmap and todo. Preserve the explicit same-puzzle cutover exception and historical points-v3 guarantees.
