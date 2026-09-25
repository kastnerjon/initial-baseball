# Points-v4 web result-write compatibility

Status: H1 implementation scope; server result-write compatibility only, not browser activation  
Date: 2026-09-25

## Scope contract

- **Goal:** make the existing Daily result-write web boundary truthfully accept exact-version `points-v4` submissions now that portable validation and immutable Supabase persistence already support them, without enabling any browser v4 gameplay path or changing the public default.
- **Owning layer:** `apps/web` server submission composition. Shared/engine contracts and Supabase storage remain unchanged.
- **In scope:** widen resolved-at-bat routing from v3-only to the existing v3/v4 result ruleset union; route the received exact ruleset into authoritative puzzle lookup and engine validation; widen completed-result routing from v3/Classic to v3/v4/Classic; focused negative-v4 write-path tests; canonical API/architecture/handoff documentation.
- **Out of scope:** browser journal/outbox/ownership, completed-result browser client, saved-game activation, comparison HTTP/browser contracts, comparison hooks/prefetch, scorecards/shares, archive route activation, `CURRENT_DAILY_RULESET_VERSION`, scoring formulas, Supabase schema/functions/ACL, rollups/caches.
- **Acceptance checks:** v4 terminal K resolves to engine-derived `-1` through the at-bat submission service; a valid nine-K v4 completion resolves to `-9` with maximum 36; v3 behavior stays unchanged; Classic completed results stay unchanged; older/unknown point rulesets remain rejected; puzzle lookup and validation use the submitted exact ruleset; client-supplied derived fields remain discarded.
- **Stop conditions:** any need to alter browser persistence/session identity, scoring, comparison transport, UI rendering, archive routing, or database objects moves to a later H PR.

## Why H starts here

The lower layers are already compatible in a deliberate sequence:

1. shared/engine schema-1 result contracts validate exact v3/v4 facts;
2. Supabase result codecs and constraints persist signed v4 values;
3. comparison storage/provider reads are exact-version v3/v4-capable;
4. the remaining server submission preflight still rejects v4 before reaching those compatible layers.

Widening only that server preflight is therefore a coherent compatibility checkpoint. It removes a false v3-only boundary without entangling browser ownership, saved-game migration behavior, comparison presentation, or the public scoring switch.

## Exact-version and abuse boundary

These anonymous result endpoints still do not establish honest play; that was already true for v3. After H1, a direct client can submit structurally valid v4 facts before the ordinary browser exposes v4 gameplay. Those rows remain isolated by puzzle + exact ruleset and therefore cannot contaminate v3 populations.

Do not respond to that limitation by mixing populations, adding scoring in the route, or introducing a browser-facing activation flag in this PR. Ordinary browser gameplay still emits v3 only, and comparison HTTP/browser reads still reject v4 until their own bounded H work.

## Implementation

### Resolved at-bat

- replace the v3-only routing type with the existing `DailyAtBatResultRulesetVersion`;
- accept only the existing result-contract set `points-v3` / `points-v4`;
- pass the routed ruleset unchanged to authoritative puzzle lookup and `validateDailyAtBatResult`;
- keep Classic and older point versions rejected.

### Completed result

- add `points-v4` to the existing accepted completed-result routing set;
- retain Classic support;
- pass the routed exact ruleset unchanged through the existing validator/repository path.

No route response shape, HTTP status mapping, request-size guard, persistence semantics, or provider composition changes are required.

## Verification

Focused checks should prove:

- v3 at-bat submission still derives/stores the current v3 score;
- v4 at-bat submission derives/stores a signed negative score;
- Classic remains unsupported for resolved-at-bat observations;
- v3 completed submission remains unchanged;
- v4 completed submission derives the signed whole-game result;
- Classic completed submission remains unchanged;
- points-v2/unknown rulesets still fail during routing before authoritative puzzle lookup.

Repository CI remains authoritative for typecheck, full tests, file-size guard, canonical baseball-data pipeline, production package build order, and documentation-impact checks. Require exact-head Vercel Preview before merge.

Supabase migration work is not applicable to H1. Hosted result-table/function posture should nevertheless remain unchanged in the post-merge verification because this PR relies on G3A/G3B rather than modifying them.

## Follow-up H sequence

The next bounded checkpoint should make browser gameplay contribution/session infrastructure exact-version v3/v4-compatible: journal/outbox identity, ownership coordination, persistence eligibility, resolved-at-bat delivery, and completed-result browser delivery. It must explicitly preserve an already-started v3 save as v3 rather than silently migrating it when the public default later becomes v4.

After that, keep comparison HTTP/browser compatibility and scorecard/share negative-value presentation separately reviewable where practical. The final `CURRENT_DAILY_RULESET_VERSION` cutover remains its own deliberate checkpoint.

## Documentation impact

Update the API specification, START-HERE, architecture handoff, current-work todo, and September 24 roadmap so they distinguish server result-write v4 compatibility from still-v3 browser/comparison/presentation/default activation.
