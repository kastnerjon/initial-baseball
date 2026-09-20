# Daily Nine resolved-at-bat comparison

Status: Approved direction; collection and R1–R4 browser prerequisites complete; portable comparison read contract and hosted Supabase aggregate provider implemented; API/UI remain
Date: 2026-09-18

September 19 review update: `docs/engineering/resolved-at-bat-review-2026-09-19.md` identified R1–R4 browser prerequisites; all four are repaired. The portable comparison contract is now implemented without provider/API/React work. Continue one owning concern per PR.

## Scope contract for this PR

Goal: replace completion-only comparison planning with the agreed player experience and explicit implementation gates.
Owning layer: repository product/architecture documentation.
In scope for the original planning PR: this plan, canonical product/architecture/data-model docs, START-HERE and todo; PR #174 was later closed as superseded.
Out of scope: runtime changes, schema deployment, performance claims, public UI changes, merging #174.
Acceptance: inspect current main and #174, reconcile contradictory directions, validate documentation impact and diff, perform one bounded review.
Stop conditions: implementation belongs in subsequent owning-layer PRs; unresolved cross-tab authority must be settled before activating collection.

## Verified starting point

Inspected main `2a737a2` and PR #174 head `38f3bc9` on September 18.
Completed-result engine validation, immutable repository, Supabase adapter, API, browser delivery and native activation are on main. Retain those boundaries and tests.
`dailyCompletedResultClient.ts` currently generates the ID when completion creates a delivery record; same-tab single-flight is not cross-tab coordination.
`dailyProgressionToken.ts` signs puzzle/ruleset, pitch, hint/strike/out state and completion. It has no attempt identity or complete resolved-fact history. A signed token is not proof of honest play or a unique human.
PR #174 is held as draft, not merged: its every-slot-count-equals-completion-count assertion contradicts the new population. Retain the read-port separation and scoped aggregate tests as design references, not the invariant or repeated read-time rescoring.

## Player behavior and population

- After every terminal Daily Nine AB (correct, strikeout or Give Up), show the normal answer/outcome/engine points immediately. Load YOU / AVG and observation count asynchronously. Next At Bat never waits.
- An AB average includes received observations for that exact stable puzzle + points-v3 + slot, including partial games. Use `resolvedAtBatCount`.
- Whole-game average and score distribution use completed results for the same puzzle/ruleset. Use `completedGameCount`.
- These counts are independent. Never require equality, descending slot counts, or nine received AB rows before accepting a valid completion.
- At completion render available comparison snapshots, then refresh asynchronously. Restoring a completed page fetches current comparisons. Never attach historical averages permanently to the user's result.
- "You beat X% of finishers" = completed scores strictly below the user's score / completedGameCount. Ties are not beaten; use the full denominator including self if present.
- Initial display policy: 0–1 observations means waiting; 2–9 means early average with count; 10+ normal average; beat-percentage waits for 20 completions. Empty average is null, not zero. Thresholds belong in presentation, not SQL.
- Averages may be briefly cached. No immediate self-inclusion or atomic cross-population snapshot guarantee. Return freshness metadata; cached data and failed reads are distinguishable.
- Counts describe received anonymous results, not verified unique people or definitive abandonment. Partial delivery and ongoing play affect counts.
- Comparison outages do not block gameplay, final results or sharing. No pre-resolution comparison display or unrevealed answer exposure.

## Attempt, reset and browser lifecycle

One random anonymous identity per contributing run, scoped to stable puzzle and game/ruleset. Establish and persist it before the first observation. For new eligible runs, reuse it as completed-result submissionId if compatibility checks confirm this can preserve the existing schema-1 contract.

Freeze each terminal AB's native facts locally before its first send. The tuple (attempt ID, puzzle identity, ruleset, pitch number) identifies one immutable observation. Identical retries return existing; differing payloads conflict without overwrite. The final record uses the same run's facts, never a mixture of replays.

Refresh continues the same run; pending exact payloads survive. Reset before any terminal AB may retain contribution eligibility. Reset after a terminal AB is locally recorded makes subsequent play non-contributing regardless of network acknowledgment. Preserve original pending observations for retry, including pending completion. Reset cannot revive contribution in another tab.

Public "Reset today's results" is beta-only and must be removed before broad launch. Any retained admin/test mechanism must produce non-contributing runs; implementing that mechanism is separate scope. Public replay is not a required launch feature.

### Cross-tab implementation gate

First-write-wins on individual rows does not ensure one coherent run. Before activating collection, implement and test serialized ownership of the contributing run plus durable observation creation. A second tab must not independently fork the same attempt or mint another counted attempt. Storage events alone are notification, not a lock.

The settled design uses one long-lived exclusive Web Lock per stable puzzle + exact ruleset, a small versioned `localStorage` attempt journal/outbox, and owner-only shared gameplay-save writes. A queued takeover reloads persisted gameplay and journal state before contributing; it never continues a follower's stale in-memory branch. Do not use clock leases or forced stealing. Unsupported locking/storage/random-ID capability leaves gameplay available but fails closed for new resolved-AB contribution. Exact record shape, follower behavior, reset/legacy rules, browser verification and the four bounded implementation PRs are defined in `tasks/plans/resolved-at-bat-browser-lifecycle.md`.

### Existing saves and rollout

Do not synthesize historical AB observations from existing completed rows or restored old facts. Keep existing pending completed-result payloads and IDs exactly intact. Previously saved games remain playable under their existing completion eligibility rules. For the first AB rollout, a save without the new attempt/provenance metadata stays on the old completion-only path for that run; only fresh eligible runs collect ABs. Do not overwrite a pre-existing completion identity when initializing a new run. Distinct population sizes during rollout are expected.

Browser storage loss cannot be recovered without accounts; do not claim universal exactly-once human participation. Storage rejection must not turn into untracked new IDs on every retry.

## Contracts, authority and delivery

Shared owns portable transport/identity types; engine owns normalization and scoring; Daily owns idempotent orchestration/read ports; web owns durable browser coordination, transport and Supabase adapters.

The request carries native facts, not an authoritative score. Validate exact authoritative puzzle identity and slot/initials, supported ruleset, terminal resolution, hint/strike bounds and outcome consistency using existing engine rules. Persist engine-derived awarded points once beside normalized facts. SQL aggregates stored points, never copies the scoring formula.

Do not introduce signed receipts by default. Before proposing a receipt, show which server-established facts it certifies and how it binds the attempt/slot; replayable progression does not become an anti-cheat system merely by adding a signature. V1 remains anonymous internally validated statistics, consistent with completed-result authority.

An AB POST may combine insert and comparison read but must return separate outcomes:
- created/existing + available comparison: acknowledge observation and display comparison;
- created/existing + unavailable comparison: acknowledge observation; retry only a read when useful;
- transport timeout/unknown commit: retry exact observation safely;
- invalid/conflict: terminal delivery outcome, never silently overwrite or rotate identity;
- transient failure: keep pending, bounded backoff; no tight retry loop.

Provide a read-only comparison path for acknowledged results, refreshes and non-contributing replays. Tie async responses to puzzle/ruleset/slot so an old response cannot populate a different reveal. Retry scheduling must not repeatedly scan or resend terminal records. Keep comparison work off `/api/daily/resolve`'s database path.

## Persistence and scale gates

The implemented immutable table is `daily_at_bat_results`. It stores attempt ID, stable puzzle ID/date/number, ruleset, slot, initials, outcome, hints, wrong guesses, resolution, engine-derived awarded points, provider receipt time and explicit schema/version metadata. It stores no answer names, search terms, wrong-answer identities or IP identity. Keep `daily_completed_results` for whole-game results.

The provider uses composite unique observation identity plus a separate population/slot index. Access is server-only with RLS and least-privilege SELECT/INSERT; there is no browser row access or update/upsert overwrite. Exact design and hosted verification: `tasks/plans/resolved-at-bat-supabase-provider.md`. No rollup tables, triggers, realtime, cron, mutable session table or retention deletion in v1.

Initial live read returns count and point sum/average only. Whole-game read uses bounded 0–63 score buckets; future AB distributions/rates can use retained native facts when a consumer needs them. No raw-population download into Node.

An index narrows a scan; it does not make AVG constant-cost. PR #203 measured the real current functions on disposable PostgreSQL 17 with 100 / 1,000 / 10,000 target populations plus unrelated rows. At 10,000, warmed p95 database execution was 1.807 ms for a one-slot AB aggregate and 6.254 ms for completed score buckets; the completed 50/50 synthetic table even chose a sequential scan and remained comfortably inside the provisional 25 ms database budget. That evidence supports keeping raw reads for the beta rather than adding derived mutable state now. It is not a claim about arbitrary concurrency, managed network latency, or million-player scale.

Keep the read ports storage-strategy-neutral. If later browser/server telemetry misses the end-to-end target, first identify whether database execution, provider/network, server composition, or browser scheduling is actually dominant. Only if database aggregation becomes the measured bottleneck should a separate optimization PR consider caching or a rebuildable transactional projection. A future projection should keep immutable raw rows authoritative, use AB count + point sum and sparse completed score/count buckets, partition incompatible populations by `ruleset_version`, and keep scoring out of SQL. No specific traffic capacity, paid tier or bill is asserted beyond measured evidence.

## Implementation sequence (one owning concern per PR)

1. Complete: documentation PR settled product requirements, preserved #174 as draft and reconciled handoff.
2. Complete: portable resolved-AB contract/engine validation with versioned facts, puzzle binding, existing scoring reuse and malformed/compatibility tests.
3. Complete: portable Daily repository/service with atomic insert-if-absent and semantic same/conflicting payload behavior.
4. Complete: Supabase adapter/migration with normalized row codec, uniqueness/index, server-only privileges and isolated hosted verification; collection remains inactive.
5. Complete: web AB submission API with authoritative puzzle lookup, existing service composition and deliberate error mapping. No browser activation.
6. Approved: browser lifecycle architecture and decomposition; scope: `tasks/plans/resolved-at-bat-browser-lifecycle.md`.
7. Browser 6A: durable attempt journal and immutable AB outbox client; no Web Locks, React or activation.
8. Browser 6B: exclusive cross-tab ownership coordinator and takeover/fencing tests; no gameplay or network activation.
9. Browser 6C: owner-gated gameplay persistence plus fresh/reset/legacy lifecycle integration; collection remains off.
10. Browser 6D: freeze/send/retry terminal ABs, reuse the fresh attempt ID for a new completion record, then complete multi-tab/device/production proof.
11. Complete: portable Daily Nine comparison read contract/service. One slot read is independent from completed-game reads; providers supply count + stored point sum or score buckets; Daily derives null empty averages, bounded histogram, strict-lower rate. Scope: `tasks/plans/daily-nine-comparison-read-contract.md`.
12. Complete: Supabase aggregate provider. Hosted migration `20260919164818_create_daily_nine_comparison_reads` installs two server-only SECURITY INVOKER RPCs that aggregate stored engine-derived points into one-slot count/sum or completed score buckets; raw population rows are not downloaded. ACL/function behavior, service-role execution, current query plans and advisors are verified. Scope: `tasks/plans/daily-nine-comparison-supabase-provider.md`.
13. Complete: portable comparison HTTP response contract in `packages/shared` (PR #199). Versioned success/error payloads preserve exact puzzle/ruleset/slot identity and expose `sourceReadAt` / live-vs-cached metadata without implementing caching. Scope: `tasks/plans/daily-nine-comparison-api-contract.md`.
14. Complete: server-side comparison read composition (PR #200). Date/ruleset/pitch validation, authoritative puzzle binding, server-derived puzzle ID/number, Daily/Supabase composition, and conservative live freshness are implemented without public exposure. Scope: `tasks/plans/daily-nine-comparison-server-read.md`.
15. Complete: thin default-off Next.js GET adapters (PR #202). At-bat/completed routes remain separate, HTTP errors are sanitized, all responses use `private, no-store`, and server-only `DAILY_NINE_COMPARISON_READS_ENABLED=true` is required; the deployment flag remains off. Scope: `tasks/plans/daily-nine-comparison-read-api.md`.
16. Complete on PR #203: representative isolated performance evidence. Current raw reads stay; no cache/rollup/index optimization is justified at the 10,000-result checkpoint. Harness/evidence: `tasks/plans/daily-nine-comparison-performance-evidence.md` and `docs/engineering/daily-nine-comparison-performance-2026-09-19.md`.
17. Next: explicit default-off comparison activation decision. Preserve immediate own-result rendering; comparison remains asynchronous and failure-isolated.
18. Reveal/final-scorecard UI: asynchronous YOU / AVG after every AB, low samples/outages, final refresh, stale-response protection, mobile and answer-integrity verification; measure real end-to-end comparison latency after a browser consumer exists.

Each PR starts from updated main, writes its own scope contract, updates canonical docs, and gets one bounded review plus applicable CI/preview verification. Do not batch all eight concerns into one implementation diff. Production migrations and activation require source/hosted reconciliation; no feature is called live based solely on passing unit tests.

## Acceptance matrix across the sequence

- Same normalized observation twice: one row. Different facts at same identity: conflict.
- AB delivery out of order and independent completion delivery: correct independent counts.
- Save succeeds/read fails: no subsequent write retry caused only by comparison failure.
- Network timeout after commit, refresh, offline recovery: exact payload retried.
- Reset after unsent AB, stale tab resolution, simultaneous initialization and takeover: no mixed contributing runs.
- Old active/completed/compatibility saves and old pending completion: no fabricated AB history or altered immutable payload.
- Puzzle/ruleset separation, Classic preservation, null empty populations, tied scores, sample thresholds.
- Slow/down comparison path: no blocked resolve, Next At Bat, completion or sharing; no premature answer exposure.
