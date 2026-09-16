# Daily lineup ChatOps scope

## Owning concern

Add a secure operational adapter so the owner can provide a future date and exact nine-player lineup conversationally without manually replacing nine admin slots.

## In scope

- portable atomic nine-player replacement using existing revision and immutability rules;
- reviewed-candidate validation and exact batting-order preservation;
- dedicated server-only bearer authorization before privileged repository construction;
- explicit draft/schedule intent;
- cache invalidation through the existing repository wrapper;
- focused parser, authorization, lifecycle, and workflow regression coverage;
- operational documentation for a private assistant transport.

## Out of scope

- direct Supabase editorial writes;
- moving lifecycle/domain rules into Supabase, React, or routes;
- admin UI redesign;
- publishing or published-puzzle correction/versioning;
- repeat-window or recognizability changes;
- exposing future lineup content in the public GitHub repository or browser;
- Classic mode, aggregates, percentile scoring, recipes, or lineup-generation redesign.

## Security decision

The repository is public. GitHub issues/Actions payloads are therefore not an acceptable transport for future lineup content. The production bridge must remain private. The intended operational path is a connected private Supabase transport that forwards an authenticated request to the server ChatOps adapter while leaving all domain mutation inside the existing Daily workflow/lifecycle.

## Release gate

Run focused tests and full CI; review the diff against `AGENTS.md`; update canonical documentation; deploy preview; verify unauthorized failure; configure the production machine credential without exposing it; smoke-test one future draft; verify exact readback and public-answer integrity; only then treat conversational lineup editing as operational.
