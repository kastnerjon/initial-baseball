# Initial Baseball Current Work

Status: Active ordered implementation plan  
Last updated: 2026-09-23

Completed history belongs in PRs, canonical docs, or `tasks/lessons.md`. Durable resumption context belongs in `docs/START-HERE.md`.

Current order: the routine conversational future-lineup path and completed-result 4A/4B/4C stack are operationally complete, including live production idempotency proof. Daily Nine comparison now has portable validation, repository/service, hosted Supabase provider and an authoritative server submission API. Browser 6A–6D is implemented with successful normal-path production proof and R1–R6 repairs. The portable Daily Nine comparison read contract/service and PR #198 Supabase aggregate provider are implemented and hosted-verified; PR #199 implements the shared versioned comparison HTTP response contract; PR #200 implements server-side comparison read composition. PR #202 implements the thin GET adapters, sanitized HTTP mapping and `private, no-store`. PR #203's representative disposable PostgreSQL 17 benchmark supports the current raw-read design through the 10,000-result checkpoint (AB p95 1.807 ms; completed p95 6.254 ms), so no cache/rollup/index change is justified now. PR #204 is merged and production-verified: the read APIs are default-on behind the server-only fail-closed `DAILY_NINE_COMPARISON_READS_DISABLED` switch, exact production deployment `dpl_F87hcE51cQT6zhoCp8MgGKwCSX38` is READY on merge `178e58cb6fcb8f09ad9ebc3e6ba69cca7a725a01`, both routes returned versioned HTTP 200 live payloads with `private, no-store`, and the comparison-route runtime scan was clean. The read repository remains storage-strategy-neutral for a later provider-only rollup if measured scale requires it. Resolved-AB collection and comparison GET APIs are live. PR #206 adds the browser comparison transport/decoder: schema-1 runtime decoding, exact response-identity checks, caller-owned AbortSignal propagation, and explicit browser `no-store`. PR #207 adds the separate request-lifecycle controller with independent at-bat/completed channels, same-channel replacement, generation/request fencing, abort on replacement/invalidation, whole-session invalidation, and stale success/error/settled suppression. Terminal Daily Nine at-bats and completed games now consume the browser read seam through separate identity-keyed hooks: AB YOU / AVG remains independent from gameplay/Next, while completed comparison starts from the final engine transition, survives View Results on unchanged identity, refreshes on restored completions, and shows strict-lower BEAT only at 20+ completed results. R5 bounded pending-delivery recovery and R6 malformed-save decoding are repaired in separate web-persistence follow-ups. The verified runtime baseline is PR #212 merge `4bb66d5bb93051dfb88559cfc58a524e06824f4a`: push CI #782 succeeded and production deployment `dpl_6rCfeRkUngD48ftT1FM8UgzjtCoZ` is READY on that exact SHA. R7 is structurally complete in bounded browser-architecture checkpoints: R7A extracted persistence owner-session mechanics without splitting React persistence authority; R7B extracted saved-game restore plus authorized-hint hydration/stale-response fencing; R7C extracts Daily resolution transport/single-flight/pending-state lifecycle and fixes pending UI cleanup on authority invalidation. `DailyInningGame` remains the gameplay state/render/action coordinator; no generic state-machine rewrite is justified. R8A bounded body admission is implemented and production-verified. R8B architecture is settled as a Vercel WAF rule with no app dependency; log-only publication, traffic review, Preview 429 proof, and production enforcement remain operational steps. R8C adds sanitized low-cardinality diagnostics only for caught internal 503/500 result-write failures; public responses stay unchanged and ordinary 2xx/4xx traffic stays silent. PR #221's comparison `Server-Timing` seam is production-verified. A 20+20 production handler sample shows fast medians (65 ms AB / 58 ms completed) but material long-tail variance (nearest-rank p95 582 / 430 ms; maxima 1,626 / 1,525 ms). Do not optimize storage from this: PR #203 still shows the raw database aggregates are fast. PR #223 stage timing is production-verified. A 15+15 sample localizes the extreme tail to the provider boundary: one completed read was 2,502 ms total / 2,495 ms provider, while puzzle loading was only 7 ms. Hosted `pg_stat_statements` shows the matching PostgREST database statements remain low-millisecond (completed mean 1.921 ms / max 19.696 ms; AB mean 1.594 ms / max 17.332 ms). Do not change SQL/indexes/rollups/puzzle loading from this evidence. PR #225 provider sub-timing is production-evidenced and PR #226 records the 15-per-route decision checkpoint: setup/decode are negligible, while the multi-second provider tail tracks awaited `client.rpc(...)` (at-bat 1,495 ms max; completed 2,125 ms max). Matching hosted PostgreSQL execution remains low-millisecond, so SQL/index/rollup/cache changes are not justified. Hidden active-AB prefetch is now implemented at the web consumer: after saved-game hydration, the exact points-v3 slot read begins during play, stays undisclosed until terminal reveal, and terminal own-point projection does not restart the request. This reduces the live self-inclusion race but does not claim atomic exclusion if a slow read is still in flight when the independent result write lands. Next complete browser/mobile trigger-to-visible and failure/stale-request verification, then shift comparison work to UI/UX presentation. PRs #161/#174 are closed as superseded references. Remaining authenticated-editor slot QA, timed public editorial rollover/fallback checks, and physical iPhone/iPad QA stay open but do not block the results pipeline. Permanent archive/local history remain subsequent concerns. Current beta numbering is disposable; broad launch later restarts at Daily #1 after the owner chooses the surviving game/final rules.

## September 19 review prerequisites

Review: `docs/engineering/resolved-at-bat-review-2026-09-19.md`. R1–R6 are repaired in bounded runtime follow-ups.

- [x] R1: fence outbox sends and acknowledgment mutations to the exact owner lifetime; owner delivery is bound to one disposable attempt/generation session, invalidated before lock release, with takeover/late-response regressions.
- [x] R2: fence gameplay Guess/Give Up success, error and finally callbacks across Reset/restore, persistence-session teardown and owner loss with a synchronous single-flight request generation; stale cleanup cannot clear a newer pending request, and the shared Daily/Classic request path is preserved.
- [x] R3: keep shared gameplay writes exclusive when journal/generation handling fails; a held-lock journal failure yields one non-contributing owner, reload/lock-request failure is non-writable, and only explicit missing-capability cases retain compatibility persistence.
- [x] R4: guard persistence against stale effect-render authority during re-bootstrap with stable semantic session identity, per-session hydration readiness, and live authority checks at save/reset.
- [ ] A mounted React rerender/StrictMode harness is still absent because the repo has no DOM-capable test dependency and adding one crosses the explicit dependency decomposition trigger. R4 instead has deterministic stale-render/session-authority regressions; reconsider dedicated test infrastructure only as its own bounded concern if future hook work needs it.
- [x] Repair bounded pending-delivery recovery (R5): each resolved-AB POST has a five-second deadline; owner acquisition retries pending rows; each newly frozen terminal AB also sweeps older pending slots while excluding the just-created slots; no periodic timer, online listener, or old-day drain is added.
- [x] Repair malformed-save decoding (R6): persisted-state decoding is isolated from storage I/O, malformed nested state degrades to unusable without throwing, and missing/unreadable/unusable/loaded remain distinct.
- [x] R7A: extract mutable persistence owner-session mechanics into one concrete web controller while keeping `useDailyGameplayPersistence` as the sole React authority for restore → save → freeze → async delivery ordering.
- [x] R7B: extract saved-game restore plus authorized-hint hydration/stale-response fencing from `DailyInningGame` into a concrete web-only controller with deterministic tests.
- [x] R7C: extract Daily resolve transport/single-flight/pending-state lifecycle behind a concrete web client/hook; authority invalidation now clears pending UI immediately while late callbacks remain fenced. R7 is structurally complete; do not pursue a generic state-machine rewrite for line-count alone.
- [x] R8A: bound actual request-body bytes before JSON parsing on both anonymous result-write routes; oversized bodies return terminal HTTP 413 without reaching server composition.
- [ ] R8B: publish and verify the documented Vercel WAF rate-limit rollout for only the two anonymous result-write POST routes. Design is settled: IP bucket, fixed window, provisional 300 requests/10 minutes, log-only first, then Preview/production 429 only after traffic review; no app dependency.
- [x] R8C: emit one sanitized JSON diagnostic only for caught internal 503/500 result-write failures, with route/category/status and no raw exception, payload, answers, credentials, IP/UA, or result IDs; ordinary success/validation/409/413 paths remain silent.

## September 15–16 approved product work

- [x] Implement private initials/answer/outcome scorecard with additive local answer retention and separate spoiler-safe Copy share card (PR #140).
- [x] Define and implement classic-inning-v1 in portable rules, preserving existing policies (PR #141).
- [x] Merge PR #155: typed new-session bootstrap selection, signed Classic game identity, engine-owned three-out/nine-batter completion, and no successor hint bundle after completion.
- [x] Merge PR #156: activate `/classic` with navigation, isolated saves, compatible default keys, game-aware refresh/reset/results/sharing, and hidden unplayed answers; exact production deployment is READY and both public routes return the same Daily puzzle with their correct signed ruleset identities.
- [ ] Verify both games interactively through terminal/complete refresh, clipboard success/failure, answer safety and responsive layouts; retain physical-device QA as distinct.
- [x] Settle beta/launch direction: Daily Nine and Classic are distinct beta games sharing a lineup today; either may ultimately be removed or separated, and infrastructure must not require both forever.
- [x] Hide Classic from the normal product UI behind the server-only `CLASSIC_INNING_ENABLED` web availability setting, default OFF: no mode toggle while off and `/classic` redirects to `/`; preserve Classic rules, storage, results, comparison infrastructure, and data for one-setting restoration.
- [x] Settle permanent-history direction: current numbering is beta; broad launch explicitly restarts at Daily #1 and only post-launch Dailies enter the permanent archive.
- [x] Settle comparison direction: result populations are stable-puzzle + ruleset/game specific; Daily Nine gets per-AB/whole-game comparison, while Classic gets separate baseball-native comparison.
- [x] Daily Nine result presentation is points-native: terminal AB result shows `N PTS` rather than baseball outcome; in-app and share scorecards use the same initials / SCORE / AVG scoring rows, with the in-app table additionally showing already-persisted revealed player names while copied share output remains spoiler-safe; withheld AVG renders `—`; completed private/share header is `X PTS • AVG Y.Y` when displayable and `X PTS` otherwise. Existing 0–1 AVG withholding and 20+ BEAT threshold remain; refresh/restore recomputes personal AB points from persisted completed-at-bat facts through the engine rule; Classic remains baseball-native; mobile private rows stay single-line. Scope: `tasks/plans/daily-nine-scorecard-average.md`.
- [x] Prefetch each per-AB AVG read once the points-v3 AB is hydrated and active, but keep the value undisclosed until terminal reveal; terminal own points project the existing read without restarting it. This usually moves the read before the current result write but does not add an atomic self-exclusion guarantee. A separately restored terminal state may refresh the current aggregate. Comparison remains off gameplay's critical path.
- [x] Settle initial personal-history direction: archive completion/scores are remembered on the current browser/device; cross-device history waits for accounts.

## 0. Continuity

- [x] Reconcile hosted configuration, scoring, hints, and lineup-content direction in canonical docs.
- [x] Add tested documentation-impact CI and PR checklist.
- [ ] Decide/test a safe branch-ruleset configuration before making the check mandatory; issue #123.

## 1. Production and hosted verification

- [x] September 17 verified production code baseline is PR #163 (`0001f51c15b9e7b4e5e9647ce471365a96f19bc7`) with READY production `dpl_APaPW1hwmzghnoRg4fEXhcFnNCCw` on that exact merge SHA and successful Vercel status; 4A/4B are merged. #162 broadens authorized manual selection without changing automatic generation, and #163 makes public scheduled/published resolution use that editorial candidate universe. At that September 17 checkpoint Supabase had an empty `daily_completed_results` table and draft #161 was not live. #161 is now closed as superseded by the later bounded, production-proven stack. This historical checkpoint does not replace the outstanding interactive/physical-device QA.
- [x] Verify exact merge-SHA production for the public editorial-candidate fix and reconcile hosted handoff: production `dpl_APaPW1hwmzghnoRg4fEXhcFnNCCw` is READY on PR #163 merge SHA `0001f51c15b9e7b4e5e9647ce471365a96f19bc7`.
- [x] Configure progression, Supabase, and admin secrets for Preview/Production.
- [x] Apply editorial migration and verify RLS/service-role boundaries.
- [x] Verify admin challenge and prior successful editor authentication.
- [x] Merge/verify `points-v1` production with `0/45 PTS`, `0/9 AB`, signed ruleset token, hidden-answer QA, full CI/data/build, and no runtime errors.
- [x] Merge PR #126 and verify instant-hint production payload/build boundaries.
- [x] Merge PR #128 and verify production deployment from merge SHA `9ba0a44198799fe71b0520d5245b16b39e056fc2` is READY/canonically aliased.
- [x] Verify the pre-v3 production bootstrap contract (`0/36 PTS`, `0/9 AB`, signed `points-v2` token, one current-batter hint bundle, no answer/reveal/future-batter bundle); retain this as compatibility evidence.
- [x] Verify the current points-v3 production bootstrap (`0/63 PTS`, `0/9 AB`, signed `points-v3` token) and Classic bootstrap (`classic-inning-v1`) on the same public Daily puzzle; hidden-answer build QA passes for both initial payloads and no error/fatal runtime logs were present after PR #156 deployment.
- [x] Merge PR #132 and verify production deployment from merge SHA `a942bab74a68077a1c6ed1aff37b16af45ccc685` is READY/canonically aliased.
- [x] Merge PR #133 and verify production deployment `dpl_AyXpSu9VyQaVUrmANTqJVNQVFf4k` from exact merge SHA `543adf1038f780313870ed3ff30c163648bd86f3` is READY/canonically aliased with hidden-answer build QA passing.

### Public real-browser gameplay

- [x] Add immediate Give Up and Submit Guess pending feedback plus initial resolve timing instrumentation.
- [x] Confirm from production device/log evidence that Submit Guess can still take roughly two seconds even when requests succeed, establishing a real hot-path performance defect rather than an error/retry issue.
- [x] Implement and merge the bounded hot-path optimization: cache the fully materialized server-only puzzle, lazy-load lineup/Supabase composition on cache miss, separate search initialization from resolution, avoid full canonical-index loading for ordinary canonical guesses, and use direct reveal-shard access for terminal resolution.
- [x] Keep resolve `Server-Timing` as the handler-level diagnostic and use it with phone end-to-end timing to separate remaining platform/network overhead from server work.
- [x] Merge/deploy the original heritage baseline as PR #135, production `dpl_32hGx8N4TKEGKsCaoqHxVbBfVxtf` at `d2de746664e7d154294f54dc9ae4b1d55f651ad8`; verified September 8.
- [x] Implement and merge the authorized compact scorebook revision as PR #137: readable typography, compact header/status, single current-strike indicator, history after play, quiet secondary controls, continuation before long reveals, and compact Season/Team tables; scope in `tasks/plans/compact-scorebook.md`.
- [x] Fix issue #136 in PR #138: use dense canonical recognizability ranks beginning September 2 while preserving earlier v2 lineups, the 90-day repeat window, published/manual puzzles, and hosting settings; regression coverage includes the 173-of-250 reproduction, cutover compatibility, and continuous generation through October 2027.
- [x] Keep the same deterministic Daily lineup comparator/output while selecting each slot with a linear minimum scan instead of sorting the full eligible band; this preserves the continuity QA horizon without weakening its 30-second timeout.
- [x] Verify production deployment `dpl_8e7N4n8E34rXCgmYj9rJEKBdsKHu` from merge SHA `7c568f3253d62b8fab11becc3e68d94628fa6b0a` is READY/canonically aliased, serves `/` with HTTP 200 and the compact scorebook UI, and has no error/fatal logs on the new deployment at verification time.
- [x] Normalize the Daily desktop surface to the 960px reveal/statistics rail and keep scorecard fields in a compact left-aligned group; scope in `tasks/plans/unified-daily-rail.md`.
- [x] Clarify the points-v3 scorebug with four equal-width metrics ordered At bat, Points possible this AB, Points so far, and Strikeouts; compatibility scorebugs retain their existing metrics.
- [x] Verify on physical iPhone that Daily Nine/Classic navigation is visible, switches cleanly, and the two games maintain independent active saves/hint state.
- [ ] Verify physical iPhone Submit Guess and Give Up end-to-end latency against handler timing after PR #133; CI/browser emulation alone cannot establish a phone latency improvement.
- [ ] Complete compact presentation QA on physical iPhone/iPad: search dropdown/selection, hint and pending states, local reveal-table scrolling, history, terminal completion/share, reset, and no accidental zoom/overflow.
- [ ] Verify resolved `points-v3` outcome plus hint/wrong-guess deductions, banner total/active-at-bat allowance, and awarded-point presentation.
- [ ] Verify saved-session `/api/daily/hints` hydration and refresh recovery in both games, including Classic third-out completion with no unplayed answer exposure.
- [ ] Verify correct guess, wrong guesses, third strike, Give Up responsiveness/reveal, all-nine continuation, final reveal/completion, action responses/logs, and common iPhone/iPad behavior.

### Authenticated editorial workflow

Admin redesign is deferred. The user may supply a future date and nine ordered player names for assisted entry. Resolve ambiguous identities, validate the lineup and use normal revision/lifecycle controls; never bypass published-puzzle immutability. The private conversational bridge is active in production and is the preferred routine entry path; `/admin/daily` remains a supported interface over the same editorial records.

- [x] Merge PR #152: atomic nine-player replacement plus private machine-authenticated server adapter; no direct Supabase editorial writes and no future lineup payloads in public GitHub surfaces.
- [x] Merge PR #153, connect the Supabase app, apply the private `pg_net` transport, store the matching `DAILY_CHATOPS_TOKEN` only in Vercel server environment and Supabase Vault, and redeploy production.
- [x] Smoke-test conversational editing on a future draft: verify atomic rejection for an ineligible candidate, exact nine-player readback/order/revision for the corrected lineup, explicit scheduling, and `chatops:assistant` audit attribution.
- [x] Separate automatic eligibility from manual editorial eligibility: automatic generation remains restricted to ranked `dailyEligiblePlayers`, while authorized manual admin/ChatOps curation may select any canonical, reveal-ready Daily-compatible player and receives `outside-automatic-daily-pool` when the player is outside the automatic pool (PR #162).
- [x] Exercise routine owner-supplied future-lineup entry through Dailies #149–#151: exact nine-player order persisted, explicit scheduling reached revision 2 with `chatops:assistant` attribution, and a `pg_net` timeout-after-commit case was safely reconciled by authoritative readback before retry.
- [x] Verify seven-day Supabase horizon and missing-record creation: Dailies #145–#151 are persisted, all seven are public-consumable lifecycle states, and owner-supplied #149–#151 were created/replaced/scheduled through the private ChatOps path.
- [x] Make public scheduled/published resolution use the existing manual editorial candidate universe without changing the automatic pool; add rejection/fallback/order regression coverage.
- [ ] Manual pre-launch QA (non-blocking for feature work): preview/search/replace/revalidate one future slot through the authenticated editor workflow. Current connected tooling can verify the Basic-auth challenge but cannot supply the owner credential interactively.
- [x] Verify public scheduled/published consumption for an editorially scheduled future puzzle. Production Daily #149 consumed the still-`scheduled` revision-2 editorial row; stored canonical IDs recomputed to the exact public fingerprint `83a0294e`. Evidence: `docs/engineering/daily-editorial-public-selection-verification-2026-09-22.md`.
- [x] Verify deterministic fallback for missing/draft records. Live authoritative reads used `daily-2026-08-01` for a hosted draft row and `daily-2026-09-14` for an absent row. Evidence: `docs/engineering/daily-editorial-public-selection-verification-2026-09-22.md`.
- [x] Reconcile issues #97, #91, and #86: #91 was already completed; stale deployment/recovery trackers #97 and #86 were closed September 22 after current Preview/Production and progression behavior were reverified.

### Timed production observation

- [x] Verify midnight-Pacific rollover without a coincident redeploy: production advanced from July 31, 2026 / Daily #96 to August 1, 2026 / Daily #97 while deployment `dpl_Bp2gX76FqxQXpjCgAbMY76nUyqwC` remained current.

## 2. Versioned scoring/completion

- [x] `legacy-inning-v1` compatibility contract.
- [x] `points-v1` compatibility contract: `5/4/3/2/1/0`, 45-point maximum.
- [x] `points-v2` compatibility contract: `4/3/2/1/0.5/0`, 36-point maximum.
- [x] `points-v3` current Daily Nine beta contract: 7 points per at-bat minus verified hints/wrong guesses; third wrong guess or Give Up is 0; 63-point maximum for nine.
- [x] `classic-inning-v1` current Classic beta contract: runner advancement/run scoring, three outs or nine at-bats.
- [x] Native raw at-bat facts independent of final score.
- [x] Ruleset versioning through signed tokens, local persistence, results, and sharing.
- [x] Resolved at-bat display derives and shows awarded points beside the baseball outcome for point rulesets only.
- [x] Add points-v3 engine/web/storage regression coverage and verify production bootstrap.
- [ ] Before broad launch, explicitly choose the surviving game and final launch rules; do not silently treat current beta policy as immutable launch policy.

## 3. Immediate active-batter hints

- [x] Authorized four-hint current-batter bundle with signed later-depth checkpoints.
- [x] First bundle in bootstrap; refreshed same-pitch/next-pitch bundles after resolution.
- [x] Verified-current saved hydration route and local no-network Hint transitions.
- [x] Legacy one-hint route removed from active client path.
- [x] Answer-integrity/product/API/architecture docs amended.
- [x] Focused tests, full CI, preview, P1 review fixes, merge, production payload/build QA, and runtime-error verification.
- [ ] Manual pre-launch QA (non-blocking for feature work): real-browser saved hydration and interaction verification.

## 4. Completed-game results and comparison

### 4A. Portable result contract

- [x] Define schema-1 transport/result types in shared using stable puzzle identity, exact ruleset/game identity, client idempotency ID, and ordered native at-bat facts; initially accept only `points-v3` and `classic-inning-v1`.
- [x] Validate exact puzzle/date/number/game, faced pitch order/initials, completion shape, outcome-to-hint consistency, wrong-guess/resolution consistency, and supported schema/ruleset in the engine.
- [x] Derive Daily Nine points/maximum/strikeouts and Classic baseball summary through existing engine rules; discard submitted totals/extras.
- [x] Preserve copied normalized raw facts for later recalculation without changing anonymous authority or legacy gameplay compatibility.
- [x] Cover valid, malformed, spoofed, inconsistent, incomplete, overlong/after-completion, game-isolation, and normalization behavior with focused engine tests.

### 4B. Portable repository/service

- [x] Define `DailyCompletedResultRepository` and `createDailyCompletedResultService` in the portable Daily layer; scope: `tasks/plans/completed-result-repository.md`.
- [x] Make `insertIfAbsent(result)` the atomic first-write-wins repository primitive keyed by `submissionId`; no read-then-save idempotency sequence.
- [x] Same ID/same normalized payload returns the existing record; same ID/different normalized payload returns `idempotency_conflict` without overwrite.
- [x] Compare explicit normalized result fields, including ordered raw facts and derived summary, without JSON-order/object-identity dependence.
- [x] Preserve the complete normalized result/raw facts and cover insert, retry, conflict, cross-game ID reuse, and Classic shorter-fact-list behavior with focused tests.
- [x] Keep Supabase, API, browser persistence/retry, aggregates, comparison UI, and archive/history out of 4B.

### 4C-1. Supabase provider

- [x] Reconcile the already-applied `20260917132147_create_daily_completed_results` migration into source control rather than reusing inactive legacy result tables.
- [x] Add the server-only Supabase row codec/adapter behind `DailyCompletedResultRepository.insertIfAbsent`.
- [x] Preserve insert-first first-write-wins semantics: only a unique-key conflict reads the existing winner; no update/upsert path.
- [x] Keep RLS enabled with no browser policies and harden `service_role` to direct `SELECT, INSERT` only via migration `20260918004822_harden_daily_completed_results_privileges`.
- [x] Pass focused/full CI, preview, advisor verification, merge, and exact production/source reconciliation.

### 4C-2. Completed-result submission API

- [x] Add one public completed-game POST route with private/no-store responses.
- [x] Parse and reject malformed schema/date/ruleset/future routing before authoritative puzzle construction.
- [x] Load the authoritative public puzzle through the existing Daily runtime without minting progression tokens/hint bundles and call engine `validateDailyCompletedResult`; never trust submitted totals.
- [x] Store only the engine-normalized result through 4B/provider and map created/existing/conflict/invalid/provider-unavailable outcomes deliberately.
- [x] Pass focused/full CI, preview, merge, and exact production verification with no browser submission code in the diff.

### 4C-3a. Browser submission client

- [x] Persist the exact immutable schema-1 submission payload, including one stable client-generated ID, before the first completed-result POST.
- [x] Retry the same stored payload after network/408/425/429/5xx failure or refresh; never rebuild retry facts from current replay state.
- [x] Support `allowCreate=false` so an existing pending record may retry without retroactively minting a submission from an old completion.
- [x] Deduplicate concurrent same-puzzle/same-ruleset requests in one tab.
- [x] Compare current stored submission ID before applying an async terminal status so stale responses cannot overwrite a replacement record.
- [x] Keep delivery bookkeeping in its own local namespace, separate from portable gameplay facts and Daily save compatibility.
- [x] Preserve shorter Classic faced-at-bat lists and reject unsupported compatibility rulesets locally.
- [x] Pass final CI/preview and merge.
- [x] Verify browser client + native activation together on exact PR #171 production deployment `dpl_DctrheRJbonPmcszrjAfPuJxvzhy` / merge SHA `ae2fc428b2fad05685b068944acce66b9dddf536`.

### 4C-3b. Native completion activation — complete in production

- [x] Expose hydration-only provenance that distinguishes explicit native completed-at-bat facts from compatibility reconstruction without changing the saved gameplay schema.
- [x] Make creation eligibility explicit and unit-tested: untouched/native active saves may later create; compatibility-fact or already-completed restored saves may not.
- [x] Permit new record creation only for a genuine current-session native `points-v3` or `classic-inning-v1` completion.
- [x] Independently retry an already-persisted pending delivery record after hydration, even when gameplay state itself is not completed.
- [x] Never retroactively create a submission from a pre-feature/compatibility-restored completed save.
- [x] Keep result-delivery identity across Reset today/replay; gameplay reset clears only gameplay state, not the independent delivery record.
- [x] Pass final focused/full CI, documentation-impact, exact-head Vercel preview, merge, and exact production deployment.
- [x] Verify live result collection end to end in production: real-browser Daily #144 / `points-v3` completion created one row; exact same-ID replay returned `existing`; row count remained one.

### 4D. Daily Nine resolved-AB comparison — backend/read path complete; browser verification then UI/UX

Replacement plan: `tasks/plans/resolved-at-bat-comparison.md`. PR #174 is closed as superseded; its equal-population/read-time-rescoring design is historical only. Complete one owning concern per PR.

- [x] Inspect main/#174 and record separate resolved-AB/completed-game populations, after-each-AB v1 UI, strict-lower tie semantics, freshness and delivery acknowledgment separation.
- [x] Portable resolved-AB transport and engine validation/derived points; scope: `tasks/plans/resolved-at-bat-contract.md`. No collection activation.
- [x] Portable immutable repository/service and retry/conflict semantics; scope: `tasks/plans/resolved-at-bat-repository.md`.
- [x] Supabase row adapter/migration, unique observation identity, population index, server-only privileges and isolated same-key atomicity verification; scope: `tasks/plans/resolved-at-bat-supabase-provider.md`. Collection remains inactive.
- [x] Web submission API using authoritative puzzle context, engine normalization/derived points, Daily idempotency and provider persistence; scope: `tasks/plans/resolved-at-bat-submission-api.md`. No browser activation.
- [x] Settle browser lifecycle architecture and decomposition: exclusive Web Lock owner, separate versioned local attempt journal/outbox, owner-only shared save writes, takeover reload, fail-closed contribution fallback, reset/legacy policy; scope: `tasks/plans/resolved-at-bat-browser-lifecycle.md`.
- [x] Browser 6A: durable versioned attempt journal plus immutable exact-payload AB outbox/retry client with generation fencing data, fail-closed codec, retirement and stale-response protection. No Web Locks, React or activation; scope: `tasks/plans/resolved-at-bat-browser-outbox.md`.
- [x] Browser 6B: exclusive cross-tab ownership/takeover coordinator with deterministic puzzle/ruleset lock naming, owner/follower/unsupported state, abortable queued cleanup, existing-journal generation fencing, durable reload before owner readiness and storage-event notification only. Missing journals remain untouched for 6C; no gameplay or network activation. Scope: `tasks/plans/resolved-at-bat-browser-ownership.md`.
- [x] Browser 6C: owner-gated points-v3 gameplay persistence, fresh-run journal-before-save creation, takeover rehydration, durable mismatch retirement without backfill, reset retirement ordering, save-failure fail-closed behavior, passive followers and completed-result creation gating. Classic/older/unsupported compatibility remains intact and resolved-AB POSTs remain off. Scope: `tasks/plans/resolved-at-bat-browser-gameplay-lifecycle.md`.
- [x] Browser 6D implementation: gameplay-save → immutable AB freeze → asynchronous send, owner-hydration retry, local fail-closed delivery handling, and fresh attempt-ID reuse for new points-v3 completed-result records while preserving existing records. Scope: `tasks/plans/resolved-at-bat-browser-6d.md`.
- [x] Browser 6D production deployment proof: PR #185 merge `1965258055eecbf501de82d6f0aed395aea33867` is READY as production deployment `dpl_7Ceu1nwPYZQgUrJaPdsiBQqrLmPa`.
- [x] Browser 6D production AB route/database proof: exact disposable payload returned 201 then 200; one normalized row was read back with one receipt timestamp and then cleaned up.
- [x] Browser 6D post-proof runtime-error scan for resolved-AB/completed-result routes is clean.
- [x] Browser 6D physical/current-browser multi-tab proof: Chrome Incognito on a physical iPhone showed one owner plus passive follower; after batter-1 persistence, closing the owner let the follower rehydrate at batter 2 with the same attempt and no duplicate actor. Runbook/evidence: `docs/operations/resolved-at-bat-browser-proof.md`.
- [x] Browser 6D fresh full-completion identity proof: attempt `6da8d6b7-aedd-457c-82e4-1be0b1e3ac7f` produced exactly nine pitches 1–9 and one completed-result row with the identical `submission_id`; all ten POSTs returned 201 and no route runtime errors were found.
- [x] Browser 6D final browser/device gate: physical iPhone Safari Private restored the same fresh run at batter 2 after refresh; exact current-browser and Safari QA identities were cleaned from Supabase with zero rows remaining. These normal-path scenarios passed; the September 19 review prerequisites are now repaired in R1–R4 follow-ups.
- [x] Implement independent-population portable comparison contract/service: one-slot count/point-sum reads, separate completed score buckets/histogram, null empty averages, strict-lower ties.
- [x] Implement the Supabase aggregate provider (PR #198), hosted and ACL-verified.
- [x] Define the versioned shared comparison HTTP response/freshness contract (PR #199).
- [x] Implement server-side comparison read composition (PR #200).
- [x] Add thin default-off GET adapters with sanitized HTTP mapping (PR #202); keep representative performance/cache and activation work later.
- [x] Measure the current raw-read provider on disposable PostgreSQL 17 at 100 / 1,000 / 10,000 target populations (PR #203). At 10,000, warmed function p95 is 1.807 ms for AB and 6.254 ms for completed buckets; retain raw reads, no rollup/cache/index change, and preserve the repository seam for a later provider-only change if measured scale demands it.
- [x] Activate comparison reads on PR #204 with the code-reviewed default-on path and server-only `DAILY_NINE_COMPARISON_READS_DISABLED` fail-closed emergency switch; exact merge `178e58cb6fcb8f09ad9ebc3e6ba69cca7a725a01` is production-verified READY as `dpl_F87hcE51cQT6zhoCp8MgGKwCSX38`, both routes returned versioned HTTP 200 live payloads with `private, no-store`, and the comparison-route runtime scan was clean. Preserve immediate own-result rendering and keep comparison I/O off gameplay's critical path.
- [x] Add browser comparison transport/decoding on PR #206: separate at-bat/completed GET methods, runtime schema-1 decoding, exact server-response identity checks, caller-owned AbortSignal propagation and explicit browser `no-store`; no React/UI or request-generation lifecycle yet.
- [x] Add the bounded comparison request-lifecycle controller on PR #207: independent at-bat/completed channels, semantic key + generation/request fencing, replacement/invalidation abort, whole-session invalidation, and stale success/error/settled suppression.
- [x] Add asynchronous YOU / AVG after every terminal Daily Nine AB with a separate identity-keyed hook, 0–1 waiting / 2–9 early / 10+ normal sample states, quiet outage handling, restored-terminal reads, and advance/reset/restore stale-read fencing; Next At Bat / View Results never waits.
- [x] Add the separate completed-game comparison: prefetch from the final points-v3 engine transition, keep unchanged requests alive through View Results, refresh current data on restored completions, show whole-game YOU / AVG with settled sample states, and show Daily-owned strict-lower BEAT only at 20+ completed results.
- [x] Add handler-level `Server-Timing` to both Daily Nine comparison GET routes so real browser traces can separate route/server/provider time from browser/network/render time; this is an observability seam, not the latency result.
- [x] Record a 20-sample-per-route production handler distribution from the PR #221 `Server-Timing` seam: AB median 65 ms / nearest-rank p95 582 ms / max 1,626 ms; completed median 58 ms / p95 430 ms / max 1,525 ms. Evidence: `docs/engineering/daily-nine-comparison-server-timing-2026-09-22.md`.
- [x] Add request-local stage-level `Server-Timing` for server composition, authoritative-puzzle loading and the exact comparison repository/provider call; preserve the existing total metric and emit only attempted stages. Scope: `tasks/plans/daily-nine-comparison-stage-timing.md`.
- [x] Re-sample production using the stage metrics: 15 successful reads per route show the observed extreme tail inside the provider boundary, including 2,495 ms provider time on a 2,502 ms completed request; production `pg_stat_statements` keeps matching SQL execution in the low-millisecond range. Evidence: `docs/engineering/daily-nine-comparison-server-timing-2026-09-22.md`.
- [x] Split the provider boundary into request-local `provider-setup`, `provider-rpc`, and `provider-decode` metrics while preserving the parent provider timer and lazy module-level Supabase client reuse. Scope: `tasks/plans/daily-nine-comparison-provider-timing.md`.
- [x] Re-sample production using provider sub-timing (PR #226 evidence checkpoint): 15 successful reads per route show setup/decode negligible and multi-second tails inside awaited `client.rpc(...)`; matching PostgreSQL execution remains low-millisecond. Stop SQL/index/rollup/cache optimization at this beta checkpoint.
- [x] Prefetch the exact hydrated active points-v3 AB comparison while keeping it undisclosed until terminal reveal; terminal own-point projection reuses the same read state rather than restarting the GET.
- [x] Record the #227 post-merge hosted/source checkpoint: exact main/CI/production identity, canonical aliases, live schema-1 comparison HTTP 200 + `private, no-store`, clean exact-deployment error/fatal scan, source/test verification, and an explicit statement of what browser/mobile behavior is still unproven. Evidence: `docs/engineering/daily-nine-comparison-prefetch-verification-2026-09-22.md`.
- [ ] Manual pre-launch QA (non-blocking for feature work): in an ordinary browser, verify active AB → terminal comparison request behavior, trigger-to-visible latency, controlled delayed/failed reads, and stale-response behavior across Next / Reset / restore.
- [ ] Manual pre-launch QA (non-blocking for feature work): physical/mobile interaction and answer/spoiler-integrity check; confirm comparison delay never blocks gameplay actions or result delivery.
- [x] Record the exact PR #209 hosted checkpoint before interactive QA: main/CI/production deployment identity, clean runtime-error scan, successful current-deployment comparison reads, Supabase migration/RPC access posture, exact-main bundle output and hidden-answer QA. This does **not** close either interactive item above. Evidence: `docs/engineering/daily-nine-comparison-hosted-verification-2026-09-20.md`.

### 4E. Classic comparison

- [ ] Add same-Daily/same-ruleset runs, hits, at-bats reached, per-at-bat outcome, strikeout, and reach-rate aggregates.
- [ ] Keep later-batter reach population distinct from all Classic completions.
- [ ] Do not invent a single Classic percentile/ordering metric until explicitly settled.
- [ ] Avoid elaborate Classic-only analytics until beta feedback justifies retaining Classic.

## Feature-development resumption checkpoint

Hosted architecture/storage/comparison/editorial verification is sufficient to resume product work. Do not expand QA scope merely because an interactive/manual check remains open; the explicit manual pre-launch items above stay deferred unless a concrete defect or launch blocker appears. Next implementation track: permanent archive and local history, one bounded PR at a time.

## 5. Permanent archive and local history

September 24 coordinated archive/gameplay decisions and bounded PR order are in `tasks/plans/2026-09-24-archive-and-gameplay-roadmap.md`. Keep current `points-v3` live until versioned negative-score persistence/comparison/browser support is complete. Archive browser save/session isolation is complete; the planned stat, initials, scoring, how-to, and archive route work follows the documented dependencies. No launch epoch, fake permanent row, or beta import is authorized by this roadmap.

- [x] Define stable permanent Daily identity/launch-epoch contract without choosing the launch date yet: portable `permanent-v1` date/number mapping lives in `packages/daily`; no launch-date constant is configured and beta numbering is untouched. Scope: `tasks/plans/permanent-daily-identity.md`.
- [ ] Build archive infrastructure to begin at future permanent Daily #1; do not import current beta history.
- [x] Define explicit portable issuance orchestration: an already-resolved permanent identity plus a same-date scheduled/published editorial lineup freezes exact slots 1-9 through the existing immutable service, without configuring a launch epoch or importing beta numbering. Scope: `tasks/plans/permanent-daily-issuance.md`.
- [x] Complete explicit permanent issuance persistence composition: the server-only web service uses one service-role Supabase client to read the authoritative editorial row for the supplied permanent identity date and freeze it through the existing append-only issued-puzzle repository; no launch epoch/date is configured or inferred. Scope: `tasks/plans/permanent-daily-issuance-supabase-composition.md`.
- [x] Freeze each explicitly issued permanent Daily so later lineup-generation/profile changes cannot change historical answers. Portable snapshot, append-only Supabase provider, portable issuance orchestration, and server composition are complete; no fake permanent rows or beta history are inserted.
- [x] Add provider-neutral read capability for frozen permanent puzzles by permanent series + Daily number or series + date, with null for not-yet-issued rows and fail-closed identity checks. Scope: `tasks/plans/permanent-daily-issued-puzzle-read.md`.
- [x] Implement the permanent-puzzle read port in the existing server-only Supabase adapter using the immutable table's unique number/date keys and strict row codec; no migration or privilege change. Scope: `tasks/plans/permanent-daily-issued-puzzle-supabase-read.md`.
- [x] Compose the permanent-puzzle read service server-side through one service-role Supabase client and the existing provider, preserving portable validation/null semantics and adding no route or launch policy. Scope: `tasks/plans/permanent-daily-issued-puzzle-read-composition.md`.
- [x] Materialize one already-frozen permanent puzzle into the minimum gameplay-ready `DailyPuzzle` shape without rerunning selection: preserve permanent ID/date/number/order, reuse the current canonical-ID Daily player + pitch/hint path, and fail closed on unavailable frozen players. Scope: `tasks/plans/permanent-daily-puzzle-materialization.md`.
- [x] Compose the server permanent-puzzle reader with the materializer into one archive puzzle source: number/date lookup returns the existing gameplay-ready `DailyPuzzle` or null, without adding new validation, persistence, launch policy, or route behavior. Scope: `tasks/plans/permanent-daily-archive-puzzle-source.md`.
- [x] Compose the archive puzzle source with the existing Daily runtime/progression-token machinery: reuse current redaction/hints/tokens/guess/completion behavior, bind archive gameplay to issued `permanent-v1` puzzle ID/date, and fail closed when no frozen puzzle exists. Scope: `tasks/plans/permanent-daily-archive-runtime.md`.
- [x] Isolate archived-game saves and browser gameplay-session keys from current Daily and retained game modes before exposing archive UI; keep the current beta keys and exact-version archive saves. Scope: `tasks/plans/archive-browser-save-isolation.md`.
- [x] Reorder supported hitter reveal fields to `AB, R, H, HR, RBI, SB, BA, OBP, SLG, OPS` in career and seasons without inventing unsupported Baseball-Reference fields. Scope: `tasks/plans/hitter-reveal-column-order.md`.
- [x] Preserve pitcher-save missing-data semantics in the legacy Daily player substrate: sourced zero remains `0`, but an unavailable Lahman save total is absent rather than fabricated as `SV 0`. Scope: `tasks/plans/pitcher-saves-data-contract.md`.
- [x] Align hint 4's existing compact stat subset with the full reveal order, format from structured career stats rather than legacy `statsLine`, and include pitcher `SV` only when supported. No WAR/bWAR is invented. Scope: `tasks/plans/hint-four-stat-composition.md`.
- [ ] Before permanent issuance, make archived clue/hint behavior immutable alongside frozen canonical player IDs; treat this as a separate portable-contract/persistence decision. Portable clue snapshot contract and the schema-v2 clue-frozen issued-puzzle envelope are complete without freezing scoring. Next: append-only Supabase/codec support for v1 + v2, then issuance/materialization wiring. Scopes: `tasks/plans/permanent-daily-clue-snapshot-contract.md` and `tasks/plans/permanent-daily-issued-puzzle-v2-contract.md`. After the full immutability path is complete, omit terminal Jr/Sr from generated initials without altering player names/aliases or silently mixing same-identity beta observations during rollout.
- [ ] Introduce a new versioned Daily Nine ruleset with HR 4 / 3B 3 / 2B 2 / 1B 1 / BB 0 / K or Give Up -1, no separate wrong-guess point penalty; preserve points-v3 historical data. Stage engine, result constraints, comparison negative bucket/score ranges, browser persistence/delivery, and a safe public default cutover in bounded PRs. Later BB 0.5 / K 0 would be a different version.
- [ ] Show mode-appropriate How to play on every game-page entry/reload, accessible and reopenable without a dismissal flag or interruption of hydration; align copy with active scoring version.
- [ ] Add archive routes/navigation for the game(s) currently exposed by web availability only after archive persistence/session identity is isolated; keep retained Classic archive support compatible with one-setting restoration rather than deleting Classic contracts.
- [ ] Remember per-browser/device completion and recorded score/result for each stable Daily + game/ruleset.
- [ ] Keep archived results shareable and eligible for same-Daily/same-ruleset global comparison.
- [ ] Defer cross-device history until accounts.
- [ ] Before launch, explicitly choose the surviving game, final launch rules, and launch date; reset permanent numbering to Daily #1.

## 6. Lineup-content system

- [ ] Define gameplay-profile contracts separately from facts.
- [ ] Define versioned lineup recipes with slot groups, filters, difficulty, repeats, and diversity constraints.
- [ ] Make Standard Daily one saved recipe.
- [ ] Establish a conservative “I could have gotten that” pool; only final slot may be deliberate deep challenge.
- [ ] Add reproducible All-Star/award/bWAR enrichment.
- [ ] Add provider-neutral profile/recipe persistence/admin editing in bounded PRs.
- [x] Preserve manual review/replacement of exact generated nine and allow intentional canonical reveal-ready manual choices outside the automatic pool without changing automatic eligibility (PR #162).

## 7. Launch surfaces

- [ ] Remove public Reset today's results before broad launch; any retained admin/test reset must be non-contributing.

- [ ] Analytics/error monitoring.
- [ ] Finish real-device iPhone/iPad polish and payload measurement after the compact revision is deployed.
- [x] Refine the heritage baseline into the compact baseball scorebook direction after September 8 screenshot review.
- [ ] Privacy, terms, canonical domain, social metadata.

## Deferred public products

Accounts/cross-device history; native clients; head-to-head/social; public custom/theme libraries before the core game proves itself; payments before demand. Advanced mode-specific analytics remain deferred until beta selects the launch game.
