# Initial Baseball — Start Here

Status: Active project handoff  
Last updated: 2026-09-17

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

Product behavior: `docs/product/daily-inning-blueprint.md`.  
Beta/launch/results/archive model: `docs/product/beta-launch-results-archive.md`.  
Lineup content: `docs/product/lineup-content-system.md`.  
Architecture: `docs/architecture-and-scale-plan.md`.  
Answer integrity: `docs/decisions/0001-daily-answer-integrity.md`.

## Current verified state

- PR #158 merged as `603e365b438f15eed1a3a667c9e23e76de98fc45`; it records the settled beta/launch/results/archive model. At the September 17 resume check, main CI passed, production deployment `dpl_6PzqccRdjVdsaqDWHkHFa9GUWiXU` was READY on that exact SHA, `/` and `/classic` returned HTTP 200, `/admin/daily` returned its expected 401 Basic challenge, and production error/fatal logs for the preceding 24 hours were empty. Supabase `initial-baseball-db` was ACTIVE_HEALTHY with RLS enabled on `daily_editorial_puzzles`; no result table exists.
- Completed-result step 4A implements shared schema-1 types and pure engine validation/derivation for `points-v3` and `classic-inning-v1`. The validator binds native facts to the expected puzzle/game, checks exact completion and fact consistency, reuses existing gameplay rules, and returns copied normalized facts plus a game-specific summary. It does not submit/store results or prove honest play. Scope: `tasks/plans/completed-result-contract.md`; contract: `docs/spec/engine.md` and `docs/spec/data-model.md`.
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
- The conversational lineup bridge is now operational. A production smoke test first rejected an ineligible canonical candidate atomically with HTTP 400 and no lineup mutation; the corrected future nine was then persisted in exact batting order, scheduled explicitly, and read back at revision 2 with `scheduled_by`/`updated_by` equal to `chatops:assistant`. Future lineup payloads must never be transported through public GitHub issues/commits/PRs/Actions inputs. Runbook: `docs/operations/daily-lineup-chatops.md`.
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

The points-v3 scorebug presents four equal-width metrics in game order: At bat, Points possible this AB, Points so far, and Strikeouts. Compatibility games keep their existing metrics. Scope: `tasks/plans/daily-nine-scorebug-points.md`.

## Approved September 15–16 direction

Merged PR #140 adds initials → canonical answer → outcome for resolved players, including K/Give Up, plus an isolated spoiler-safe share card with Copy in its upper-right. Browser-only answer retention is additive to schema 3; old saves without names show Answer unavailable. This work is included in the deployed main branch. Scope: `tasks/plans/scorecard-answers.md`.

Daily Nine is currently the default points-v3 beta game and Classic Inning is a separate classic-inning-v1 beta game using the same daily lineup, runner advancement and runs, ending at three outs or nine at-bats. Both may be played on the same date; saves/results/shares distinguish them and unplayed answers stay hidden. PR #141 merged portable policy/label/completion support, PR #155 merged the signed server transport/progression seam, and PR #156 merged `/classic`, navigation, isolated Classic saves, game-aware refresh/reset/results/sharing, and hidden unplayed answers while preserving existing Daily/legacy compatibility.

The owner is keeping both games during beta to collect friend/user feedback, but realistically expects to choose one for broad launch. New shared infrastructure should therefore be game-aware without doubling expensive game-specific systems. Classic can later be disabled/removed without corrupting Daily Nine; the current shared lineup can also be separated later without redefining completed-result identity. Detailed source: `docs/product/beta-launch-results-archive.md`.

## Settled future systems

### Canonical player facts versus gameplay profiles

One authoritative canonical player system is enriched from reproducible sources. Objective facts stay in baseball-data. Editable gameplay profiles separately describe recognizability, expected difficulty, Standard Daily eligibility, expert-only status, manual promotion/exclusion, notes, and later observed solve rates.

### Recipe-driven lineups

Standard Daily is one versioned recipe, not the only selector. Recipes may define slot groups, sourced factual filters, gameplay-profile filters, repeat protection, duplicate prevention, reveal readiness, and diversity constraints. The generator proposes; the editor reviews, replaces, validates, and schedules the exact nine.

### Completed results and comparison

Future aggregation uses one compact idempotent completed-game submission from stable puzzle identity, ruleset/game identity, and native raw at-bat facts. The portable schema/engine validator is implemented for `points-v3` and `classic-inning-v1`; it validates against caller-supplied authoritative puzzle/game context and derives summaries rather than trusting a submitted total. Repository/service idempotency, provider persistence, the API, and browser submission remain separate pending work. No per-action database writes.

Daily Nine comparison includes the player's points on each at-bat versus that at-bat's average plus total average/distribution/percentile for the same Daily/ruleset. Classic is a separate comparison population using baseball-native measures such as runs, hits, at-bats reached, per-at-bat outcomes, strikeout rates, and reach rates. A single Classic percentile metric is not settled.

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

Verified September 16:

- PRs #152 and #153 are merged and active in production;
- the Supabase connection targets `initial-baseball-db` / `dwreeiydvwikpamlokji`;
- `private.dispatch_daily_lineup_chatops(...)` forwards through `pg_net` to the authenticated server adapter and does not write editorial tables directly;
- the matching bearer credential is stored only in Vercel server environment and Supabase Vault;
- an invalid candidate failed atomically before mutation;
- a corrected future nine was persisted in exact order, explicitly scheduled, and read back with `chatops:assistant` attribution.

Remaining hosted editorial checks:

- seven-day Supabase horizon and missing-draft generation;
- player preview/search/replacement and validation through the authenticated editor workflow;
- public scheduled/published consumption for an editorially scheduled future puzzle;
- deterministic fallback for missing/draft records.

## Exact next work order

1. Complete the remaining interactive/physical iPhone/iPad presentation, terminal/refresh/share, and PR #133 latency QA without treating both beta games as permanent launch commitments.
2. Implement the provider-neutral completed-result repository/service boundary on the completed 4A contract. Define/test atomic same-ID/same-normalized-payload retry and same-ID/different-payload conflict behavior; keep Supabase/API/browser integration in subsequent bounded PRs.
3. Add a separate Supabase current-results migration/adapter and one completed-game submission route.
4. Add same-Daily/same-ruleset per-at-bat and whole-game comparison; settle percentile tie/sample-size rules before percentile UI.
5. Build permanent archive/local-history infrastructure that starts from the future explicit launch Daily #1 rather than importing beta history.
6. Before broad launch, choose the primary game/final rules and launch epoch, then continue gameplay-profile/lineup-recipe calibration, analytics/monitoring, legal/domain/social metadata, and launch polish.

## Open decisions

- Which beta game becomes the permanent broad-launch product.
- Whether Daily Nine and Classic ever receive separate lineups before that decision.
- Final launch ruleset/scoring contract and launch date / permanent Daily #1 epoch.
- Exact percentile tie treatment and minimum sample display.
- Classic overall comparison/percentile metric, if any.
- Replay policy for an already-completed archived game beyond preserving the recorded first result.
- Exact Standard Daily recipe thresholds after playtesting.
- Approved All-Star/award/bWAR source workflows.
- Persistence/admin UX for profiles and recipes.
- Automatic publication and emergency correction/versioning.

## Continuity control

Repository docs are the system of record. Every PR has Documentation impact; CI checks material diffs; hosted work is incomplete until START-HERE/todo are reconciled. The documentation-impact check is not yet mandatory branch protection; issue #123 remains open after the owner declined an uncertain ruleset configuration.
