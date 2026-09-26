# Points-v4 H2 current-Daily save isolation

Status: implementation scope; browser gameplay-save isolation only  
Date: 2026-09-26

## Goal

Make the future points-v4 public cutover unable to read, reinterpret, or overwrite an in-progress points-v3 Daily save.

This is a browser-storage compatibility change only. It does not activate points-v4 gameplay, result delivery, comparison UI, scorecards, How-to copy, or the public default.

## Design decision

Current beta Daily historically used one non-Classic gameplay-save key:

`initial-baseball:daily:<date>`

That key contains the saved ruleset in the payload. Before H2, non-archive compatibility treated every non-Classic ruleset as mutually compatible, so a later points-v4 bootstrap could load an older points-v3 value from the same key. Merely rejecting that payload would still leave a second-order problem: the first v4 save could overwrite the old v3 value.

H2 therefore isolates both **logical compatibility** and **physical storage**.

### Historical pre-v4 family

Preserve the existing key for the historical pre-v4 compatibility family:

- `legacy-inning-v1`
- `points-v1`
- `points-v2`
- `points-v3`

These versions already shared the default beta key. A requested points-v3 session may continue to restore that historical family, preserving the existing compatibility promise for already-started old sessions.

### Points-v4 and future points versions

Current-Daily points-v4 uses a ruleset-keyed gameplay-save namespace:

`initial-baseball:daily:ruleset:points-v4:<date>`

The storage adapter still exposes the generic Daily key to `dailyLocalStorage`; only the adapter translates it. Journal/outbox/ownership keys remain untouched because they already include exact puzzle/ruleset identity.

Future non-Classic rulesets not in the historical pre-v4 family should naturally use the same `initial-baseball:daily:ruleset:<ruleset>:<date>` pattern rather than falling back to the old shared key.

### Compatibility policy

- permanent archive saves remain exact-version, as already implemented;
- Classic remains exact Classic-only;
- current points-v3 may restore only the explicit historical pre-v4 family;
- current points-v4 restores only points-v4;
- later current-Daily rulesets restore only themselves unless a future migration is explicitly designed.

This is intentionally asymmetric: it preserves the prior v1/v2/legacy -> v3 compatibility contract while creating a hard v3/v4 boundary.

## In scope

- `dailyModeStorage.ts` key selection and adapter translation;
- `isDailyModeSaveCompatible` cutover-safe compatibility policy;
- focused unit tests proving:
  - the v3 key is unchanged;
  - v4 uses a separate current-Daily key;
  - a v4 write cannot overwrite a v3 save;
  - clearing v4 leaves v3 untouched;
  - v4 rejects v3 and older saves;
  - v3 still accepts legacy/v1/v2/v3 but rejects v4;
  - archive exact-version behavior remains unchanged;
  - Classic isolation remains unchanged;
  - journal/outbox identity keys are not translated;
- canonical documentation and activation-watchlist reconciliation.

## Out of scope

- changing `CURRENT_DAILY_RULESET_VERSION`;
- widening the attempt journal/outbox to v4;
- widening Web Lock ownership/takeover contribution to v4;
- widening completed-result browser creation/delivery to v4;
- changing comparison HTTP/browser contracts;
- scorecard/share presentation changes;
- How-to copy;
- archive route/navigation work;
- Supabase schema/data changes;
- deleting, copying, rewriting, or migrating existing localStorage values.

## Important invariants

1. Existing points-v3 users keep the same physical key today.
2. H2 must not delete an old v3 save merely because v4 is requested later.
3. A v4 save/reset must never mutate the v3 key.
4. A rollback from v4 default back to v3 can still find the pre-existing v3 save because it was never overwritten.
5. Existing Classic and archive namespaces remain exactly as before.
6. Result delivery records, journals, outboxes and owner locks remain separate contracts and are not renamed here.
7. Incompatible saves fail closed to a fresh requested-ruleset game; no score or progression token is reinterpreted across the v4 boundary.

## Verification

Before merge:

- fresh-eye diff review;
- focused `dailyModeStorage` tests;
- full repository typecheck/tests/file-size/data-generation/build gates;
- exact-head Vercel Preview READY;
- preview/public Daily remains points-v3 with existing 7/63 copy;
- no Supabase change is expected or required;
- no unrelated H3/H4/H5 activation.

After merge:

- verify exact new main SHA;
- verify push CI on the merge SHA;
- verify production Vercel READY on that SHA;
- verify production public Daily remains points-v3;
- verify exact-deployment error/fatal logs;
- verify no unexpected open PRs.

## Documentation impact

Update the API/browser-persistence spec, data model, architecture/product handoffs, START-HERE, September 24 roadmap, todo, archive-save plan, and H1 handoff so they describe the cutover-safe v3/v4 storage boundary precisely. Mark H2 complete and leave H3-H5 explicitly open.
