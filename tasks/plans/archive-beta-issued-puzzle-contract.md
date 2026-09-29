# Archive-beta immutable issued-puzzle contract

Status: implementation plan

## Scope contract

- **Goal:** extend the portable immutable issued-puzzle domain so the new `archive-beta-v1` identity can use the same first-write-wins schema-v2 clue-frozen semantics without weakening or reinterpreting `permanent-v1`.
- **Owning layer:** `packages/daily`.
- **In scope:** a series-neutral immutable issued-puzzle core over the two explicitly supported identities; backward-compatible permanent wrappers; archive-beta schema-v2 constructors/service/read contract; exact-series/date/number validation; defensive cloning; idempotent exact retry and immutable-conflict behavior; focused permanent-regression and beta tests; canonical documentation.
- **Out of scope:** Supabase codec/repository/migration changes, hosted writes, editorial issuance composition, configured beta epoch, archive routes/gameplay/results/history, deletion/reset tooling, or permanent launch policy.
- **Acceptance checks:** existing permanent v1/v2 behavior and exports remain compatible; beta schema-v2 puzzle IDs are `archive-beta-v1-daily-N`; exact beta retries preserve first issue time; changed lineup/clues conflict; cross-series identity cannot be accepted as an exact retry; read queries validate and fence exact beta series/date/number; no application/provider change is required.
- **Stop conditions:** any necessary web/provider/database change is deferred to the next PR; any need to alter permanent row semantics, schema versions, or clue contents requires a separate decision.

## Architecture decision

The immutable issued-puzzle mechanics are series-neutral, while series membership remains explicit and closed. A small portable core may accept exactly `permanent-v1` and `archive-beta-v1`; existing permanent APIs remain wrappers/aliases so current web composition does not need to change in this PR.

Archive beta starts directly with the clue-frozen schema-v2 contract. There is no reason to create schema-v1 beta compatibility because no beta row exists yet. Permanent schema-v1 reads remain supported for historical compatibility.

The provider boundary is not widened here. The next bounded PR will teach the Supabase codec/repository/schema to persist and read `archive-beta-v1` records before any real test puzzle is issued.
