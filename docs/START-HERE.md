# Initial Baseball — Start Here

Status: Active project handoff  
Last updated: 2026-09-18

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

Initial Baseball is currently beta-testing **Daily Nine** and **Classic Inning** as two distinct browser-first games over the same daily nine-player puzzle. The owner expects friend/beta feedback to determine which game becomes the primary/sole broad-launch product. The shared lineup is a current choice, not a permanent identity constraint; either game must remain removable without corrupting the other game's data.

Current Daily numbering is beta. At a later explicit broad-launch decision, the permanent sequence restarts at **Daily #1** and current beta history is not imported into the permanent archive. Settled launch/results/archive direction: `docs/product/beta-launch-results-archive.md`.

Standard Daily should be difficult because recall and hints are difficult, not because players are arbitrarily obscure. Except for a possible final deep-challenge slot, a reveal should normally prompt: **“I could have gotten that.”**

The game should feel immediate, accurate, and recognizably baseball.

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

The 4D foundation now includes portable schema-1 points-v3 AB transport, pure engine validation/derived points, the Daily first-write-wins repository/service, and a server-only Supabase provider. Scope: `tasks/plans/resolved-at-bat-contract.md`, `tasks/plans/resolved-at-bat-repository.md`, and `tasks/plans/resolved-at-bat-supabase-provider.md`. PR #174 remains draft; its equal-population invariant is superseded by replacement roadmap PR #175. Hosted table/migration/privileges and isolated atomicity are verified, but no route or browser collection is active. The next implementation concern is the web submission API using authoritative puzzle context; browser identity/cross-tab coordination, comparisons and UI remain pending.

## Current verified state

- September 18 production result collection is now proven end to end on the PR #171 activation baseline. A fresh real-browser Daily #144 / `points-v3` session completed with nine Give Ups and created exactly one `public.daily_completed_results` row at `2026-09-18 06:16:47.384891+00`. The persisted row carried the expected puzzle/ruleset identity, nine ordered native Give Up facts, and engine-derived zero-point summary. Replaying the exact stored schema-1 payload with the same `submissionId` through production `POST /api/daily/results` returned HTTP 200 `{"status":"existing"}` and the table remained at exactly one row with the same receipt timestamp. The surrounding Vercel runtime-error scan was clean. PR #171 remains the activation code baseline (`ae2fc428b2fad05685b068944acce66b9dddf536`, production deployment `dpl_DctrheRJbonPmcszrjAfPuJxvzhy`); PR #172 reconciled the pre-proof handoff. Completed-result 4A/4B/4C is therefore operationally complete, and 4D Daily Nine comparison is the next bounded concern. Draft PR #161 remains unmerged and must not be merged unchanged.
- Resolved-AB provider migration `20260918185110_create_daily_at_bat_results` is applied while collection remains inactive. The table uses composite first-write-wins identity `(attempt_id, puzzle_id, ruleset_version, pitch_number)`, a separate puzzle/ruleset/slot population index including derived points, RLS with no policies, no `anon`/`authenticated` grants, and `service_role` `SELECT, INSERT` only. Two simultaneous disposable same-key inserts produced one winner; the verification row was removed and hosted row count returned to zero. Scope: `tasks/plans/resolved-at-bat-supabase-provider.md`.
- The public source now reuses the same canonical editorial-candidate factory as the admin workflow, so approved manual-only players resolve without widening automatic generation. Focused tests cover scheduled/published order, canonical identity, rejection, fallback, and archived behavior. Scope: `tasks/plans/public-editorial-candidates.md`. Exact merge-SHA production deployment is verified READY as `dpl_APaPW1hwmzghnoRg4fEXhcFnNCCw` on `0001f51c15b9e7b4e5e9647ce471365a96f19bc7`.
- Completed-result step 4A implements shared schema-1 types and pure engine validation/derivation for `points-v3` and `classic-inning-v1`. The validator binds native facts to the expected puzzle/game, checks exact completion and fact consistency, reuses existing gameplay rules, and returns copied normalized facts plus a game-specific summary. It does not prove honest play. Scope: `tasks/plans/completed-result-contract.md`; contract: `docs/spec/engine.md` and `docs/spec/data-model.md`.
- Completed-result step 4B implements the provider-neutral atomic repository/service boundary in `packages/daily`. `insertIfAbsent(result)` is the first-write-wins repository primitive keyed by `submissionId`; identical retries return the existing normalized result, while same-ID/different-payload retries return `idempotency_conflict` without overwrite. The service consumes 4A output and does not re-run validation/scoring. The current provider step adds the reconciled `daily_completed_results` migrations plus a server-only Supabase row codec/adapter that inserts first and reads the existing winner only after a PostgreSQL unique-key conflict. It has no update/upsert path and does not validate gameplay. Scope: `tasks/plans/completed-result-supabase-provider.md`. The completed-game API is the separate web/server layer described in `tasks/plans/completed-result-submission-api.md`; the browser retry adapter is described in `tasks/plans/completed-result-browser-client.md`; native activation is implemented by `tasks/plans/completed-result-native-activation.md`. The September 18 controlled production proof confirmed one real browser completion created one row and an exact same-ID replay returned the existing result without increasing row count. Comparison work may now proceed.
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

PR #174 was inspected at `38f3bc9` and converted to draft. Do not merge unchanged: its every-AB-count-equals-completion-count rule is invalid for this product. Current main inspected at `2a737a2`. No new AB collection or comparison implementation is live. Current browser identity starts at completion; progression tokens have no attempt ID/history. Cross-tab coordination must be designed/tested before activating earlier identity and AB delivery. Full replacement scope, old-save policy, failure states and ordered PRs: `tasks/plans/resolved-at-bat-comparison.md`.

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

1. Replacement roadmap #175, portable contract/validation #176, and repository/service #178 are merged. Keep #174 draft.
2. Land the implemented resolved-AB Supabase provider, then implement the separate web submission API concern in `tasks/plans/resolved-at-bat-comparison.md`.
3. Resolve/test browser attempt ownership across tabs, reset, existing saves and delivery before activating collection. New identity must preserve old pending completed-result payloads.
4. Implement and benchmark independent-population reads; then add asynchronous per-AB and final comparisons. Do not claim measured capacity or current hosting prices without checking.
5. Continue outstanding physical-device/editorial QA; archive/local-history follows the explicit future launch epoch. Remove public Reset before launch.

## Open decisions

- Which beta game becomes the permanent broad-launch product.
- Whether Daily Nine and Classic ever receive separate lineups before that decision.
- Final launch ruleset/scoring contract and launch date / permanent Daily #1 epoch.
- Concrete atomic browser coordination mechanism and supported-browser fallback before AB collection activation.
- Classic overall comparison/percentile metric, if any.
- Replay policy for an already-completed archived game beyond preserving the recorded first result.
- Exact Standard Daily recipe thresholds after playtesting.
- Approved All-Star/award/bWAR source workflows.
- Persistence/admin UX for profiles and recipes.
- Automatic publication and emergency correction/versioning.

## Continuity control

Repository docs are the system of record. Every PR has Documentation impact; CI checks material diffs; hosted work is incomplete until START-HERE/todo are reconciled. The documentation-impact check is not yet mandatory branch protection; issue #123 remains open after the owner declined an uncertain ruleset configuration.
