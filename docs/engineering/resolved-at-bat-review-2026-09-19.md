# Resolved-at-bat architecture and code review

Reviewed baseline: `a91edc078cd312478402026247d48ea19804709d` (PR #188).
Date: 2026-09-19. Status: review findings; fixes have not been implemented.

## Scope contract

Goal: assess 6A–6D and surrounding completed-result/AB contracts before comparison implementation.
Owner: engineering documentation. In scope: source inspection, isolated diagnostic experiments, findings, and handoff reconciliation. Out of scope: runtime fixes, schema/production changes, comparison implementation, merging held PRs. Acceptance: evidence tied to baseline functions; distinguish confirmed failures from conditional risks and intentional tradeoffs; preserve one concern per proposed PR. Stop before implementing fixes or changing product authority.

## Judgment

Keep the architecture. Shared contracts → engine normalization/scoring → Daily idempotency ports → web/provider adapters is a useful, correctly directed separation. Independent AB and completion populations are the right model. The browser composition has correctness gaps that normal-path production proof and helper-level tests do not cover. Address findings R1–R3 before comparison implementation. R4 belongs at the same ownership boundary but has a conditional re-bootstrap trigger; resolve it before extending that hook.

This review does not invalidate the recorded successful production proof or claim production data was corrupted. It establishes counterexamples in the source, not their production incidence. No live production requests, database mutations, deployment or new infrastructure were used for the experiments.

## Must fix before comparison implementation

### R1 — Retired ownership can continue delivery under the next generation (high)

Files/functions:
- `apps/web/app/dailyAtBatResultClient.ts`: `retryPending`, `deliverObservation`, `deliver` (baseline lines 51–95, 116–153).
- `apps/web/app/useDailyGameplayPersistence.ts`: owner-acquisition retry and effect cleanup (120–154).
- `apps/web/app/dailyAtBatAttemptJournal.ts`: `updateDelivery` (134–155).

`retryPending` captures slot numbers, but not a fixed ownership capability. After each await it calls `deliverObservation`, which reads and adopts whatever generation is currently in storage. Cleanup stops the coordinator but does not cancel/dispose the delivery client or its loop. The hook's `cancelled` check runs only after the whole retry promise, after the client has already mutated the journal.

Counterexample: A retries two pending slots at generation 1. While slot 1 is awaiting HTTP, A releases ownership and B claims generation 2. A's first response returns `stale`, as expected. A nevertheless starts slot 2, adopts generation 2, and can mark it `submitted` despite no longer owning the lock. A deterministic test returned `['stale', 'submitted']` and recorded both requests from A.

This is more than redundant HTTP. Acknowledgments rewrite the entire journal via read/modify/write. Once A and B can both write generation 2, A can read the journal, B append slot 3, then A write its older snapshot and erase slot 3. An injected storage interleaving reproduced that lost append. This models independent documents interleaving storage operations; it is not a measured browser scheduling frequency. Generation checks alone cannot make cross-tab read/modify/write atomic; the [HTML storage specification](https://html.spec.whatwg.org/multipage/webstorage.html#introduction) explicitly advises authors not to assume locking across agent clusters.

Fix direction: bind delivery to the exact owner lifetime, attempt and generation; invalidate synchronously before releasing the lock; stop retry iteration and local acknowledgment writes after invalidation. All journal mutations, including delivery bookkeeping, must occur under valid ownership. An old HTTP request may finish on the server; its local callback must be inert, leaving exact retry to the new owner. Preserve retired journals' pending retry while a legitimate current owner holds authority. Do not add leases or forced stealing.

Required regression: queued retry loses ownership after its first await; old success/error/finally cannot write or start another slot; interleaved current-owner append survives; reset still preserves immutable pending facts.

### R2 — Reset fences hint restoration but not gameplay resolution (high)

Repair status: implemented across PR #192 plus the bounded R2 boundary-completion follow-up. The request controller provides synchronous single-flight and identity-checked success/error/settled callbacks. Reset and durable restore invalidate directly; persistence-session teardown invalidates the controller before coordinator release, and an owner-to-non-owner access transition also invalidates synchronously. This closes the original relevant-identity/ownership-loss requirement without moving scoring or persistence authority into the controller.

File: `apps/web/app/components/DailyInningGame.tsx`: `handleSubmit`, `handleGiveUp`, `handleResetToday`, `resetToInitialState`, `requestJson` (229–276, 316–334, 422–447).

Reset increments `restoreGenerationRef`, but only `fetchHintBundle` callbacks check it. The Reset button remains enabled during a pending Guess/Give Up. A response from the prior run still updates the progression token, hint bundle, reveal and `pendingAdvance` using its captured old game/pitch. Its `finally` can also clear a newer request's pending state.

Counterexample: start Give Up, Reset before its response, then release the old response. A deterministic scheduler invoking the real component's handlers showed the fresh run's empty result replaced by the old strikeout/reveal. Reset before any frozen observation retains the attempt, so the stale terminal result can become its first frozen observation. Later-pitch responses can restore an old prefix into a reset run even when analytics has retired.

Fix direction: one explicit gameplay request epoch/current-request identity, invalidated on reset, restore, relevant identity change and ownership loss. Guard success, errors and cleanup, plus use a synchronous in-flight guard. Abort can reduce work but is not the correctness mechanism. Keep this request controller web-owned; engine rules need no change.

Required regression: delayed Guess/Give Up success and failure after reset; a new request stays pending when the old one settles; no stale fact/token is saved or frozen; cover both Daily and Classic because they share this component.

### R3 — Journal failure releases the lock but enables shared writers (high)

Repair status: implemented in the bounded R3 persistence-authorization follow-up. Journal/generation failure after lock acquisition no longer releases exclusivity: the coordinator publishes a degraded owner that may persist gameplay but cannot contribute resolved-AB data. Recovery is recognized only on a later ownership acquisition. Durable reload failure retains the acquired lock in a non-writable blocked state, and unexpected lock-request failure is non-writable. The hook's writable set is explicit: owner or the pre-existing missing-capability compatibility path only. Deterministic tests cover corrupt-journal two-tab exclusion, generation-write recovery, reload-failure takeover, degraded completion eligibility, and access write policy. R4 remains separate because stale React effect-render authority can still outlive coordinator teardown during re-bootstrap.

Files/functions:
- `dailyAtBatOwnershipCoordinator.ts`: `runAsOwner`, `claimExistingGeneration` (113–148, 182–201).
- `useDailyGameplayPersistence.ts`: unsupported branch and non-owner save branch (133–142, 168–176).

If an existing journal is invalid or its generation write fails, the coordinator emits `unsupported` and returns from the lock callback. The hook treats every unsupported reason as compatibility mode and permits ordinary shared gameplay saves and completion creation. A second supported tab can now acquire the same lock; a persistently invalid journal makes both tabs interactive without ownership, while a transient failure can leave one uncoordinated writer beside a genuine owner. Completion creation can also race when the record is missing.

A diagnostic verified that `journal_unavailable` leaves the exclusive lock released. The hook's writable fallback is directly visible in source. Existing tests assert that state is `unsupported` and label this “fails closed,” but do not test shared save exclusion.

Fix direction: distinguish absent browser capabilities from a journal/contribution failure after acquiring a functioning lock. Retain exclusive gameplay ownership when only analytics eligibility failed; disable contribution without making shared persistence multi-writer. If no lock can be held, define an explicit safe fallback rather than equating every error with permission to write. Do not silently change Classic's intentionally uncoordinated compatibility model.

Required regression: two tabs with corrupt journal; generation `setItem` failure followed by recovery; reload failure; assert at most one shared gameplay writer and no duplicate completion creation through degradation.

## Should fix soon

### R4 — A dependency-change render can persist after releasing ownership

Repair status: implemented in the bounded R4 re-bootstrap-authority follow-up. Persistence setup now depends on a semantic puzzle/date/number/ruleset key rather than the whole puzzle object or bootstrap token, so equivalent props do not churn ownership. A real session change resets readiness; save and reset require the render's access/session/readiness to match the live refs exactly. The hook no longer rewrites the live access ref from every render, and a nominal owner with missing identity/client refs fails closed rather than saving outside the coordinated path. Focused deterministic regressions cover the original stale-owner predicate, semantic identity stability, exact current-session matching, and compatibility readiness. The repository still has no mounted React DOM test environment; adding jsdom/Testing Library/react-test-renderer would cross the explicit new-dependency decomposition trigger, so this PR does not pretend to provide the requested mounted StrictMode harness. Preview/production browser verification is the integration evidence for this bounded repair.

File: `useDailyGameplayPersistence.ts`, setup/cleanup effect (71–166) and persistence effect (168–224).

The first effect depends on the entire `puzzle` object and the bootstrap token. If either changes on a mounted owner, cleanup releases the old lock and setup synchronously changes access refs to follower. The persistence effect from that same render still sees the captured React `access === 'owner'` and `hasLoadedSavedState === true`; it does not check the current authority ref. It can save while the new coordinator is queued. On identity change, the new outer puzzle metadata can be combined with the previous game's state.

A deterministic effect scheduler reproduced a gameplay write with both old/new coordinators holding no lock after supplying an equivalent new puzzle object. This is a conditional prop re-bootstrap path, not a claim that the current plain-anchor mode navigation necessarily triggers it. React runs cleanup/setup on changed effect dependencies; see [React's effect contract](https://react.dev/reference/react/useEffect).

Use stable semantic session identity and a current ownership/readiness capability at the write boundary. Reset hydration readiness per identity. Add a mounted React rerender/StrictMode test before extending this hook. This can fit R3's ownership-authorization PR if kept bounded; otherwise split it.

### R5 — Pending delivery recovery is much narrower than “retryable” suggests

Files: `dailyAtBatResultClient.ts:retryPending`; `dailyAtBatGameplayCommit.ts:persistGameplayThenFreezeDailyAtBats`; `useDailyGameplayPersistence.ts` retry/commit effects.

Transient failures retain exact payloads correctly. Automatic retry happens on owner acquisition. Later autosaves return `existing` for a frozen pending slot and only newly `created` slots enter the delivery list. There is no online-event trigger, bounded retry scheduler or request deadline. A slot that gets 503 may remain pending for the whole open session even after later slots succeed. Sequential hydration retry also stops progressing behind a never-settling first request.

Choose/document a bounded owner-scoped delivery opportunity and timeout policy, separate from comparison-read retry. Fix R1 first. No tight timers, background service or daily-history scan is needed. Same-puzzle refresh/takeover retry already works; pending results from an old day are not globally drained.

### R6 — Malformed gameplay saves can throw instead of degrading safely

Repair status: implemented in the bounded malformed-save decoding follow-up. Browser-local persistence now has an explicit missing/unreadable/unusable/loaded boundary; compatibility decode/normalization is isolated from storage I/O, validates the nested structures it dereferences, and has deterministic regressions for the original `shareResult` failure plus other malformed nested values. No save is auto-deleted or reconstructed.

File: `dailyLocalStorage.ts:loadSavedDailyGameWithProvenance`, `isSavedDailyGameForPuzzle`, `normalizeSavedDailyGame`, `normalizeShareResult`; initial read in `useDailyGameplayPersistence.ts` occurs before coordinator error handling.

The envelope guard does not validate nested values used by normalization. For example, remove `gameState.shareResult` from an otherwise valid saved game: the guard accepts it, then normalization dereferences `undefined.pitchLines` and throws. A diagnostic reproduced the TypeError. Other unchecked nested arrays have similar risk. This is pre-existing surrounding persistence debt, not newly introduced server validation weakness.

Implemented direction: malformed or incompatible parsed values return an explicit unusable state without throwing; storage-access/JSON failures remain unreadable and absence remains missing. Compatibility migration/normalization now lives behind `dailySavedGameCodec.ts` instead of expanding the storage adapter. Existing nullable callers preserve behavior, and no AB observations are reconstructed.

### R7 — Browser responsibilities remain too concentrated for comparison UI

`DailyInningGame.tsx` is 475 lines, combining view decisions, many coordinated state setters, resolution transport, reset and hint hydration. `useDailyGameplayPersistence.ts` is 316 lines and coordinates locks, eligibility, saves, freezes, delivery, completion creation and degradation using both refs and state. Neither violates the 500-line limit, but the defects above demonstrate the cost of implicit lifecycle ownership.

Extract the gameplay request lifetime as part of R2. Make the ownership capability explicit as part of R1/R3. Add comparison reads in a separate identity-keyed hook/client and small presentation components. Do not append comparison fetch/cache/retry state to either existing module. Do not introduce a generic repository/outbox framework to deduplicate small codecs or HTTP status switches. Semantic fact equality is repeated across lifecycle/journal/services; a narrow shared equality helper is reasonable only with a focused consumer-driven change, not a rewrite prerequisite.

### R8 — Anonymous write admission and observability need a bounded follow-up

Files: `api/daily/at-bats/route.ts`, `api/daily/results/route.ts`, both submission services, and both result HTTP mappers.

Routes parse JSON before an application-level byte limit and preflight only routing fields before authoritative puzzle materialization. No application-level rate admission is present in these routes. Platform limits may exist; they were not audited here. A caller can generate unlimited syntactically valid anonymous IDs and internally consistent results. This is the documented anonymous authority model, not a regression or a reason to bolt on signed receipts. Separate request-cost/abuse limits from honest-play claims before wider public exposure.

HTTP error mappers deliberately sanitize responses, but catch exceptions without recording a structured diagnostic. Consequently a clean runtime-error scan alone cannot prove no internally handled storage/route failures happened. Add safe status/category/count observability without logging answer data, full request bodies or credentials. Do not expose individual result rows for comparison recovery.

## Acceptable tradeoffs and decisions to preserve

- **Undercount over reconstruction:** save-success/freeze-crash retires on reload; no inferred historical ABs. Two localStorage records are not a transaction, and the declared one-way durability guarantee is appropriate.
- **Attempt ID is not a person ID:** no universal exactly-once person counting after storage loss, separate profiles or devices. Classic/completion-only paths have no cross-tab creation lock; that limitation must not be generalized into a guarantee across both games.
- **Completion is independent:** fresh compatible creation prefers the active AB ID; any existing completion record wins unchanged. No database join/foreign-key requirement should force nine AB rows before storing a completion. A matching string does not certify matching populations or honest play.
- **Final-reveal completion loss is conservative but visible:** `useCompletedDailyResultSubmission` creates only when `gameState.status === 'completed'`, which the component reaches on View Results. Refresh on the ninth terminal reveal makes `canCreateCompletedResultFromLoadedSave` return false, so later View Results cannot create a missing completion. All nine ABs may exist with no completion. This follows the current restored-completed-save rule, not the save/freeze race fix. Decide explicitly whether to refine fresh-journal completion recovery later; never blanket-backfill old saves.
- **No immediate self-inclusion or cross-population atomic snapshot:** comparison delivery acknowledgment and read freshness are separate. A failed read must not cause a new write identity or resend an acknowledged fact.
- **Background ownership:** a live background owner intentionally retains its lock; do not implement a timeout steal. Freeze/back-forward-cache/resume behavior has no explicit lifecycle policy or test in the coordinator. Treat this as an outstanding device/liveness check, not proven corruption. [Chrome lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) explains suspended tasks and recommends releasing held locks before freezing; reconciling that with this product's ownership policy is a separate explicit decision.
- **Performance:** at most nine observations per puzzle keeps journal size bounded per day, but typing changes `atBatState`, causing full gameplay serialization and repeated prior-fact checks on the main thread. Measure mobile input latency before optimizing. Storage records across days have no pruning policy. Neither requires a new database or cache now.

## What is well designed

1. `normalizeDailyTerminalAtBat` is shared by both engine validators. It whitelists/copies facts, checks consistency against authoritative puzzle context and reuses gameplay rules. SQL/codecs do not duplicate scoring.
2. Both Daily repository ports expose atomic `insertIfAbsent`. Providers insert first, read the winner only after unique conflict, and never upsert. AB identity excludes schema version, preventing schema upgrades from silently widening observation uniqueness.
3. Server-only adapters and migrations keep service credentials out of clients. AB RLS/no policies and revoked browser grants plus service-role SELECT/INSERT are appropriate. This review inspected source migrations, not current hosted privilege state.
4. Exact frozen browser payloads, existing-completion precedence, reset preservation and fail-closed mismatch reconciliation are useful invariants. Repair their authority integration rather than replacing them.
5. `/api/daily/resolve` does not await analytics writes or reads. The save → freeze ordering helper is small and testable. Completion creation is correctly called only after successful save/freeze in the ordinary owner path.
6. Daily/Classic populations and browser save namespaces are separated. The server currently intentionally uses one public lineup loader for both; a later separate-lineup product decision must supply a game-aware loader without changing result identity contracts.

## Comparison design and bounded PR sequence

Preserve the approved direction, with browser correctness prerequisites:

1. **Web delivery ownership:** R1, owner-lifetime fencing of outbox delivery/acknowledgment, focused interleaving tests. No schema, scoring, UI or comparison work.
2. **Web gameplay request lifetime:** R2, stale resolution/reset/restore fencing and request guard. No outbox format change.
3. **Web persistence authorization:** R3 and R4 are implemented. Contribution failure under a held lock does not relinquish shared-write authority; re-bootstrap cannot write unless rendered and live session/access/readiness agree. Keep later comparison state out of this hook.
4. **Portable comparison contracts/service — implemented:** the Daily read port is separate from write repositories and from each population. Per-slot reads return count + stored engine-derived point sum; completed-game reads return score buckets normalized to count + bounded 0–63 histogram. Empty averages are null; strict-lower ties are explicit; no count equality/monotonicity assumption exists. No provider or React.
5. **Supabase comparison provider:** aggregate stored engine-derived points in SQL; do not download/rescore raw populations. Keep privilege checks, additive migrations, read correctness and disposable fixture proof in this concern. Exact AVG still scans matching rows. Existing completed-result index leads with date, so include exact date or evaluate a matching index through EXPLAIN rather than assuming puzzle/ruleset alone is selective.
6. **Read-only API and recovery contract:** bounded identifier validation, deliberate unavailable/empty/freshness responses, no write side effects. Include freshness semantics in step 4's contract; expose them here. Prefer the separate read path first instead of enlarging POSTs. Client requests/results must be keyed to puzzle/ruleset/slot; never reveal answers or raw participant rows.
7. **Representative isolated performance evidence:** 100/1,000/10,000 observations per slot, unrelated rows, concurrent inserts/reads, warm/cold behavior, p50/p95, query plans/buffers and round trips. Establish acceptance budgets before measuring. Do not infer capacity from a covering index. Cache/rollup decisions require a separate measured justification.
8. **Async terminal-AB YOU / AVG:** dedicated read client/hook, read-only retry, low-sample/outage states, stale-response fencing and current-terminal-slot gating. Next At Bat remains immediate. Resolve R5's delivery recovery policy before UI claims about acknowledged/self-included data.
9. **Final completed-game comparison:** separate completed histogram/count, available per-slot snapshots and current read refresh on restoration. Ties are not beaten; no joined-population assumption. Preserve Classic isolation.

R6 and R8 are separate follow-ups; do not bundle them into comparison or a generic hardening PR. R7's extractions should accompany the behavior they clarify. PRs #161/#174 are closed as superseded references and must not be revived unchanged.

## Verification and documentation limits

- Read current main in required order, inspected merge sequence #182–#188, full browser lifecycle modules, completion stack, engine normalization, Daily ports, server adapters/routes, migrations, relevant plans and tests. Open PR search still found held #161/#174.
- Built local shared/engine/baseball-data/Daily TypeScript outputs to resolve test imports; no production bundle or full data pipeline was needed for this review.
- **227 existing focused tests passed:** 101 web browser/service/provider tests, 93 engine validator tests, 33 Daily idempotency tests.
- **Six additional diagnostic counterexamples passed:** stale retry adoption; injected lost journal append; lock release on journal failure; late gameplay resolution after reset; save after re-bootstrap cleanup; malformed-save TypeError. The first, second, third and sixth exercise real non-React modules. Reset/effect cases use the real component/hook with a minimal deterministic hook scheduler, not mounted React or physical-browser execution. The malformed-save counterexample is now a deterministic regression in the R6 owning fix; mounted React coverage remains relevant only to the effect/request-lifecycle cases where a DOM-capable harness is actually required.
- Diagnostic tests asserted existing bad behavior and were not added to the regression suite. No new browser/mobile/production proof was performed. Existing server/provider mocks are not a new hosted atomicity/performance test.
- Documentation drift: lifecycle plan header still said physical proof pending; START-HERE and architecture called the whole lifecycle fully browser-proven. Preserve successful scenarios as evidence, qualify the broader claim and link these unresolved findings. The manual still calls the product one Daily Inning while canonical product docs describe two competing beta games; reconcile that vocabulary separately.

Review completion means evidence and next work are recorded. R1–R4 and R6 now have bounded repairs; R5, R7, R8 and the remaining interactive/mobile verification are still open.
