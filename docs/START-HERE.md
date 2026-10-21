Warning: truncated output (original token count: 43023)
Total output lines: 894

# Initial Baseball — Start Here

## October 21 — Live project state reconciled

- GitHub `main` is `54e559fcd48dd74dd90110d98a0d4cb5716999f7`; exact-main CI run `39530643699` passed its test job. The documentation-only job was skipped on the push, as configured.
- Vercel production deployment `dpl_88WqXruZcHKMACiUY7kEg4hz6Lqq` is READY on the same SHA. Homepage, `/archive`, and `/classic` returned 200; `/create` returned 404. Production Custom tables and creation-budget counters are empty.
- Isolated QA project `iklbnlicgsxxhaoiscor` is ACTIVE_HEALTHY and remains separate from production. Read-only SQL found 12 issued challenges, 12 attempt states, 12 completed results and 57 at-bat results from the October 18 hosted run; creation-budget counters are empty. The run proved the existing 1–10 signed gameplay path, but did not exercise the later public no-sign-in creator route.
- PR #459's explicit-grant CI gate is merged and runs for new `public` table migrations; `tasks/todo.md` no longer treats it as pending.
- The only open PR is draft #434, intentionally deferred. Custom public creation remains default-off. Remaining release gates: credential-backed public creator → owner → friend QA against isolated QA, route-scoped WAF/rate-limit inspection and enforcement evidence, physical iOS/Android acceptance, and a rollback drill.
- Vercel's active firewall configuration API still responds `404 Seawall Config not found`; the browser currently opens Vercel's sign-in page. No firewall rule or project configuration was changed. This is not evidence that WAF is active or inactive.
- Production runtime error/fatal query for the latest 30 minutes returned no records. A 24-hour request is outside the Hobby runtime-log retention window.


## October 20 — Real Vercel ingress probe completed; launch still gated

Temporary **unmerged** PR #466 tested seven ordinary and forged forwarded-IP
requests through a READY Vercel Preview. All returned matching edge-provided
headers, rejected injected test sentinels and passed the existing Custom quota
IP parser. The diagnostic PR was closed unmerged; no IPs were logged. Full
record: `tasks/plans/custom-v2-live-vercel-ingress-evidence.md`. Isolated QA
also passed seven rollback-only Custom DB tests with no fixture persistence.
**Still blocked:** real credential-backed creator/friend HTTP QA, active
route-scoped Vercel WAF validation (current config endpoint 404), and physical
mobile/rollback acceptance. Production Custom flags remain **OFF**.

## October 20 — Repeatable Custom creator browser QA (PR #465)

Staged default-OFF Custom creator UI has a repeatable localhost-only Chromium
acceptance harness in `apps/web/scripts/qa-custom-creator-browser.mjs` and scope
in `tasks/plans/custom-v2-local-browser-acceptance.md`. It checks creator
lengths 1–10, nine initial slots, canonical player search with career metadata,
two-tap swaps, duplicates, issued batting order, separate owner credential,
keyboard access, and 320–1280px responsive layout. Search/issue are simulated;
this does NOT establish hosted Supabase issuance, actual Vercel ingress/WAF,
signed friend play, Safari/iOS device acceptance, or permission to enable
production Custom flags. Keep real hosted QA and rollback/security checks open.


## October 21 — My Results is shipped

PR #462 added read-only My Results from exact-identity completed game records retained in the current browser. It preserves original scores and at-bat outcomes without re-admission, practice substitution, inferred history or answer lookups. It is included in current production `54e559f`; Custom Lineups remain the highest-priority unfinished product launch.


## October 20 — Numbered Custom creator staging

Owner-approved Custom v2 creator UX defaults to nine numbered vertical slots (selectable
1–10). Each slot uses existing canonical player search with MLB years and career teams,
allows replacement, and supports two-tap Swap rather than drag-and-drop. Only fully
populated, unique, ordered selections can be issued. Legacy v1 admin mode remains
unchanged. This is a **default-OFF staged UI**, not authorization to enable public
Custom creation, change gameplay or claim end-to-end hosted QA. Scope:
tasks/plans/custom-lineup-slot-creator.md; PR #463.


## October 20 — Display-name autocomplete relevance

PR #460 is merged and production-verified at `7c4584e` (main CI #39488294439 SUCCESS; production `dpl_823ZbayzX9jnNdigEBsGXaW1iivL` READY; canonical routes and recent error/fatal scan clear). Sourced team chronology preserves frozen hints. Current bounded work rejects hidden middle-name-plus-surname fragments such as Cam u while preserving useful display-name and alias search. Scope: `tasks/plans/display-name-search-relevance.md`. Custom creation remains gated; #434 stays deferred.


## October 20 — Sourced intra-season team chronology

Bobby Abreu exposed #451's invalid alphabetical same-year fallback. The bounded correction restores pinned Lahman stint evidence for all represented multi-team seasons, shares ordering between canonical reveals and prospective Teams hints, and preserves genuine returns. Existing issued hints remain immutable. Scope and release evidence: `tasks/plans/team-stint-chronology.md`. Public Custom activation remains OFF; #434 remains deferred.


## October 18 named Custom publishing/search direction (#441)

The owner confirmed **every new Custom Lineup must have a name**, private by default, and eligible for later deliberate public publishing through a separate anonymous-owner management capability (not the playable URL or creator-preview cookie). Title validation, private issued-title storage, the default-off no-sign-in issuer and `/create` UI are staged and merged. Public Discover searches titles and voluntary creator display aliases; weekly/all-time counts include only accepted noncreator completed first attempts, not views or replays. Publishing and Discover follow the private 1–10 launch gates. Plan: `tasks/plans/community-custom-lineups.md`; issue #441.

Status: Active project handoff  
Last updated: 2026-10-21

Use this file to resume work. It records verified current state, settled future requirements, genuinely open decisions, and the exact next bounded work. Pull requests and `tasks/lessons.md` retain history.

## October 18 #439 merged and public creation Web boundary staged

PR #439 merged at `6cb676e` after 32 real independent local PostgreSQL connections produced 10 allowed/22 denied; an observed held advisory lock forced another session to wait 3,923 ms. A real UTC-midnight transition was not exercised. Production installed the exact reviewed additive source as hosted migration `20261018193404`. Read-only inspection confirmed RLS on, invoker RPC granted only to `service_role`, browser roles denied, and zero counter rows. QA is inactive. This PR now stages the default-disabled no-sign-in creation POST using verified Vercel client IP and server-only day-scoped HMAC; no public UI or activation is included. Database-authoritative UTC-day quota reconciliation is a separately scoped dependency (#443). No production secret/flag activation, public page or browser acceptance is implied; see `tasks/plans/public-custom-lineup-creator-route.md`. Previous draft checkpoint below is historical.

## October 18 no-sign-in creator decision and durable budget staging

The owner chose **no sign-in required** for ordinary-user Custom creation; optional accounts/cross-device history remain later. The database-only draft stages a private atomic budget (10 creation attempts/IP digest/10 minutes; 1,000 globally/day). Isolated QA migration `20261018192340` and its single-session rollback fixture passed; zero budget rows remain. Production schema is untouched. Actual concurrent contention/rollover verification remains outstanding; a connected-tool timing probe did not establish overlapping sessions. It is not a public API or an activated rate limit: trusted-IP/HMAC Web integration and creator UI follow separately. One stable transaction lock covers date rollover and lazy expiry. No game tables, public database grants, flags or firewall settings change. Scope: `tasks/plans/custom-lineup-creation-budget.md`.

PR #438 merged as `1c878cd`; main push CI #39157241273 SUCCESS and exact-main production `dpl_DFgSy8ZhSzW5KWkroPdEcthkchfB` READY. Fresh homepage/Archive/Classic probes passed; disabled v2 page 404 and unauthenticated admin creator 401. No error/fatal logs in the inspected deployment window. Production Supabase healthy, QA paused after the completed acceptance run; QA was subsequently restored for this budget regression. Only preserved draft #434 remained open at that checkpoint.

## October 18 real hosted Custom acceptance — passed; public release still gated

The real Next.js production-server HTTP→isolated Supabase suite passed for every N=1–10, third-strike and Give Up, using baseline bb952dc plus the runner-only loopback origin fix. NextRequest normalizes 127.0.0.1 to localhost; the old runner Origin therefore received 403 before issuance. Only QA request URLs changed; server binding, strict app origin checks, production-ref denial and public flags remain unchanged. Six startup/origin guards pass and CI now runs them.

QA counts went from zero to 12 issued / 12 completed attempts / 12 accepted results / 57 at-bat rows. Production Custom counts stayed zero. The owner-approved QA-only credential was copied privately into a disposable sandbox, then its file was removed and transfer server stopped; no persistent QA secret provisioning is claimed. QA pause was requested after the run, retaining fixture evidence. Full evidence/scope: `tasks/plans/custom-v2-hosted-origin-alignment.md`. Ordinary-user creator authorization, durable abuse/rate limits, live browser-to-QA/mobile/v1 checks and controlled activation remain outstanding. The separate My Results page shipped in PR #462; Custom release gates remain separate.

## Custom creator share-link staging

PR #435 merged as `13bf0cda1b4372956a2ca457346a9ec9d8b530c8`; exact-main push CI passed and Vercel production `dpl_CkXfgGw4AWkRC7Lqtz5aPvRMHfoN` is READY. The isolated QA project is now ACTIVE_HEALTHY. Read-only checks found zero issued, attempt, completed-result and at-bat Custom rows in both QA and production. QA server credential provisioning remains blocked by browser sign-in; no production key was used.

The existing admin-only v2 creator now offers an answer-free same-origin challenge URL, Copy challenge link with a selectable fallback, and creator preview when the server gameplay gate is enabled. With the flag OFF (including production), links remain hidden and the existing ID-only staging flow stays available. No public creator/API/competition activation or hosted HTTP success is implied. Scope: `tasks/plans/custom-lineup-creator-share-link.md`.

## October 17 corrected priority and restored environment

The owner superseded the fixed-five roadmap: **Custom Lineups first**, unlisted by default, with secure ordinary-user creation, share links and friend gameplay. Current creation is admin-only and therefore does not satisfy that goal. Public Discover/publishing/leaderboards are deferred. Future **Daily Lineup** uses administrator-selected supported lengths frozen into issued contracts; preserve nine-player history, Archive, scoring and Classic. Existing five-only staging is historical groundwork, not launch authorization. Keep its write flag OFF. Active direction and bounded next work: `tasks/plans/custom-first-variable-daily-direction.md`.

Verified baseline: GitHub main `0ac48c90797ed9405ce874ba1a00682826eb740b`; Vercel production `dpl_BDpa1tMRkAMEmLvchPDnWZxmSVKQ` READY on that SHA. PR #434 (`4ab30dd`) remains unmerged and was converted to draft: its read-only calendar seam may be reusable, but contract-2=five assumptions require reassessment and must not delay Custom. A fresh nonpersistent Vercel Sandbox was successfully created; the earlier storage creation blocker did not reproduce. No snapshots were deleted, storage allowance reset was not established, and recovery state was preserved. A local checkout also succeeded.

Production Supabase `dwreeiydvwikpamlokji` was ACTIVE_HEALTHY. Isolated QA `iklbnlicgsxxhaoiscor` was INACTIVE; restoration was requested successfully. Verify health before executing QA. No production credentials, application data or database schema were changed. The hosted HTTP runner still needs a securely provisioned QA-only service credential; connected tools expose publishable keys only. No hosted HTTP success or public Custom activation is claimed.

## October 17 read-only shared calendar inspection — staging

Future Daily Five administration now offers a private date-occupancy preview that reads only puzzle_date, lineup_contract_version (nine/contract 1 or five/contract 2) and lifecycle status, with no player IDs or hints. Unexpected versions and provider failures are not considered vacant. The draft editor blocks Save until the date is confirmed empty; this is advisory only and does not replace the database unique-date constraint. The server-side Daily Five draft write flag remains OFF, and the legacy nine-only horizon is NOT altered. See tasks/plans/daily-five-calendar-occupancy-preview.md. Safe mixed-version horizon/scheduling and issuance remain a separate stage.

## October 17 admin-only prospective Daily Five draft editor — gated staging

Authenticated Daily administrators can now open /admin/daily-five to build an ordered exact-five canonical-player draft by searching, adding, rearranging or removing players and selecting a date. A separate POST only accepts authenticated same-origin bounded JSON, validates the domain contract, and uses the existing v2 insert-only repository. **Production writes remain explicitly OFF** unless DAILY_FIVE_DRAFT_WRITES_ENABLED=true is configured after future calendar/issuance coexistence review; the normal UI cannot Save in the default state. The Daily Nine horizon and Classic/Archive issuance remain unchanged. See tasks/plans/daily-five-admin-draft-editor.md.

## October 17 isolated Daily Five draft storage — staged, not activated

A separate server-only database adapter can read/insert untouched five-player editorial drafts under contract 2. The legacy nine-player adapter explicitly reads contract 1 and inserts contract 1; its optimistic revision updates require contract 1. All future-five decoding checks exactly five ordered, distinct canonical IDs, draft status, revision zero and lifecycle metadata. No admin or public caller imports the new adapter and no production database writes, migrations or public feature flags are involved. See tasks/plans/daily-five-draft-storage-adapter.md. The next step remains a separately reviewed admin-only draft workflow followed by distinct issuance and compatibility work.

## October 16 prospective Daily Five editorial draft — pure domain stage

The approved five-at-bat future Daily now has a version-marked, draft-only portable constructor reusing the existing calendar, actor and lineup validation. It demands exactly five ordered, distinct canonical selections (contract 2). Current nine-player editorial draft creation remains nine-only and unchanged. This step performs **no database write, scheduling, publication, issuance, runtime, UI or feature-flag change**. See tasks/plans/daily-five-prospective-editorial-draft.md. Next requires separately reviewed version-aware persistence/editor and prospective issuance without changing historical Daily/Archive/Classic.

## October 16 hosted QA runner adapted for Supabase Free standalone project

A bounded staging-only runner change now accepts the existing separate Supabase QA project instead of requiring a paid database branch. It pins the production ref exclusion, verifies the exact HTTPS project URL, and exercises every Custom Lineup length N=1–10 plus third-strike and give-up in its eventual real HTTP acceptance. Four no-network startup-guard tests pass. The QA project remains paused; a securely provisioned QA-only server credential and an actual runner execution are **still required** before hosted application gameplay can be called verified. See tasks/plans/custom-v2-standalone-hosted-runner.md and tasks/plans/custom-lineup-v2-hosted-qa-runner.md; no public flag change.

## October 16 Custom v2 mobile QA and recoverable terminal restore error

Browser viewport QA (Chromium, local mock HTTP) exercised Custom v2 N=1/5/9/10 at 320/375/390/430px; all exact-N scorecards fit without horizontal scroll, and creator N=10 selection fit at 320px. A real UI defect was reproduced: when server bootstrap failed after clicking Next batter on a committed terminal reveal, the existing sanitized error state was invisible. A bounded web-only follow-up shows the error on the terminal panel without hiding the authorized reveal or removing retry. See tasks/plans/custom-v2-terminal-retry-feedback.md. This is NOT full hosted HTTP-to-Supabase acceptance. Custom public flag remains disabled.

## October 16 hosted PostgreSQL v2 all-length verification — passed, HTTP still outstanding

After PR #426 (main `824cd8d8ee17708d8b28e75b8a2e29333d9d46d8`, push CI SUCCESS, production READY), a standalone no-cost Supabase QA project was created because branch creation requires a Pro organization. Only the ten Custom v1/v2 SQL migrations were applied; production-directed Daily ChatOps and scheduled rollover were excluded. Five rollback-only SQL fixtures passed on the hosted QA database with N=1–10 coverage, including validation, attempts, results, atomic admission and comparison buckets. The existing legacy v1 comparison fixture passed as well; the four Custom table populations in both staging and production remained zero.

This is **hosted database QA only**, not a completed app-to-database HTTP or mobile/browser test. A staged server-only Supabase secret is not available through the connected tools; do not use production keys or weaken private grants. PR scope: `tasks/plans/custom-v2-hosted-postgres-all-lengths.md`. Public Custom remains OFF, and a separate hosted HTTP, responsive, abuse/privacy and activation gate remains.

## October 16 hosted QA milestone — staged runner, not a passed hosted test

PR #425 is merged at b2d8689683254fa7d7a357b0ef6f4f104b16fb67.
Main CI run 38841759530 succeeded; production Vercel deployment
dpl_B6axVWJ98LrZaxfkMpQa2fP7ZD79 is READY on that SHA, and
Supabase remains ACTIVE_HEALTHY. No open PRs at this checkpoint.

The next bounded work adds a local application to isolated hosted Supabase branch
HTTP acceptance runner and expands mocked protocol and issuer coverage to
every supported N=1–10, without opening public Custom gameplay. The new script
launches its own localhost Next.js process with the validated isolated
branch environment, pinned production-project exclusion and opt-in flag. A successful local
syntax check or mocked test is NOT hosted E2E evidence. See
tasks/plans/custom-lineup-v2-hosted-qa-runner.md for the runbook and
remaining prerequisites. Branch creation has a separately confirmed hourly
cost; do not create it or run against production without consent.

## Completed PR #425 — JSON media type for Custom v2 gameplay mutations

The flag-gated Custom Lineup v2 `hint` and `resolve` actions already parse a bounded JSON body but currently accept valid JSON under `text/plain` or missing JSON media types. Require `application/json` (optional media type parameters) before stream parsing and service calls, matching the shipped v2 browser transport. Leave bodyless `bootstrap`/`submit` untouched, preserve no-store/same-origin checks, keep the flag OFF, and test valid/invalid media types. This is request protocol hardening, not a substitute for IP/credential throttling, hosted gameplay QA, CSRF defense, or approval to activate. Scope: `tasks/plans/custom-lineup-v2-json-media-type.md`.

## Verified search hardening PR #423 and rejected PR #424

PR #423 merged as `7548f2f4bad4fe15666d45c3e68466cdfdf4e152` after exact-head CI, READY Preview and independent review. Main push CI SUCCESS (38829485147), production Vercel `dpl_A3LtWnT5FYKdSaA7njff6fmXmVCC` READY on that exact SHA, canonical homepage/Archive/Classic HTTP 200, disabled v2 Custom example 404, Supabase healthy, zero open PRs at checkpoint and no production error/fatal logs inspected. Trimmed `/api/players/search` queries over 100 characters now short circuit before canonical candidate loading; **not rate limiting**. Scope: `tasks/plans/canonical-player-search-query-bound.md`.

PR #424 was **closed without merge** after the independent reviewer correctly identified that its proposed resolve-action key validation was redundant with the existing two-property constraint. No PR #424 code reached main or production.

## Verified unlisted Custom Lineup metadata PR #422

PR #422 merged as `7b3982e5bc7ac5c67c90f1dd0c7a43234fa27fcc`, after successful exact-head GitHub CI, READY Preview, and independent review with no blocking findings. Generic noindex/nofollow/nocache and no-referrer metadata is attached only to the private Custom challenge route; default-disabled gameplay is unchanged. Exact-main push CI SUCCESS (workflow 38828635251), Vercel production `dpl_3wwNXrWcp4wHUmZZawk2Cuo4nkaB` READY on the matching SHA, and no public Custom v2 activation. Production runtime errors/fatals were absent in the inspected interval; live mobile browser QA remains outstanding.

## Custom Lineup v2 unlisted-page metadata privacy — implemented

Merged #422 page-only release safeguard: future flag-enabled private `/custom/{v2-id}` pages explicitly set generic non-answer metadata, `robots` noindex/nofollow/nocache and no-referrer. Unlisted URLs are not approved community directory listings. This is indexing/referrer hygiene, **not authentication, crawler secrecy, public activation, or a substitute for staging QA**. Scope: `tasks/plans/custom-lineup-v2-private-page-metadata.md`. After this PR: isolated full-stack 1/5/9/10 QA, physical mobile inspection, anti-abuse/privacy controls, and explicit release authorization.

## Verified v2 browser-to-HTTP acceptance PR #421

PR #421 merged as `8f83404e523327d77649ce2559dbdb88e0bda54c`. Exact-head CI SUCCESS, Preview READY; independent review identified four test-fidelity/privacy issues which were corrected and threads resolved. Exact-main push CI SUCCESS and production Vercel `dpl_4DcqUodjtt3Q76JmtGgvhJQJj7QR` READY on matching main; Supabase ACTIVE_HEALTHY, no errors/fatals observed in recent production logs and zero open PRs. Direct homepage and Archive checks 200, disabled Custom v2 example 404; admin route required authentication. No public Custom activation.

## Custom Lineup v2 browser-to-HTTP contract QA — implemented

Merged #421 test-only acceptance integrates the existing versioned browser transport and HTTP handler with deterministic private service fixtures at N=1/5/9/10. It checks resume, earned hint depth, wrong/terminal outcomes, points-v4 limits, idempotent submission and creator ineligibility, plus default-off behavior. **This is not full hosted DB or physical mobile E2E.** No runtime flag changes. Scope: `tasks/plans/custom-lineup-v2-browser-http-acceptance.md`; next isolated staging + real browser/mobile QA, abuse/privacy threat-model and controlled rollout.

## Verified Custom Lineup creator PR #420

PR #420 merged as `6189206759acb1a13d72dfd8ca3d99e5d10b9a14`. The independent review's initial import finding was fixed, final exact-head CI and Vercel Preview passed, exact-main push CI SUCCESS, production Vercel `dpl_ABjLUMUzHkxcJAyz3wRfjJT6Pkbu` READY on matching SHA, Supabase ACTIVE_HEALTHY and no error/fatal runtime logs in the inspected window. No public Custom gameplay activation and zero open PRs at checkpoint. Fresh direct route-HTTP probing and protected-preview mobile browser QA remain unverified.

## Custom Lineup v2 r…31023 tokens truncated…lution progression, and reuses engine `isDailyGameComplete` so Classic stops at three outs or batter nine with no successor hint bundle. Scope: `tasks/plans/classic-web-transport.md`.
- PR #156 merged as `cf92eb2ac1a16ef732396e2c8fe44d9f86454db4`. It activates `/classic`, keeps `/` as Daily Nine, shares the existing game component, isolates Classic browser saves from the existing Daily key, makes reset/refresh/share game-aware, and changes a terminal Classic continuation to `View Results` so an unplayed batter is never advanced to or exposed. Production deployment `dpl_5TBWWVyAUpwVtnouotnSBk79Lhgr` is READY and canonically aliased. Both `/` and `/classic` returned HTTP 200 for Daily #143 with the same public puzzle/initials and signed `points-v3` versus `classic-inning-v1` game identity respectively; the build exposed both routes, hidden-answer QA passed for two initial payloads, and no error/fatal runtime logs were present at verification time. Scope: `tasks/plans/classic-browser-experience.md`.
- Physical iPhone spot-check on September 16 confirmed the Daily Nine/Classic navigation is present, switches cleanly, and active saves/hint state are independent. The broader terminal/refresh/share/latency/device matrix remains outstanding.
- September 16 product decisions now treat Daily Nine and Classic as competing beta games. Playing one does not count as playing the other; result/comparison/history populations remain separate. Current shared lineup content is not a permanent identity constraint, and either game may ultimately be removed without rewriting the survivor. Permanent numbering/archive starts only after an explicit future reset to Daily #1. Source of truth: `docs/product/beta-launch-results-archive.md`.

## Implemented gameplay

New Daily Nine sessions use `points-v4`:

- correct on initials awards 4 points; hints 1–4 award 3, 2, 1, then 0.5;
- wrong guesses one and two do not deduct points;
- a third wrong guess or Give Up records K and awards 0;
- all nine scheduled at-bats are played, for a 36-point maximum;
- the resolved at-bat shows both its baseball outcome and awarded points;
- raw facts preserve slot, initials, outcome, hints revealed, wrong guesses, and correct/K/Give Up resolution;
- ruleset version flows through token, local state, result, and share output;
- compatible `points-v1` sessions retain `5/4/3/2/1/0` and a 45-point maximum;
- compatible old sessions remain `legacy-inning-v1` with prior three-out behavior and no misleading point copy.

`points-v4` is the current Daily Nine beta policy, not yet a frozen permanent-launch promise. Historical `points-v3` remains exact-version compatibility only. Any later scoring change requires a new ruleset version rather than mutating persisted v4 history.

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

Daily Nine is currently the default points-v4 beta game and Classic Inning is a separate classic-inning-v1 beta game using the same daily lineup, runner advancement and runs, ending at three outs or nine at-bats. Both may be played on the same date; saves/results/shares distinguish them and unplayed answers stay hidden. PR #141 merged portable policy/label/completion support, PR #155 merged the signed server transport/progression seam, and PR #156 merged `/classic`, navigation, isolated Classic saves, game-aware refresh/reset/results/sharing, and hidden unplayed answers while preserving existing Daily/legacy compatibility.

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

### Active: AB BEAT and small samples

The owner approved per-AB and final BEAT with one other result and colors based on arithmetic AVG (strictly higher green, equal/lower red). #316 completed and production-verified the portable distribution contract; #317 did the additive service-only filtered Supabase reads; #318 carried the durable first-attempt ID through current-Daily comparison reads, including after Reset. The final current-Daily presentation stage now preserves the served AB histogram through browser state, displays strict-lower BEAT plus AVG with one other result, and uses explicit "Above AVG" / "At or below AVG" text alongside green/red so color is not the only signal. Zero-other populations remain withheld; archive browser activation, scoring and result-write semantics are unchanged. Scope/status: `tasks/plans/ab-beat-and-small-samples.md`.

### Comparison presentation release checkpoint — PR #319

Current-Daily presentation is merged and production-verified at `c2543f9085714e5e27cc2676ea77b2ebf9792382`: exact-head CI #1082, READY Preview `dpl_AwGsMBdRdnKKdUkYXEi2F7MEfzbj`, main push CI #1083, and READY canonical production `dpl_EP7P74RHD4PxKw9EZLG7LHgcVK3g`. Read-only recheck confirmed canonical root/both private-no-store comparison routes, clean release-window error/fatal logs, and unchanged service-role-only v2 Supabase function posture. Original threshold plans are historical; current policy and detailed evidence live in `tasks/plans/ab-beat-and-small-samples.md`. Archive comparison activation and issue #320 remain separate.

### Initial-based canonical display names — issue #320

The bounded data-layer implementation compacts leading dotted uppercase given-name initials in canonical universe generation, preserving the source spelling as a search alias. Search/index and reveal artifacts consume the same canonical display name; identity snapshots, redirects, gameplay-name inputs, puzzle initials, scoring and persistence remain unchanged. Scope and verification: `tasks/plans/initial-based-display-names.md`. Exact release evidence belongs in the implementing PR; physical-device QA remains separate.

## Custom Nine signed terminal evidence checkpoint (October 10)

Custom Nine terminal guess/Give Up resolution emits a domain-separated HMAC receipt for the server-derived terminal observation and pre/post progression token digests. Incorrect nonterminal guesses receive `terminalReceipt: null`. This adds no competitive writes. Existing Daily validation establishes internal consistency, not honest play. **Next:** whole-attempt/replay/branch eligibility architecture followed by server-only admission, verified creator-browser noncontribution, and exact-challenge result isolation. The current stateless Custom session can replay; do not present receipts alone as anti-cheat proof. See `docs/spec/api.md`.
