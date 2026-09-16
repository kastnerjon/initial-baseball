# Classic web transport/progression scope

Status: active bounded implementation, September 16, 2026.

## Goal

Allow the existing Daily server runtime to issue and advance either the current Daily Nine ruleset or `classic-inning-v1` under signed progression, with Classic completing immediately at three outs or batter nine and returning no successor hint bundle after completion.

## Owning layer

Primary owner: `apps/web` server transport/runtime. Completion policy remains owned by `packages/engine` and must be reused rather than reimplemented.

## In scope

- typed bootstrap ruleset selection limited to new-session Daily Nine (`points-v3`) and Classic (`classic-inning-v1`);
- explicit ruleset identity in the bootstrap transport contract;
- signed progression claims preserving that ruleset through hint restoration/reveal and resolution;
- server successor-claim completion delegated to engine `isDailyGameComplete`;
- Classic completion on the third recorded out or ninth batter, with `hintBundle: null` after completion;
- compatibility for existing valid `points-v2`, `points-v1`, and `legacy-inning-v1` signed sessions;
- focused progression/runtime/token tests;
- API, Classic plan, handoff, and todo documentation reconciliation.

## Out of scope

- public `/classic` route activation;
- mode navigation/help copy;
- browser local-storage namespaces or save migration;
- client reset/refresh/result/share mode-awareness;
- UI layout work;
- new persistence, database, auth, hosting configuration, dependencies, aggregates, or lineup behavior.

Those remain the explicitly stacked browser-experience PR.

## Acceptance checks

- default bootstrap still issues `points-v3`;
- explicit Classic bootstrap issues signed `classic-inning-v1` claims and exposes that mode in the bootstrap contract;
- Classic correct outcomes continue until batter nine when outs are below three;
- third strike/Give Up producing out three completes Classic immediately and returns no future bundle;
- Classic also completes at batter nine regardless of outs;
- points-v3/points-v2/points-v1 continue through three recorded outs;
- legacy three-out completion remains compatible;
- tampering with the signed ruleset still fails token verification;
- focused tests plus full CI, file-size, typecheck, data/build and hidden-answer checks pass.

## Stop conditions

Stop and split work if implementation requires activating `/classic`, changing browser persistence, adding a new API/dependency, changing client/server authority, changing the product rules already approved in PR #141, or exceeding the repository decomposition thresholds.
