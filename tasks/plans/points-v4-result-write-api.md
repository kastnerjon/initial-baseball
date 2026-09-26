# points-v4 H1 server result-write compatibility

Status: implementation scope; server write-boundary compatibility only  
Date: 2026-09-26

## Goal

Widen the two existing server result-write preflights so they accept the finalized exact-version `points-v4` contract already supported by engine validation, immutable Supabase result storage, and exact-version comparison infrastructure.

This is **not** a public scoring cutover.

The finalized inactive v4 scoring policy is:

| Outcome | Points |
| --- | ---: |
| HR | 4 |
| 3B | 3 |
| 2B | 2 |
| 1B | 1 |
| BB | 0.5 |
| K / Give Up | 0 |

Wrong guesses one and two do not deduct points. A third wrong guess is terminal K and scores 0. Nine at-bats span 0..36 in 0.5-point steps.

## Why H1 exists separately

The lower layers are already exact-version capable:

- shared result types accept points-v3/points-v4 (plus Classic for completed results);
- engine validation derives points from authoritative puzzle facts and the exact submitted ruleset;
- Supabase result codecs and constraints persist v4 half-point values;
- comparison storage/provider math understands exact-version v3/v4 populations.

The remaining server preflight mismatch is therefore an adapter concern: the POST services still reject v4 before they reach those compatible layers.

Keeping this as a separate PR avoids mixing server compatibility with browser lifecycle/default activation.

## In scope

- resolved-at-bat POST submission service:
  - accept exactly points-v3 or points-v4;
  - preserve Classic/older/unknown rejection;
  - pass the exact routed ruleset to authoritative puzzle loading and engine validation;
  - prove a v4 walk is engine-derived and stored as 0.5;
- completed-result POST submission service:
  - accept points-v3, points-v4, or Classic;
  - pass the exact routed ruleset through unchanged;
  - prove a completed nine-walk v4 game derives 4.5/36;
- preserve all existing v3 and Classic behavior;
- update canonical API/architecture/data-model/roadmap/todo docs;
- record future cutover guardrails explicitly.

## Out of scope

- `CURRENT_DAILY_RULESET_VERSION`;
- browser attempt journal/outbox identity;
- browser ownership/takeover coordination;
- browser completed-result client acceptance;
- current-Daily save compatibility;
- comparison HTTP schema/read-service/browser client/hooks;
- scorecard/share activation or copy changes;
- How to play activation/copy changes;
- archive route/navigation activation;
- any new Supabase migration or database write semantics;
- rollups, cache, indexes or comparison-performance work;
- historical result rescoring.

## Security and authority

The browser never supplies trusted points.

Both POST services continue to:

1. parse only routing fields required to select an authoritative puzzle and ruleset;
2. load the authoritative puzzle;
3. call engine validation with that exact ruleset;
4. discard client-derived score/answer/timestamp extras;
5. persist only normalized engine-derived result facts;
6. retain immutable first-write-wins/idempotency behavior.

H1 does not make anonymous result writes an anti-cheat system. It only preserves the existing authority model for another exact ruleset version.

## Acceptance checks

### Resolved at-bat

- points-v3 behavior remains unchanged;
- points-v4 routes through exact-version puzzle loading;
- a v4 BB terminal fact stores engine-derived `awardedPoints: 0.5`;
- client-supplied `awardedPoints` is ignored;
- Classic, points-v2 and unknown rulesets are rejected before puzzle loading;
- puzzle mismatch and idempotency behavior remain unchanged.

### Completed result

- points-v3 63-point behavior remains unchanged;
- Classic three-out completion remains unchanged;
- points-v4 routes through exact-version puzzle loading;
- nine v4 walks derive `points: 4.5`, `maximumPoints: 36`, nine completed at-bats, zero strikeouts;
- points-v2/unknown rulesets remain rejected;
- incomplete-game and idempotency behavior remain unchanged.

## No database change

H1 must not add or alter a migration. The September 26 v4 redefinition already made result storage exact-numeric and v4-compatible.

Before merge, verify the hosted database still has:

- v4 at-bat range 0..4 in 0.5 steps;
- v4 completed totals 0..36 in 0.5 steps;
- v3 integer constraints intact;
- zero unintended v4 production rows created by verification;
- existing RLS/direct-grant/function security posture unchanged.

## Cutover watchlist — keep explicit until v4 is live

These are intentionally **not** fixed in H1, but must stay tracked in canonical docs/todo until completed:

1. **Current-Daily save isolation — complete in H2:** points-v4 now uses its own ruleset-keyed gameplay-save namespace and only accepts v4 saves. Points-v3 retains the explicit historical legacy/v1/v2/v3 restore family but rejects v4. Existing v3 values are not copied, deleted, reinterpreted or overwritten by v4. Scope: `tasks/plans/points-v4-current-daily-save-isolation.md`.
2. **Attempt journal/outbox:** `dailyAtBatAttemptJournal.ts` and related contribution identity are still points-v3-only. Widen exact-version identity without merging populations.
3. **Gameplay ownership/lifecycle:** owner/takeover contribution logic remains deliberately v3-gated. Preserve one-owner semantics and generation fencing when widening.
4. **Completed-result browser delivery:** `dailyCompletedResultClient.ts` still accepts points-v3/Classic only. Widen only when browser v4 gameplay is ready.
5. **Comparison public boundary:** shared comparison HTTP/read-service/browser layers remain v3-only even though the server/provider domain supports v4. Widen exact-version end to end before showing v4 AVG/BEAT.
6. **Presentation:** scorecard formatting already supports one decimal, but all scorecard/share/comparison pathways must be exercised with 0.5 values and exact-version identities before activation.
7. **How to play:** copy must be ruleset-aware at the same cutover; do not show v4 scoring while v3 is active or vice versa.
8. **Archive scoring:** a newly started archived attempt uses the then-current public scoring version, while an existing attempt retains its original version. Comparison identity remains exact puzzle + exact played ruleset.
9. **Default switch last:** change `CURRENT_DAILY_RULESET_VERSION` only after browser persistence, delivery, comparison and presentation are exact-version safe. Do not use the default switch to paper over compatibility gaps.
10. **Post-activation version discipline:** once real v4 result rows exist, any future scoring change is a new ruleset version. Never reinterpret persisted v4 awarded points or merge comparison populations across versions.
11. **QA:** before cutover, explicitly test refresh/restore, concurrent tabs/takeover, old v3 save present at v4 activation, completed-result retry, comparison failure/latency, share rendering and archive replay.
12. **Performance:** preserve comparison I/O as noncritical/asynchronous. Fractional scoring does not justify new rollups/cache/index work without measured evidence.

## Verification

Before merge:

- fresh-eye source diff review against current main;
- focused submission-service tests;
- full repository CI/typecheck/file-size/data-generation/build gates;
- exact-head Vercel Preview READY and public UI still visibly v3;
- hosted Supabase schema/security/readback unchanged;
- zero durable test rows;
- no unrelated browser/default activation.

After merge:

- verify exact new main SHA;
- verify production Vercel READY on exact merge SHA;
- verify public page still advertises v3 until later H work;
- verify no unexpected open PRs;
- record if GitHub does not emit a separate push workflow run rather than claiming one ran.

## Documentation impact

Update the API spec, START-HERE, architecture/data-model docs, roadmap and todo to say the server POST preflights are v3/v4-compatible while browser delivery, comparison HTTP/browser support and the public default remain v3. Preserve this plan's cutover watchlist until each item is intentionally closed.
