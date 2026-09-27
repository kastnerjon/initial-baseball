# Points-v4 H3 browser result delivery

Status: implementation scope; browser contribution/delivery compatibility only  
Date: 2026-09-27

## Goal

Widen the existing browser resolved-at-bat contribution lifecycle and completed-result delivery from exact `points-v3` to exact `points-v3 | points-v4` without weakening any existing ownership, generation-fencing, immutable retry, idempotency, or legacy-save safeguards.

This is not the public scoring cutover. `CURRENT_DAILY_RULESET_VERSION` stays `points-v3`.

## Current foundation

H1 already made the two server result-write boundaries accept finalized exact-version v4. H2 then made current-Daily gameplay-save storage cutover-safe:

- the historical legacy/v1/v2/v3 family retains `initial-baseball:daily:<date>`;
- v4 uses `initial-baseball:daily:ruleset:points-v4:<date>`;
- cross-v3/v4 gameplay-save restore/overwrite is blocked.

The browser result-delivery stack already carries ruleset identity in journal keys, lock names, completed-result keys, and payloads. H3 should widen accepted identity, not redesign those contracts.

## Design

### Attempt journal / outbox

Keep record schema version 1 and the same storage-key format:

`initial-baseball:daily-at-bat-attempt:v1:<ruleset>:<date>:<puzzle>`

Widen `DailyAtBatAttemptIdentity.rulesetVersion` to the shared `DailyAtBatResultRulesetVersion` (`points-v3 | points-v4`).

The frozen schema-1 submission must copy the journal identity's exact ruleset. Decoding accepts v3/v4 only. Existing v3 records remain byte-compatible and require no migration.

### Ownership / takeover

The ownership coordinator itself already derives its lock name from exact identity and should stay structurally unchanged:

`initial-baseball:daily-at-bat-owner:v1:<ruleset>:<date>:<puzzle>`

The composition gate in `useDailyGameplayPersistence` widens to v3/v4 only when the loaded gameplay save is either absent or has the exact same contributing ruleset as the requested session.

Consequences:

- fresh v3 and fresh v4 can contribute;
- restored native v3 contributes only to v3;
- restored native v4 contributes only to v4;
- legacy/v1/v2 saves continue through compatibility persistence and never create resolved-AB observations;
- Classic remains compatibility-only for resolved-AB collection;
- exact v3/v4 lock/journal identities never merge.

### Lifecycle reconciliation

Replace the hardcoded “loaded save must be v3” check with “loaded save ruleset must equal the current attempt identity ruleset.”

All existing native-fact equality, generation, retirement, no-backfill, save-before-freeze, and fail-closed behavior remains unchanged.

### Completed-result browser delivery

The existing completed-result record key already includes exact ruleset:

`initial-baseball:daily-result-submission:v1:<ruleset>:<date>:<puzzle>`

Widen browser acceptance from v3/Classic to v3/v4/Classic. Do not rewrite or reuse a v3 record for v4; the existing key separation prevents that.

Fresh points-v4 contributing runs may reuse the attempt ID as the completed-result submission ID exactly as v3 does today. Existing pending/completed records remain authoritative and immutable.

## In scope

- widen at-bat attempt identity/decoder/submission creation to v3/v4;
- widen current-browser contribution coordination to exact-version v3/v4;
- make lifecycle durable reconciliation compare against exact attempt ruleset;
- widen completed-result browser client to v3/v4/Classic;
- focused tests for v4 journal persistence/retry, exact-version lock identity, v4 takeover reconciliation, mismatched-version retirement, v4 completed-result delivery, and preserved v3/legacy/Classic behavior;
- reconcile canonical docs and activation watchlists.

## Out of scope

- comparison HTTP/read-service/browser acceptance (H4);
- scorecard/share/comparison presentation validation (H4);
- How-to copy (H5);
- switching `CURRENT_DAILY_RULESET_VERSION` (H5, last);
- changing scoring logic;
- changing H2 gameplay-save namespaces;
- changing journal/completed-result schema versions;
- migrating/re-writing old localStorage records;
- Supabase schema/RPC changes;
- archive routes/navigation;
- broader Web Lock redesign, leases, forced steals, background workers, or server sessions.

## Invariants to preserve

1. Only one browser owner may write a given puzzle/ruleset gameplay run.
2. Generation takeover fencing remains exact and monotonic.
3. Gameplay saves happen before terminal facts are frozen into the AB outbox.
4. Frozen AB submissions are immutable; retries resend the exact stored payload.
5. A stale/disposed owner cannot acknowledge or mutate a successor generation.
6. Conflict/rejection retires contribution; transient failures remain pending.
7. No historical facts are backfilled from gameplay saves into the AB journal.
8. Old pre-rollout/compatibility saves remain completion-only where already allowed.
9. v3 and v4 journal, lock, gameplay-save, completed-result, and server aggregate identities stay separate.
10. Existing completed-result records always win over a newly preferred attempt ID.
11. Classic still sends no resolved-AB observations.
12. The public website remains v3 after H3.

## Remaining activation watchlist after H3

- H4: widen comparison HTTP/read-service/browser consumers to exact v4; verify fractional AVG/BEAT and scorecard/share rendering while preserving asynchronous nonblocking comparison I/O.
- H5: make How-to copy ruleset-aware; run refresh/restore, old-v3-save-at-cutover, concurrent-tab/takeover, retry/failure, share, archive replay and cutover QA; switch `CURRENT_DAILY_RULESET_VERSION` last.
- Once public v4 result rows exist, any scoring-policy change requires a new ruleset version. Never reinterpret v4 history.
- Do not add rollups/caches/indexes merely because v4 uses half-points; performance changes remain evidence-driven.

## Verification

Before merge:

- fresh-eye source/architecture review;
- focused browser lifecycle/result tests;
- full repository CI/data/build gates;
- exact-head Vercel Preview READY;
- Preview still exposes points-v3 7/63 copy and no public v4 scoring;
- no Supabase migration or data mutation expected;
- no H4/H5 scope leakage.

After merge:

- verify exact new `main` SHA;
- verify push CI on the merge SHA;
- verify production Vercel READY on that SHA;
- verify live public Daily remains points-v3;
- scan exact production deployment error/fatal logs;
- verify no unexpected open PRs.

## Documentation impact

Update START-HERE, API/data-model/architecture/product docs, September 24 roadmap, todo, H1/H2 handoffs, and the v4 redefinition plan so H3 is recorded as complete only after merge while H4-H5 remain explicit.
