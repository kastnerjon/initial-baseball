# Initial Baseball — Start Here

Status: Active project handoff  
Last updated: 2026-09-23

Use this file to resume work. It records verified current state, settled future requirements, genuinely open decisions, and the exact next bounded work. Pull requests and `tasks/lessons.md` retain history.

## Resume protocol

1. Read `AGENTS.md`.
2. Read this file.
3. Read `tasks/todo.md`.
4. Verify current GitHub `main`, open PRs/issues, CI, Vercel, Supabase configuration, and production behavior.
5. Read only the canonical documents/source needed for the next bounded task.
6. Write the scope contract before implementation.
7. Complete one owning concern per PR.

Do not restart settled discussions because the conversation changed. Correct drift before new implementation.

## Product promise

Initial Baseball currently presents **Daily Nine** as the only normal/default browser game. **Classic Inning** remains fully implemented and data-compatible but is hidden by default at the web boundary; the owner can restore the existing Classic route and mode navigation with the server-side availability setting. The games remain distinct over the same current daily nine-player puzzle, and Classic rules, saves, results, comparison infrastructure, and historical data are retained.

Current Daily numbering is beta. At a later explicit broad-launch decision, the permanent sequence restarts at **Daily #1** and current beta history is not imported into the permanent archive. Settled launch/results/archive direction: `docs/product/beta-launch-results-archive.md`.

Standard Daily should be difficult because recall and hints are difficult, not because players are arbitrarily obscure. Except for a possible final deep-challenge slot, a reveal should normally prompt: **“I could have gotten that.”**

The game should feel immediate, accurate, and recognizably baseball.

## Current Daily Nine comparison performance checkpoint

PR #225 is production-verified on main `90073bccd67002fdaf6fa85f5707be5f8968051b` / deployment `dpl_ABUyV3qrm2sEg2KAx7ULNAfGdLwo`. Provider sub-timing has now been sampled in production across 15 successful reads per route. Local provider setup and decode are negligible; the observed multi-second tail is inside awaited `client.rpc(...)` (at-bat max 1,495 ms, completed max 2,125 ms), while matching hosted PostgreSQL execution remains low-millisecond. Do not respond with SQL/index/rollup/cache work.

The browser comparison policy now uses the measured tail rather than changing storage: after saved-game hydration, the exact per-at-bat comparison is prefetched as soon as a points-v3 AB becomes active, but the hook projects an idle public state until engine-derived own points exist at terminal resolution. The same exact-slot request/result is therefore reused at reveal instead of restarting merely because own points became known. This normally moves the aggregate read ahead of the player's result write, but it does not claim deterministic self-exclusion if the managed read is still in flight when that write lands. A separately restored terminal state may also perform a fresh current read. Comparison remains asynchronous and must never block Guess, Give Up, Next, result persistence, or gameplay progression.

PR #227 post-merge hosted/source verification is now recorded in `docs/engineering/daily-nine-comparison-prefetch-verification-2026-09-22.md`: exact main/CI/production identity is clean, both live comparison routes remain versioned HTTP 200 with `private, no-store`, exact-deployment error/fatal logs are clean, and source/tests confirm hidden active presentation plus existing stale-response fencing. Ordinary-browser request-count/trigger-to-visible, controlled delayed/failed-read rendering, and physical/mobile interaction remain explicitly unverified. Close those with real browser evidence when tooling permits; do not redesign storage or scoring to compensate. Daily Nine result presentation is points-native even though baseball outcomes remain native internal facts. The immediate terminal card shows `N PTS`, not `Outcome HR/K/...`; Daily Nine scorecards use one shared initials / SCORE / AVG scoring row model, with the in-app table additionally joining already-persisted revealed player names while copied share output remains initials / SCORE / AVG only. Missing/withheld AVG renders `—` so the grid remains structurally stable. The completed Daily Nine headline uses the same whole-game comparison as `X PTS • AVG Y.Y` when the AVG is displayable, with BEAT/sample context secondary; the share header uses that same points/AVG line and falls back to `X PTS` while comparison is withheld/unavailable. Personal AB values are recomputed from stored completed-at-bat facts through the existing engine `getDailyAtBatPoints` rule, so refresh/restore needs no new score persistence. Exact-pitch and completed comparison reads remain ephemeral/non-blocking with existing sample thresholds. Classic remains baseball-native. Onset-of-AB AVG remains deliberately unimplemented; ordinary-browser/mobile comparison verification remains open.

## Current editorial public-selection checkpoint

September 22 hosted verification closes two remaining public-selection checks without runtime changes. Production Daily #149 is served from the still-`scheduled` revision-2 editorial row: Daily Nine, Classic and both comparison boundaries bind to `daily-2026-09-22-editorial-83a0294e`, and independently recomputing the editorial fingerprint from the nine stored canonical IDs yields the same `83a0294e`. Deterministic fallback is also live-proven for both branches: hosted draft Daily #97 resolves as `daily-2026-08-01`, and missing-record Daily #141 resolves as `daily-2026-09-14`. Authenticated-editor preview/search/replace/revalidate remains a manual pre-launch check because the connected tooling cannot supply the owner Basic-auth credential interactively; it is not a feature-development blocker. Issues #97 and #86 are now closed as completed, while #91 was already closed. Evidence: `docs/engineering/daily-editorial-public-selection-verification-2026-09-22.md`.

## Feature-development resumption checkpoint

The September 22 QA pass has a hard stop. Remaining ordinary-browser, physical-mobile, saved-hydration, and authenticated-editor interaction checks are retained as manual pre-launch QA; they are not reasons to keep adding verification work in the absence of a concrete defect. Current `points-v3` scoring remains unchanged. Feature development resumes with **Permanent archive and local history**, preserving the existing one-bounded-concern-per-PR and fresh-eye review discipline.

## Permanent archive foundation

Archive PR 1 defines the portable `permanent-v1` series identity in `packages/daily` without choosing a launch date. Archive PR 2 adds the provider-neutral immutable issued-puzzle contract: stable `permanent-v1-daily-N` puzzle identity, exact ordered nine canonical player IDs, first issue timestamp, idempotent exact reissue, and conflict rejection for any rewrite. Append-only Supabase persistence implements that contract through `public.permanent_daily_issued_puzzles`, with server-only SELECT/INSERT access and no application update/delete path. Portable issuance orchestration accepts an explicitly resolved permanent identity plus the authoritative scheduled/published editorial puzzle for the same date, validates exact slots 1-9, and delegates freezing to the existing immutable service. The server-only web composition now binds that service to the authoritative editorial and permanent-issued-puzzle Supabase repositories through one service-role client, while still requiring the permanent identity explicitly and introducing no launch-epoch configuration. No public issuance route or archive read route exists yet. Current beta `DAILY_PUZZLE_EPOCH` numbering remains disposable. A provider-neutral read contract supports frozen permanent puzzle lookup by permanent series + Daily number or series + date without requiring a configured launch epoch. The existing server-only Supabase adapter now implements that read port against the table's unique number/date keys while reusing the same row decoder and query-error boundary; no schema, privilege, or write behavior changed. Server-only read composition now creates one service-role client, builds that provider, and delegates number/date access through the portable read service without launch-epoch inference. Web materialization now turns an already-frozen snapshot into a gameplay-ready `DailyPuzzle` without rerunning lineup generation: permanent ID/date/number and canonical batting order stay frozen, while player identities and hint payloads reuse the same canonical-ID gameplay-player lookup and `createDailyPuzzlePitch` adapter as current editorial Daily. Missing frozen players fail closed. Server archive puzzle-source/runtime composition is the next boundary; no public archive route exists yet. Scopes: `tasks/plans/permanent-daily-identity.md`, `tasks/plans/permanent-daily-issued-puzzle.md`, `tasks/plans/permanent-daily-issued-puzzle-supabase.md`, `tasks/plans/permanent-daily-issuance.md`, `tasks/plans/permanent-daily-issuance-supabase-composition.md`, `tasks/plans/permanent-daily-issued-puzzle-read.md`, `tasks/plans/permanent-daily-issued-puzzle-supabase-read.md`, `tasks/plans/permanent-daily-issued-puzzle-read-composition.md`, and `tasks/plans/permanent-daily-puzzle-materialization.md`.

## Daily Nine scorecard presentation

The in-app Daily Nine scorecard now renders the already-persisted revealed player name between initials and SCORE/AVG. Share text remains initials + SCORE + AVG only, so copied results do not disclose answers.

## Classic availability checkpoint

Classic Inning is retained but hidden by default through the server-only web setting `CLASSIC_INNING_ENABLED`. With the setting absent or anything other than the exact value `true`, the Daily/Classic mode navigation is not rendered and `/classic` redirects to `/` before Classic bootstrap composition. Setting it to `true` restores the existing Classic route and navigation. No Classic engine rules, browser storage, results, comparison contracts, or database data are removed.

## Architecture map

```text
shared
  ├── engine
  └── baseball-data
         \
          daily
            \
             web / API / admin adapters
                       \
                        Supabase/Postgres adapters
```

- shared: portable contracts and version identifiers;
- engine: outcomes, scoring/completion, runner rules, search, result validation/derivation, and results;
- baseball-data: canonical facts, enrichment, provenance, QA, and runtime artifacts;
- daily: future profiles/recipes, selection, repeats, validation, lifecycle, and provider-neutral repository/service ports;
- web: rendering, browser state, signed authorization, active hint bundles, routes, admin, and persistence adapters;
- Supabase: operational persistence, not baseball facts or product rules.

### Runtime wiring at a glance

```text
Public Daily / Classic page
  -> web Daily runtime
  -> cached materialized public puzzle
  -> scheduled/published editorial row when consumable
  -> deterministic Daily fallback otherwise
  -> bootstrap with public puzzle + signed progression token + current hint bundle

Guess / Give Up
  -> browser signed progression token
  -> POST /api/daily/resolve
  -> Daily runtime / engine rules
  -> canonical answer/reveal shard
  -> successor signed token + next authorized hint bundle

Completed result stack
  DailyInningGame native-completion activation
  -> useCompletedDailyResultSubmission
  -> dailyCompletedResultClient
  -> POST /api/daily/results
  -> serverDailyCompletedResults
  -> completed-result submission service
  -> engine validateDailyCompletedResult (4A)
  -> Daily idempotency service (4B)
  -> Supabase completed-result repository
  -> public.daily_completed_results

Resolved-AB stack (6A–6D activation browser-proven in production)
  -> POST /api/daily/at-bats
  -> authoritative cached public puzzle
  -> engine validateDailyAtBatResult / derived points
  -> Daily first-write-wins service
  -> Supabase resolved-AB repository
  -> public.daily_at_bat_results

Owner-supplied future lineup
  -> private Supabase pg_net dispatch
  -> POST /admin/daily/chatops
  -> Daily editorial workflow/lifecycle
  -> Supabase daily_editorial_puzzles
  -> public-puzzle cache invalidation
  -> normal public Daily runtime
```

This map is for orientation. Domain behavior still belongs in engine/Daily; routes, React, and Supabase adapters only compose/transport those contracts.

Product behavior: `docs/product/daily-inning-blueprint.md`.  
Beta/launch/results/archive model: `docs/product/beta-launch-results-archive.md`.  
Lineup content: `docs/product/lineup-content-system.md`.  
Architecture: `docs/architecture-and-scale-plan.md`.  
Answer integrity: `docs/decisions/0001-daily-answer-integrity.md`.

## Resolved-AB contract implementation

The 4D foundation includes portable schema-1 points-v3 AB transport, pure engine validation/derived points, the Daily first-write-wins repository/service, a server-only Supabase provider, authoritative `POST /api/daily/at-bats` composition, and the full 6A–6D browser lifecycle. PR #174 is closed as superseded by merged roadmap PR #175; its equal-population/read-time-rescoring design remains historical reference only. The merged browser path now owns durable immutable observations, exclusive Web Lock authority, owner-gated gameplay persistence, save-ordered AB freeze/delivery, bounded owner-scoped pending retry, and fresh attempt/completed-result identity reuse. Production endpoint/database behavior, physical multi-tab owner/follower/takeover, fresh full-completion identity reuse, and physical Safari restore are verified. The recorded production scenarios passed; the September 19 source review found ownership/request-lifetime counterexamples outside that proof. R1 owner-lifetime delivery fencing, R2 gameplay request-lifetime fencing, R3 persistence authorization, and R4 re-bootstrap/current-authority fencing are implemented. R2 covers Reset/restore plus persistence-session teardown and owner-loss invalidation. R3 separates lock authority from analytics eligibility. R4 keys persistence to stable semantic puzzle/ruleset identity, resets readiness per real session, and requires the render plus live authority/readiness to agree before save or reset. R5 bounds resolved-AB POSTs to five seconds and uses each newly frozen terminal AB as a same-owner opportunity to retry older pending slots without a timer loop; R6 isolates malformed-save decoding and degrades corrupt nested state safely. Findings and bounded PR sequence: `docs/engineering/resolved-at-bat-review-2026-09-19.md`. Scope: `tasks/plans/resolved-at-bat-contract.md`, `tasks/plans/resolved-at-bat-repository.md`, `tasks/plans/resolved-at-bat-supabase-provider.md`, `tasks/plans/resolved-at-bat-submission-api.md`, and `tasks/plans/resolved-at-bat-browser-lifecycle.md`.

## Current verified state

- Current runtime baseline is PR #227 merge `a62b35616a85223d5780fbc26192456dcdbe13e9`. Push CI run `35769178567` completed with the executable `test` job successful; production deployment `dpl_AqF96Fs2HvmfQ6NXatUZ2ZsPEen1` is `READY` on that exact SHA with canonical aliases and no alias error. Live at-bat/completed comparison probes returned schema-1 HTTP 200 with `Cache-Control: private, no-store`, and the exact deployment's reviewed error/fatal runtime-log window was clean. This checkpoint changed no Supabase schema/RPC behavior. Detailed #227 evidence and the remaining browser/mobile gaps are recorded in `docs/engineering/daily-nine-comparison-prefetch-verification-2026-09-22.md`.
- September 18 production result collection is now proven end to end on the PR #171 activation baseline. A fresh real-browser Daily #144 / `points-v3` session completed with nine Give Ups and created exactly one `public.daily_completed_results` row at `2026-09-18 06:16:47.384891+00`. The persisted row carried the expected puzzle/ruleset identity, nine ordered native Give Up facts, and engine-derived zero-point summary. Replaying the exact stored schema-1 payload with the same `submissionId` through production `POST /api/daily/results` returned HTTP 200 `{"status":"existing"}` and the table remained at exactly one row with the same receipt timestamp. The surrounding Vercel runtime-error scan was clean. PR #171 remains the activation code baseline (`ae2fc428b2fad05685b068944acce66b9dddf536`, production deployment `dpl_DctrheRJbonPmcszrjAfPuJxvzhy`); PR #172 reconciled the pre-proof handoff. Completed-result 4A/4B/4C has this operational proof. PR #161 is now closed as superseded by the bounded merged provider/API/browser sequence; it must not be revived unchanged.
- Resolved-AB provider migration `20260918185110_create_daily_at_bat_results` is applied. The table uses composite first-write-wins identity `(attempt_id, puzzle_id, ruleset_version, pitch_number)`, a separate puzzle/ruleset/slot population index including derived points, RLS with no policies, no `anon`/`authenticated` grants, and `service_role` `SELECT, INSERT` only. The earlier simultaneous same-key provider proof produced one winner and cleaned up to zero rows; the September 18 post-6D production proof likewise used a disposable row and returned the table to its pre-proof state. Scope: `tasks/plans/resolved-at-bat-supabase-provider.md`.
- The resolved-AB server API preflights only routing fields, rejects future Pacific dates, loads the authoritative cached public puzzle, calls engine validation/point derivation and stores through Daily/provider. `POST /api/daily/at-bats` returns only created/existing/conflict/error status with `private, no-store`. The merged 6D owner path now invokes it asynchronously only after successful gameplay persistence and immutable journal freeze. Scope: `tasks/plans/resolved-at-bat-submission-api.md`.
- Browser 6A–6D is merged; the specified normal-path scenarios below are proven on production. Review R1–R4 are repaired. PR #185 merged as `1965258055eecbf501de82d6f0aed395aea33867`; the final browser proof ran on current production deployment `dpl_2DLJ5461tmLVVVewcVdDpezaxJtU` at main SHA `f6a88ca9f0b5c95171108c17d81e21303fca2f27`. In Chrome Incognito on a physical iPhone (exact browser version not captured), Tab A owned the fresh Daily #145 / `points-v3` run while Tab B showed the passive follower message. Batter 1 Give Up created exactly one `daily_at_bat_results` row under attempt `6da8d6b7-aedd-457c-82e4-1be0b1e3ac7f`; closing Tab A let Tab B acquire ownership and rehydrate at batter 2 without a second attempt. Completing batters 2–9 produced exactly nine AB rows, pitches 1–9 once each, all under that attempt ID, plus exactly one `daily_completed_results` row whose `submission_id` equaled the same attempt ID. All nine AB POSTs and the completed-result POST returned HTTP 201 and the post-proof runtime-error scan was clean. A separate physical iPhone Safari Private run created attempt `3d112236-c6df-4416-981b-8f193eb2ab7e`, persisted batter 1 with HTTP 201, and restored at batter 2 after refresh; its runtime-error scan was clean. Both exact disposable QA identities were then removed with privileged Supabase cleanup and readback confirmed zero remaining rows. The browser architecture remains 6A immutable journal/outbox → 6B Web Lock authority/generation fencing → 6C owner-gated persistence/eligibility → 6D save → freeze → async delivery plus fresh completion-ID reuse. Scope: `tasks/plans/resolved-at-bat-browser-outbox.md`, `tasks/plans/resolved-at-bat-browser-ownership.md`, `tasks/plans/resolved-at-bat-browser-gameplay-lifecycle.md`, `tasks/plans/resolved-at-bat-browser-6d.md`, and `tasks/plans/resolved-at-bat-browser-lifecycle.md`.
- The public source now reuses the same canonical editorial-candidate factory as the admin workflow, so approved manual-only players resolve without widening automatic generation. Focused tests cover scheduled/published order, canonical identity, rejection, fallback, and archived behavior. Scope: `tasks/plans/public-editorial-candidates.md`. Exact merge-SHA production deployment is verified READY as `dpl_APaPW1hwmzghnoRg4fEXhcFnNCCw` on `0001f51c15b9e7b4e5e9647ce471365a96f19bc7`.
- Completed-result step 4A implements shared schema-1 types and pure engine validation/derivation for `points-v3` and `classic-inning-v1`. The validator binds native facts to the expected puzzle/game, checks exact completion and fact consistency, reuses existing gameplay rules, and returns copied normalized facts plus a game-specific summary. It does not prove honest play. Scope: `tasks/plans/completed-result-contract.md`; contract: `docs/spec/engine.md` and `docs/spec/data-model.md`.
- Completed-result step 4B implements the provider-neutral atomic repository/service boundary in `packages/daily`. `insertIfAbsent(result)` is the first-write-wins repository primitive keyed by `submissionId`; identical retries return the existing normalized result, while same-ID/different-payload retries return `idempotency_conflict` without overwrite. The service consumes 4A output and does not re-run validation/scoring. The current provider step adds the reconciled `daily_completed_results` migrations plus a server-only Supabase row codec/adapter that inserts first and reads the existing winner only after a PostgreSQL unique-key conflict. It has no update/upsert path and does not validate gameplay. Scope: `tasks/plans/completed-result-supabase-provider.md`. The completed-game API is the separate web/server layer described in `tasks/plans/completed-result-submission-api.md`; the browser retry adapter is described in `tasks/plans/completed-result-browser-client.md`; native activation is implemented by `tasks/plans/completed-result-native-activation.md`. The September 18 controlled production proof confirmed one real browser completion created one row and an exact same-ID replay returned the existing result without increasing row count. Preserve this proof; the September 19 browser review prerequisites are now implemented and should remain intact as comparison verification continues.
- PR #204 activated the already-reviewed Daily Nine comparison GET reads and merged as `178e58cb6fcb8f09ad9ebc3e6ba69cca7a725a01`. Exact production deployment `dpl_F87hcE51cQT6zhoCp8MgGKwCSX38` is `READY` and canonically aliased. September 19 production smoke returned HTTP 200 versioned live payloads from both comparison routes with `Cache-Control: private, no-store`; at verification time the AB read reported four observations / 2.0 average points and the completed read reported two finishers / 28.5 average total points with the 64-entry points-v3 histogram. The comparison-route runtime-error scan was clean. PR #206 adds only the browser transport/decoder over those routes: typed at-bat/completed reads, runtime schema-1 decoding, exact response-identity checks, caller-owned AbortSignal propagation and browser `no-store`. PR #207 adds the separate browser request-lifecycle controller: independent at-bat/completed channels, same-channel replacement, generation/request fencing, abort on replacement/invalidation, whole-session invalidation, and stale success/error/settled suppression. The terminal-at-bat UI checkpoint adds a dedicated identity-keyed hook and compact YOU / AVG presentation over that seam. The completed-game checkpoint adds a separate completed-channel hook that begins from the final engine-complete transition, survives View Results when identity is unchanged, refreshes current data on restored completions, and renders whole-game YOU / AVG plus strict-lower BEAT only at 20+ completed results. The user's own result remains immediate throughout; comparison failures stay comparison-only and sharing/completion delivery do not wait.
- September 20 hosted verification of PR #209 remains the comparison evidence baseline. PR #210 then merged the evidence/docs checkpoint as `93dcff8546e1c9f6716c285be79fc96f901d6541`; push CI run #775 succeeded and production deployment `dpl_Bnuk2DTPdwrAimsYyXize48Xyktb` is `READY`, targets production, carries that exact Git SHA and has the canonical alias attached. The underlying PR #209 runtime evidence remains: A six-hour Vercel runtime-error scan was clean, and current-deployment logs contained successful HTTP 200 reads from both comparison routes. Supabase project `dwreeiydvwikpamlokji` is `ACTIVE_HEALTHY`; migration `20260919164818_create_daily_nine_comparison_reads` is present, and both comparison RPCs remain SECURITY INVOKER with execute denied to `anon`/`authenticated` and granted to `service_role`. Exact-main build output reports `/` at 122 kB First Load JS, compared with 119 kB after PR #207 and 121 kB after PR #208; hidden-answer QA passed over 28 client chunks totaling 859,314 bytes. This is hosted/build evidence, not physical-browser or mobile timing proof. Both comparison GET adapters now expose handler-level `Server-Timing` metrics (`daily-comparison-at-bat` and `daily-comparison-completed`) so a later real-browser trace can separate route/server/provider time from browser/network/render time; interactive request-count, failure-recovery, and end-to-end p50/p95 QA remain open. Evidence: `docs/engineering/daily-nine-comparison-hosted-verification-2026-09-20.md`. PR #221 then merged the timing seam as `aa4f675f99be78bd477676c06f655be72c1e9b6d`; production `dpl_3BnRpsfNcL9TrBKJwYWnDpKs9pQS` is READY and public route probes confirm the headers. A subsequent 20-sample-per-route production handler sample found fast medians (65 ms AB / 58 ms completed) but long-tail variance (nearest-rank p95 582 / 430 ms; maxima 1,626 / 1,525 ms). This is handler-only evidence, not browser p95. The isolated PostgreSQL benchmark remains far faster, so do not add rollups/caches/indexes from these samples. PR #223's request-local `compose`, `puzzle`, and provider timings are now production-sampled: the strongest completed outlier was 2,502 ms total with 2,495 ms inside the provider boundary and only 7 ms puzzle time. A hosted `pg_stat_statements` check independently shows the matching PostgREST SQL statements remain low-millisecond (completed mean 1.921 ms / max 19.696 ms; AB mean 1.594 ms / max 17.332 ms). This localizes the unresolved tail between the web provider boundary and PostgreSQL execution. The next bounded observability seam now preserves lazy module-level Supabase client reuse and splits that provider boundary into request-local `provider-setup`, `provider-rpc`, and `provider-decode`; production must be re-sampled before any latency behavior change. Evidence: `docs/engineering/daily-nine-comparison-server-timing-2026-09-22.md`; scope: `tasks/plans/daily-nine-comparison-provider-timing.md`.
- PRs #120–#122 are merged; editorial public consumption, hosted Basic auth, and repository continuity controls are established.
- PR #124 introduced versioned `points-v1`; PR #125 reconciled its verified production deployment.
- PR #126 introduced immediate active-batter hints; PR #127 reconciled that production state.
- PR #128 merged as `9ba0a44198799fe71b0520d5245b16b39e056fc2` and made `points-v2` the current Standard Daily policy.
- PR #131 added immediate Give Up feedback plus server-side editorial-read caching.
- PR #132 merged as `a942bab74a68077a1c6ed1aff37b16af45ccc685`; Submit Guess now immediately shows `Checking…`.
- PR #133 merged as `543adf1038f780313870ed3ff30c163648bd86f3`; the public resolve hot path now caches the fully materialized Daily puzzle, defers heavyweight lineup/Supabase composition to cache misses, separates search initialization from resolution, avoids full canonical-index validation for ordinary canonical guesses, and uses direct reveal-shard access for terminal reveals.
- PR #135 merged as `d2de746664e7d154294f54dc9ae4b1d55f651ad8` on August 30 and established the heritage UI baseline.
- PR #137 merged as `dda608ae7422093b96ded03dd0bf024d71c5c2b6` on September 10 and contains the compact scorebook presentation revision. Its first production attempt failed because of the separate Daily lineup-exhaustion defect tracked in issue #136.
- PR #138 merged as `7c568f3253d62b8fab11becc3e68d94628fa6b0a` on September 10 and closed issue #136. Generated dates from September 2 onward now use dense canonical recognizability ranks after redirect/deduplication; July 22 through September 1 retain the prior `lineup-quality-v2` source-rank interpretation. Published/manual puzzles, the 90-day repeat window, slot bands, deterministic seed inputs, scoring, Supabase behavior, and hosting settings remain unchanged.
- PR #143 merged the points-v3 Daily Nine contract: seven points per at-bat, one point off per revealed hint or wrong guess, and zero on a third wrong guess or Give Up; nine at-bats max 63. Existing points-v2/points-v1/legacy sessions remain versioned compatibility behavior.
- The points banner now shows the accumulated total without an overall denominator and, for the active points-v3 at-bat, the live points still available on that at-bat. The allowance is derived from the same verified hint/strike facts as scoring.
- Verified September 10: production deployment `dpl_8e7N4n8E34rXCgmYj9rJEKBdsKHu` is `READY` on exact merge SHA `7c568f3253d62b8fab11becc3e68d94628fa6b0a` and canonically aliased at `https://initial-baseball-web.vercel.app`. The production build completed successfully, including hidden-answer build QA. A post-activation request to `/` returned HTTP 200 and rendered Daily #137 with the compact scorebook presentation. Error/fatal runtime logs on the new deployment were empty at verification time.
- The previous grouped `Insufficient eligible Daily players for slot 2 (ranks 1-250).` errors are tied to old production deployment `dpl_32hGx8N4TKEGKsCaoqHxVbBfVxtf`; the last grouped occurrence was September 10 at 23:14:43 UTC, before the corrected deployment became `READY`.
- Real-device QA before PR #133 observed roughly two seconds end-to-end for Submit Guess despite successful 200 resolution requests. The post-optimization production iPhone timing retest is still required; do not infer latency improvement from CI/build success.
- The scheduled August 1 rollover observation verified that production advanced from July 31, 2026 / Daily #96 to August 1, 2026 / Daily #97 after midnight Pacific without a coincident redeploy. Deployment `dpl_Bp2gX76FqxQXpjCgAbMY76nUyqwC` remained current, and the post-boundary response served the correct puzzle through Vercel revalidation.
- The initial production payload retains exactly one current-batter four-hint bundle and contains no answer ID/name, canonical reveal record, credential, service-role data, or unrelated future-batter hint bundle.
- `DAILY_PROGRESSION_SECRET`, Supabase credentials, and Daily admin credentials are configured for Preview/Production.
- `daily_editorial_puzzles` migration and RLS/service-role checks passed.
- Unauthenticated `/admin/daily` reaches the challenge and the editor previously authenticated.
- PR #147 merged as `57c1b8374c8b722a31a3fd5dc10ed54bd4d40e93`; production deployment `dpl_6K7qvDBcPFFDz9ACveBMq7jEgCvX` is READY on that exact SHA. It includes the unified 960px Daily rail, compact left-aligned scorecard, points-v3 scorebug ordered At bat → Points possible this AB → Points so far → Strikeouts, and the prior incorrect-feedback cleanup.
- PR #152 merged as `61cf0aa51556e5ded577490cfd9c569c0306eca4` and added atomic nine-player future-lineup replacement plus the private machine-authenticated server adapter while preserving the existing Daily lifecycle, optimistic revisions, cache invalidation, and published-puzzle immutability.
- PR #153 merged as `e3ab3b8a9fc8a196d7962a79e5c23e0cf15c617c` and activated the private Supabase `pg_net` transport. On September 16 the matching machine credential was configured in Vercel Production and Supabase Vault, production was redeployed successfully, and the transport reached the authenticated server route.
- The conversational lineup bridge is operational for routine future-lineup entry. After the initial production smoke test, owner-supplied Dailies #149–#151 were resolved through canonical identity, persisted in exact batting order, explicitly scheduled, and read back at revision 2 with `scheduled_by`/`updated_by` equal to `chatops:assistant`; the persisted seven-day horizon now covers Dailies #145–#151. One `pg_net` request timed out after the server had already committed the correct scheduled row, so the runbook now requires authoritative readback before any retry. Future lineup payloads must never be transported through public GitHub issues/commits/PRs/Actions inputs. Runbook: `docs/operations/daily-lineup-chatops.md`.
- PR #162 separates automatic and manual Daily eligibility: automatic generation remains restricted to ranked `dailyEligiblePlayers`; authorized manual admin/ChatOps curation may select any canonical, reveal-ready Daily-compatible player. Manual-only candidates carry no automatic rank and surface `outside-automatic-daily-pool`; they do not alter automatic generation. Scope: `tasks/plans/manual-daily-canonical-selection.md`.
- PR #155 merged as `c7633a84138838f8b3816484fd4a9e9df38c72dc`. It added typed new-session bootstrap selection for Daily Nine or Classic, signs that ruleset through hint/resolution progression, and reuses engine `isDailyGameComplete` so Classic stops at three outs or batter nine with no successor hint bundle. Scope: `tasks/plans/classic-web-transport.md`.
- PR #156 merged as `cf92eb2ac1a16ef732396e2c8fe44d9f86454db4`. It activates `/classic`, keeps `/` as Daily Nine, shares the existing game component, isolates Classic browser saves from the existing Daily key, makes reset/refresh/share game-aware, and changes a terminal Classic continuation to `View Results` so an unplayed batter is never advanced to or exposed. Production deployment `dpl_5TBWWVyAUpwVtnouotnSBk79Lhgr` is READY and canonically aliased. Both `/` and `/classic` returned HTTP 200 for Daily #143 with the same public puzzle/initials and signed `points-v3` versus `classic-inning-v1` game identity respectively; the build exposed both routes, hidden-answer QA passed for two initial payloads, and no error/fatal runtime logs were present at verification time. Scope: `tasks/plans/classic-browser-experience.md`.
- Physical iPhone spot-check on September 16 confirmed the Daily Nine/Classic navigation is present, switches cleanly, and active saves/hint state are independent. The broader terminal/refresh/share/latency/device matrix remains outstanding.
- September 16 product decisions now treat Daily Nine and Classic as competing beta games. Playing one does not count as playing the other; result/comparison/history populations remain separate. Current shared lineup content is not a permanent identity constraint, and either game may ultimately be removed without rewriting the survivor. Permanent numbering/archive starts only after an explicit future reset to Daily #1. Source of truth: `docs/product/beta-launch-results-archive.md`.

## Implemented gameplay

New Daily Nine sessions use `points-v3`:

- each at-bat starts at 7 points; each revealed hint or wrong guess costs 1;
- a third wrong guess or Give Up records K and awards 0;
- all nine scheduled at-bats are played, for a 63-point maximum;
- the resolved at-bat shows both its baseball outcome and awarded points;
- raw facts preserve slot, initials, outcome, hints revealed, wrong guesses, and correct/K/Give Up resolution;
- ruleset version flows through token, local state, result, and share output;
- compatible `points-v1` sessions retain `5/4/3/2/1/0` and a 45-point maximum;
- compatible old sessions remain `legacy-inning-v1` with prior three-out behavior and no misleading point copy.

`points-v3` is the current Daily Nine beta policy, not yet a frozen permanent-launch promise. Any later scoring change still requires an explicit new ruleset version.

### Immediate active-batter hints

- Bootstrap sends all four current-batter hints plus signed later-depth checkpoints.
- Hint clicks reveal local data and adopt the corresponding signed token without a network request.
- Incorrect guesses return a refreshed same-pitch bundle with updated strike claims.
- Correct/K/Give Up returns only the next pitch’s bundle unless complete.
- Compatible saved progress hydrates only its verified current bundle through `POST /api/daily/hints` before becoming interactive.
- The legacy one-hint route remains server-compatible but is absent from the active client.
- Answers, canonical IDs, reveal records, credentials, and unrelated future-batter hints remain server-side.

A technical user may inspect all current-batter hints and replay a prior valid token. That remains within the accepted anonymous noncompetitive model; stronger competition requires server-authoritative attempts.

### Resolution responsiveness

- Give Up immediately changes to `Revealing…` while the existing authorized resolution request completes.
- Submit Guess immediately changes to `Checking…` while its authorized resolution request completes; the correctness decision remains server-side.
- `POST /api/daily/resolve` retains its handler-level `Server-Timing` duration; comparing it with the phone's end-to-end latency helps identify remaining browser/network/platform-startup overhead.
- The server caches the fully materialized public `DailyPuzzle` by date, with a 300-second safety revalidation window. Successful authenticated admin saves invalidate that cache.
- On a materialized-puzzle cache hit, resolution does not re-query Supabase, rebuild the nine-player puzzle, rank the Daily candidate universe, or initialize the public lineup source.
- Player-search candidates are constructed only on the search path rather than during resolve runtime composition.
- Ordinary canonical-format guesses compare directly with the server-only canonical answer ID. Legacy/noncanonical guesses still cross the canonical redirect boundary.
- Terminal correct/K/Give Up resolution reads only the deterministic reveal shard for the answer instead of loading the full canonical player index solely to locate the reveal.
- These are server/runtime optimizations only: Supabase remains editorial authority, progression/scoring rules are unchanged, and answers/reveal records remain server-side until terminal resolution.
- Production mobile latency improvement remains unverified until the same real-device flow is repeated after PR #133.

### Public visual presentation

The September 8 screenshot review superseded the oversized heritage treatment with the **compact baseball scorebook** direction in `docs/product/daily-inning-blueprint.md`: small masthead/help, one edition number, compact non-sticky status, single current-strike indicator, restrained serif focal points, readable sans serif controls/data, flat surfaces, and history below active play. Stats separate Season/Team, use compact tabular numerals and local keyboard-accessible scrolling, preserve all canonical facts, and distinguish career totals. Next At Bat precedes optional long season tables. Existing pending-advance scores are rendered immediately at resolution.

PR #137 merged that presentation code, and production deployment `dpl_8e7N4n8E34rXCgmYj9rJEKBdsKHu` now serves it successfully after PR #138 removed the independent lineup-exhaustion blocker. This is presentation work only; scoring/version compatibility, search semantics, canonical facts, publication, persistence, and answer authority remain unchanged. Plan/scope: `tasks/plans/compact-scorebook.md`. Physical iPhone/iPad touch and post-PR #133 latency QA remain outstanding.

The September 15 rail follow-up makes the 960px reveal/statistics width the consistent desktop maximum for the masthead, scorebug, active card, scorecard, share card, and footer. Scorecard columns remain aligned but form a compact left-aligned group rather than spanning the full rail. Scope: `tasks/plans/unified-daily-rail.md`.

The points-v3 scorebug presents four equal-width metrics in game order: At bat, Points possible this AB, Points so far, and Strikeouts. Compatibility scorebugs retain their existing metrics. Scope: `tasks/plans/daily-nine-scorebug-points.md`.

## Approved September 15–16 direction

Merged PR #140 adds initials → canonical answer → outcome for resolved players, including K/Give Up, plus an isolated spoiler-safe share card with Copy in its upper-right. Browser-only answer retention is additive to schema 3; old saves without names show Answer unavailable. This work is included in the deployed main branch. Scope: `tasks/plans/scorecard-answers.md`.

Daily Nine is currently the default points-v3 beta game and Classic Inning is a separate classic-inning-v1 beta game using the same daily lineup, runner advancement and runs, ending at three outs or nine at-bats. Both may be played on the same date; saves/results/shares distinguish them and unplayed answers stay hidden. PR #141 merged portable policy/label/completion support, PR #155 merged the signed server transport/progression seam, and PR #156 merged `/classic`, navigation, isolated Classic saves, game-aware refresh/reset/results/sharing, and hidden unplayed answers while preserving existing Daily/legacy compatibility.

The owner is keeping both games during beta to collect friend/user feedback, but realistically expects to choose one for broad launch. New shared infrastructure should therefore be game-aware without doubling expensive game-specific systems. Classic can later be disabled/removed without corrupting Daily Nine; the current shared lineup can also be separated later without redefining completed-result identity. Detailed source: `docs/product/beta-launch-results-archive.md`.

## Settled future systems

### Canonical player facts versus gameplay profiles

One authoritative canonical player system is enriched from reproducible sources. Objective facts stay in baseball-data. Editable gameplay profiles separately describe recognizability, expected difficulty, Standard Daily eligibility, expert-only status, manual promotion/exclusion, notes, and later observed solve rates.

### Recipe-driven lineups

Standard Daily is one versioned recipe, not the only selector. Recipes may define slot groups, sourced factual filters, gameplay-profile filters, repeat protection, duplicate prevention, reveal readiness, and diversity constraints. The generator proposes; the editor reviews, replaces, validates, and schedules the exact nine.

Authorized manual curation is intentionally broader than automatic generation: automatic proposals remain restricted to ranked `dailyEligiblePlayers`, while an editor may intentionally select any canonical, reveal-ready Daily-compatible player. An outside-pool manual choice remains unranked for generation and surfaces `outside-automatic-daily-pool`; it does not change future automatic lineups or canonical baseball facts.

### Completed results and comparison

Completed-result collection is implemented and has prior production proof as recorded above. Preserve its engine validation, immutable repository, server adapter and exact-payload browser retries.

Approved September 18 replacement for 4D: collect one immutable observation per resolved Daily Nine AB, including partial games; show YOU / AVG after each terminal reveal. Final scores compare completed games only. Saving and comparison read success are independent; briefly stale comparisons are acceptable. Strictly lower scores define "You beat X% of finishers". Public Reset is beta-only and must be removed before launch; any retained admin/test flow is non-contributing.

PR #174 was inspected at `38f3bc9` and is now closed as superseded. Do not revive unchanged: its every-AB-count-equals-completion-count rule and read-time-rescoring direction are invalid for this product. Resolved-AB validation, immutable provider storage, the server POST boundary, and the 6A–6D browser collection lifecycle are now implemented and production-proven. Fresh contributing runs establish attempt identity before the first terminal AB and reuse that identity for a newly created points-v3 completion. Comparison GET reads are now live in production after PR #204; browser/UI comparison consumption is still not implemented. Full comparison scope: `tasks/plans/resolved-at-bat-comparison.md`; browser sequence/evidence: `tasks/plans/resolved-at-bat-browser-lifecycle.md` and `docs/operations/resolved-at-bat-browser-proof.md`.

### Permanent archive and personal history

Current beta numbering/history is disposable. At a later explicit broad-launch decision, the permanent sequence restarts at Daily #1. From that point, every issued Daily is frozen and remains playable/shareable in the archive. The initial no-account product remembers completed archived games and recorded results on the current browser/device, keyed by stable Daily identity plus game/ruleset. Cross-device history waits for accounts.

## Remaining verification

### Public real-browser gameplay

These require an actual browser lifecycle but no editor credentials:

- complete interactive Daily Nine/Classic switching, isolated saves/reset, active and pending refresh, terminal completion, share destinations, and hidden unplayed Classic answers on physical/common browser widths; basic iPhone switching/save isolation is already verified;
- re-test Submit Guess and Give Up latency on production after PR #133, inspecting handler-level server timing against end-to-end phone timing;
- verify the compact presentation and touch behavior on physical iPhone/iPad, including hints, search dropdown, selected-player state, result/reveal tables, history, and completion/share;
- resolved `points-v3` outcome/point presentation, including hint/wrong-guess deductions;
- saved-session `/api/daily/hints` hydration and refresh recovery;
- correct guess, wrong guesses, third strike, Give Up responsiveness/reveal, all-nine continuation, final reveal/completion, and mobile interaction;
- action-level network/log inspection during those flows.

### Authenticated editorial workflow

Admin redesign is deferred. The existing authenticated editor remains available. The preferred routine workflow is conversational future-lineup entry through the now-active private ChatOps adapter. It and `/admin/daily` operate on the same editorial lifecycle and records; the assistant path is not a parallel schedule.

Verified September 16–17:

- PRs #152 and #153 are merged and active in production;
- the Supabase connection targets `initial-baseball-db` / `dwreeiydvwikpamlokji`;
- `private.dispatch_daily_lineup_chatops(...)` forwards through `pg_net` to the authenticated server adapter and does not write editorial tables directly;
- the matching bearer credential is stored only in Vercel server environment and Supabase Vault;
- an invalid automatic-pool candidate failed atomically before the manual-candidate policy change;
- a corrected future nine was persisted in exact order, explicitly scheduled, and read back with `chatops:assistant` attribution;
- routine owner-supplied Dailies #149–#151 were then persisted in exact order and scheduled through the same private path, yielding a complete persisted seven-day horizon through Daily #151;
- a transport timeout after one successful server mutation was safely reconciled by authoritative row readback before any retry;
- PR #162 broadens only authorized manual selection to canonical, reveal-ready Daily-compatible players outside the automatic pool; automatic generation remains unchanged.

Remaining hosted editorial checks:

- player preview/search/replacement and validation through the authenticated editor workflow;
- timed public consumption when a newly scheduled future editorial puzzle reaches its live date;
- deterministic fallback observation for a missing/draft record.

The routine conversational future-lineup workflow itself is no longer a blocker for completed-result work.

## Exact next work order

1. Read `docs/engineering/resolved-at-bat-review-2026-09-19.md`. Preserve the successful normal-path production proof and R1–R4 repairs. PRs #161/#174 are closed as superseded references.
2. R1 outbox owner-lifetime fencing is implemented: delivery is bound to a disposable exact attempt/generation session and cleanup invalidates it before lock release. R2 gameplay request fencing is also implemented: Reset, durable restore, persistence-session teardown and owner loss invalidate old Guess/Give Up authority, and stale success/error/finally work cannot affect a replacement request. R3 shared-save authority on journal failure is repaired: lock ownership remains exclusive while contribution is disabled, and unsafe reload/lock-request failures are non-writable. R4 re-bootstrap/current-authority fencing is implemented: equivalent puzzle objects do not restart ownership, true session changes are non-writable until the new session is hydrated, and stale rendered owner state cannot pass the live write boundary. The repo has no mounted React DOM test environment; adding one would cross the explicit dependency decomposition trigger, so the PR uses deterministic authority/session regressions plus preview/production browser verification and records that limitation rather than silently adding test infrastructure.
3. The portable independent-population comparison contract/service is implemented in `packages/daily`, and the server-only Supabase aggregate provider is implemented and hosted-verified on PR #198. PR #199 defines the portable versioned HTTP response contract in `packages/shared`. PR #200 implements server-side comparison read composition in `apps/web`: date/ruleset/pitch validation, authoritative public-puzzle binding, server-derived puzzle ID/number, existing Daily/Supabase composition, and conservative live `sourceReadAt`. PR #202 implements the thin GET adapters, sanitized HTTP mapping and `private, no-store`. PR #203 provides representative disposable PostgreSQL 17 evidence for the current raw-read design: at 10,000 target observations the actual functions measured 1.807 ms p95 for one AB aggregate and 6.254 ms p95 for completed score buckets. No cache/rollup/index change is justified at this beta checkpoint. PR #204 then made those reads default-on with fail-closed server-only `DAILY_NINE_COMPARISON_READS_DISABLED`; merge `178e58cb6fcb8f09ad9ebc3e6ba69cca7a725a01` is production-verified READY as `dpl_F87hcE51cQT6zhoCp8MgGKwCSX38`, both routes returned versioned HTTP 200 live payloads with `private, no-store`, and the comparison-route runtime scan was clean. The repository port remains deliberately storage-strategy-neutral so a later rollup can replace the provider without UI/domain rewrites. Browser/UI work remains separate and next.
4. PR #206 adds the browser comparison transport/decoder and PR #207 adds the separate request-lifecycle controller. Terminal Daily Nine at-bats and completed games now consume those seams through separate hooks/presentation paths: own results remain immediate, comparison is asynchronous, sample/outage states are explicit, completed BEAT uses Daily-owned strict-lower semantics, and reset/restore fence obsolete reads. Next measure real end-to-end comparison latency and complete mobile/answer-integrity/failure-recovery verification. Preserve independent populations, keep read recovery separate from write retries, and keep all comparison I/O off gameplay's critical path.
5. R5 bounded pending-delivery recovery and R6 malformed-save decoding are repaired. R7 is structurally complete across three bounded browser checkpoints: R7A extracted mutable persistence owner-session mechanics while preserving one React persistence-ordering authority; R7B extracted saved-game restore plus authorized-hint hydration/stale-response fencing; R7C extracts `/api/daily/resolve` transport/single-flight/pending-state lifecycle behind a concrete Daily-specific web client/hook and clears pending UI immediately when authority is invalidated. `DailyInningGame` remains the gameplay state/render/action coordinator rather than being replaced by a generic state machine. R8A now bounds actual request-body bytes before JSON parsing on both anonymous result-write routes with a 16 KiB ceiling and terminal HTTP 413 handling; R8B is now architecturally settled as a Vercel WAF custom rate-limit rule rather than app code: only the two result-write POST paths, IP-bucketed fixed window, provisional 300 requests/10 minutes, log-only before any 429 enforcement. External publication/observation remains pending. R8C now emits sanitized JSON diagnostics only for caught internal 503/500 result-write failures using route/category/status; ordinary success and expected 4xx paths stay silent, raw errors are never logged, and public responses are unchanged. Comparison presentation remains intentionally flexible: issue #216 tracks AVG on normal/shareable scorecards, and per-AB AVG may later be prefetched/shown at AB onset without storage/scoring changes. Continue physical-device/editorial QA. Archive/local history follows the explicit future launch epoch. Remove public Reset before launch.

## Open decisions

- Which beta game becomes the permanent broad-launch product.
- Whether Daily Nine and Classic ever receive separate lineups before that decision.
- Final launch ruleset/scoring contract and launch date / permanent Daily #1 epoch.
- Whether real-device/browser verification disproves the approved Web Lock + local journal mechanism and requires a separately reviewed fallback.
- Classic overall comparison/percentile metric, if any.
- Replay policy for an already-completed archived game beyond preserving the recorded first result.
- Exact Standard Daily recipe thresholds after playtesting.
- Approved All-Star/award/bWAR source workflows.
- Persistence/admin UX for profiles and recipes.
- Automatic publication and emergency correction/versioning.

## Continuity control

Repository docs are the system of record. Every PR has Documentation impact; CI checks material diffs; hosted work is incomplete until START-HERE/todo are reconciled. The documentation-impact check is not yet mandatory branch protection; issue #123 remains open after the owner declined an uncertain ruleset configuration.
