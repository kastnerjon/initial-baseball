# Reconcile PR #163 hosted handoff

Status: Active scope contract  
Date: 2026-09-17

## Goal

Reconcile the canonical project handoff after PR #163 is merged and its exact merge SHA is deployed successfully to production.

## Owning layer

Documentation and project continuity only.

## In scope

- update `docs/START-HERE.md` to make PR #163 / merge SHA `0001f51c15b9e7b4e5e9647ce471365a96f19bc7` the verified production baseline;
- record production deployment `dpl_APaPW1hwmzghnoRg4fEXhcFnNCCw` as READY on that exact SHA;
- remove the now-stale statement that public editorial-candidate production verification is pending;
- update `tasks/todo.md` to mark that hosted verification complete and keep the next work ordered correctly;
- keep draft PR #161 explicitly unmerged and preserve the decision to split provider, API, and browser submission work;
- keep future editorial lineup payloads out of public GitHub surfaces.

## Out of scope

- Daily lineup contents or future player names;
- scheduling, publishing, or mutating editorial puzzles;
- code, runtime, database, scoring, gameplay, or UI changes;
- merging or modifying draft PR #161;
- changing the beta/launch/archive product model.

## Acceptance checks

- only documentation/continuity files change;
- START-HERE and todo agree on the exact current production baseline;
- no future lineup payload appears in the diff;
- the next completed-result work remains split into bounded provider, API, and browser concerns;
- documentation CI/checks pass before merge.

## Stop conditions

Stop rather than marking hosted verification complete if the production deployment is not READY on the exact PR #163 merge SHA or if the documentation update would require a product/architecture decision.
