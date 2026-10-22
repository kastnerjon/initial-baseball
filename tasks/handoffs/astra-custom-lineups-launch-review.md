# Independent Custom Lineups launch review

Updated: October 21, 2026 (America/New_York). Work in progress; no release approval.

## Scope contract
Goal: independently audit Custom integrity and launch readiness; review #479/#480/#483; preserve evidence for continuation.
Owning layer: review documentation. This dedicated branch contains no runtime change.
Out of scope: activation, accounts, Discover, Head-to-Head, #434.
Acceptance: exact-head evidence, explicit unresolved gates, durable pushed checkpoint.
Stop: do not merge corrective implementation without separate independent review; never expose credentials.

## Verified initial state
- Local clone and live PR bases: main `4033af550d9301e78b3cee6749ddb257757c39cc`.
- Open PRs: #434 (deferred), #479, #480, #483.
- #479 head `b8f9faf2f65e20de4661d55936db586c0cc40fcf`; CI 39691623182 SUCCESS.
- #480 head `24417e4ee277614e4e09e0cae9ccf4e34b5f9fa8`; CI 39689646438 SUCCESS.
- #483 head `4e43d1318228adbc46b740af812a0fe1e28f9a14`; CI 39711168099 SUCCESS.
- Production `dpl_7ZdkwNg2sf6tCAHpQJZevNqNuK52` READY, exact main SHA. Combined GitHub status confirms Vercel success. Main push Actions evidence not yet independently fetched (connector workflow wrapper only lists PR-triggered runs).
- Production error/fatal runtime query for 30 minutes ending 2026-10-22T03:03:48Z: zero records. This is bounded evidence, not all-time health.
- Supabase production `dwreeiydvwikpamlokji` and QA `iklbnlicgsxxhaoiscor`: ACTIVE_HEALTHY. Rows/grants not yet rechecked.
- Canonical START-HERE top checkpoint is stale (54e559f / only #434 open). #479 proposes reconciliation.

## Investigation status
Read AGENTS.md, START-HERE, tasks/todo and issuance/reservation/public creator/hosted QA scope plans. Obtained exact PR diffs. No architecture verdict yet; CI does not replace code review.
No files in production, flags, credentials, schema or WAF modified. No merge performed.

## Remaining release gates
Real credential-backed anonymous creator-to-friend HTTP QA; real Vercel WAF configuration/enforcement; physical iOS Safari and Android Chrome; reversible rollback evidence. Prior checkpoint reports both Custom flags OFF; fresh runtime verification pending. #482 remains closed and is not being revived.

## Next three actions
1. Trace issuance, owner capability, signed transitions, atomic persistence and public projections in actual source; read live table/function privileges.
2. Complete independent exact-diff review of #479/#480/#483 and verify exact-head Previews before disposition/merge.
3. Exercise supported authenticated dashboard access for isolated QA credentials and WAF; record precise blockers and release evidence without claiming simulated tests establish provider behavior.

## Resume
Branch `docs/astra-custom-launch-review-20261021`; file `tasks/handoffs/astra-custom-lineups-launch-review.md`. Clone repository, fetch current main/PRs, read this file and AGENTS.md. Continue the three actions above; update this file after each phase. Local checkout `/workspace/scratch/6de1dc2ac4dc/initial-baseball` is expendable; pushed GitHub branch is authoritative. No corrective implementation or draft PR exists at this checkpoint.

## Phase 1 evidence and architectural conclusion
- Main push CI 39683990744 independently confirmed SUCCESS via GitHub Actions REST fetch (the generic fetch tool supports push-run collections).
- Exact-head Previews: #479 dpl_EZhZXazpfqJ9V4Gu6bYSso3NRKvw; #480 dpl_9LqZELctjfxPEFQMztUkyAFGqDVh; #483 dpl_A2pDEDtyAHxyuWupXUbEK3upG9hj. All READY at the SHAs above.
- #479 independent review 5608797870 PASS; merged through normal GitHub merge API as 5a45d16c2771e21462edbd18d5571bff60362a10. Main CI 39714997847 and production dpl_DXBJTg8YTcP1Ze4nbLLPPig9K5c4 still running at this checkpoint. Review was recorded as COMMENT through owner connection, not misrepresented as a second GitHub-user approval. Branch-protection read is 403; rulesets collection returns []; no bypass was requested.
- #480 exact head: locally reran node --test apps/web/scripts/qa-custom-v2-hosted.test.mjs in detached worktree: 6/6 passed. Reviewed full diff and fixed-window retry/isolated cookie jars; no runtime changes or blocking finding. Hosted execution still not proven.
- #483 exact-head CI job 119602587485 explicitly passed new post-generation exhaustive issuance step, full tests/typecheck and build ordering. Reviewed 37-line real-data test and dedicated Vitest inclusion: no mocked canonical records, no writes. Useful guard; does not replace end-to-end acceptance.
- Live QA and production: five Custom tables have RLS and deny anon/authenticated SELECT. Eleven Custom functions are SECURITY INVOKER with empty search_path, deny anon/authenticated EXECUTE, grant service_role EXECUTE. Counts: production 0 issued/attempts/results/at-bats/budgets; QA 12/12/12/57/0.
- Reviewed issuance, owner SHA-256 digest, 32-byte capability entropy, bounded pre-quota validation, signed v2 domain, server-resolved guesses, revision/token/attempt/status CAS, restored history validation, engine-derived completion and cookie-scoped creator exclusion. No confirmed P0/P1 exploit found in this bounded pass. Keep anonymous continuity limitations explicit: cookie deletion/new browser is not unique-human proof. Shared engine and data ownership are suitable; do not add a second player catalog, microservices or generic game framework.
- WAF active config again returned 404 Seawall Config not found. Browser opened exact Vercel firewall URL and landed on login. No active rule or enforcement inferred, no protection changed. Secure browserAuth instructions read; user method selection required to continue authentication. Remaining work continues before requesting that intervention.
- Git CLI push lacks credentials; GitHub connector create_branch/create_file successfully persisted this checkpoint as ac42a66d8e61818750a9714f74b5423f0d4d3c67. Local branch has different documentation-only commit 3c7aa0e; do not force-push it over the remote. Use connector updates or fetch/reset a clean checkout.

## Phase 2 PR disposition
- #479 postmerge: main CI 39714997847 SUCCESS; production dpl_DXBJTg8YTcP1Ze4nbLLPPig9K5c4 READY on 5a45d16c2771e21462edbd18d5571bff60362a10. Protected-deployment connector smoke: Archive/Classic/Results 200; /create and valid-shaped Custom v2 page 404; root alias 200. Exact-deployment 30-minute error/fatal scan returned zero records.
- #480 independent review 5608810477 PASS; merged 814fee122e2f519a7bd53fa4cf9e7f444751a618. Postmerge CI/production now pending.
- #483 independent review 5608810579 PASS, not yet merged; wait for #480 postmerge verification. Retain exact expected head 4e43d1318228adbc46b740af812a0fe1e28f9a14 on normal merge call.
- Additional live privilege checks in BOTH databases: issued challenges and both result tables deny service_role UPDATE and DELETE (append-only); attempt states permit UPDATE but not DELETE; only budget table permits DELETE for expiry. Browser roles deny INSERT/UPDATE/DELETE on all five tables.
- Supabase dashboard QA URL was opened, loaded shell then redirected to sign-in. QA credentials not available in this session; do not mistake shell for authentication. Vercel dashboard likewise requires sign-in. Existing connectors provide live DB review but not the required private HTTP credential.

## Bounded adversarial findings (not a blanket security certification)
No confirmed P0/P1 exploit found. Keep operational launch gates closed. The following do not invalidate the core package architecture:
- **P2 continuity risk, existing #470:** serverCustomLineupV2AttemptBootstrap.ts:90–99 issues independently randomized credentials for every absent-cookie request; :116 returns Set-Cookie. Concurrent first opens can create different keys; last cookie response wins. CAS protects each key, not credential initialization. Source mechanism confirmed; delayed-response hosted same-browser reproduction NOT performed. Next acceptance: hold first bootstrap response, admit second response and advance play, release first response, then refresh/complete; verify one coherent retained attempt. Design browser initialization coordination separately if reproduced; no unique-human promises.
- **P2 browser async lifetime risk, existing #472:** CustomLineupGame.tsx:46–63 writes bootstrap state after await with no request-generation fence; mutation handling also lacks such fencing. The prior issue mentions a local repair, but that repair is NOT present in reviewed main source. Do not claim it shipped. Need mounted browser delayed-response/navigation regression before deciding the smallest web-only fix; preserve server CAS.
- **P2 confirmed observability gap, new #484:** serverCustomLineupV2GameplayHttp.ts:134–136 sanitizes unexpected exceptions into 503 without an application event. Creation has safe stage diagnostics. HTTP 5xx monitoring can still observe status; error/fatal application-log emptiness is not proof of zero gameplay failures. Small follow-up: action/status-only structured event and injection test ensuring no token/cookie/owner/answer/error detail logged.
- **P3 known recovery limitation, #471:** serverCustomLineupV2Creation.ts mints new UUID/capability per request and stores only digest; public create route returns them after insert. Commit-then-response-loss can orphan a challenge/owner code; retry spends another reservation. Explicit QA and product recovery decision required; do not retrofit unreviewed idempotency/persistence.
- **P2 plausible future data-refresh availability risk:** serverCustomNineBootstrap.ts:118–119 still requires current canonical lookup for frozen IDs. Removal of an issued ID from a later catalog can fail an old game despite frozen clue storage. No such missing historical ID was observed. #483 validates current searchable catalog, not all historical persisted identities; preserve stable canonical IDs/compatibility when changing data.
- Existing #481 (also #247) tracks PUBLIC EXECUTE on production event-trigger helper rls_auto_enable. Custom functions inspected here do NOT have that exposure. Its event_trigger return type does not establish ordinary RPC exploitability; keep separate from this launch review.

## Explicit architecture decisions
Keep shared schemas/types, pure engine, canonical baseball-data and immutable Daily/Custom constructors. Web owns provider adapters, signing/origin/cookies and service-role storage. Current v1/v2 duplication is compatibility scaffolding, not reason to unify persistence or rename game engine now. H2H requires its own server-owned match/turn/hidden queue lifecycle later; current first-attempt CAS is useful prior art, not a complete multiplayer protocol. Optional account linkage must reference immutable facts and prove ownership separately. Public listing is a spoiler-safe projection, never the issued-row shape.

## Planned bounded release-safety drill
After #483 main CI/production are green, attempt provider-supported rollback from latest reviewed production to immediately preceding reviewed READY production (only docs/QA differ), verify alias routing and disabled Custom routes, then promote latest deployment back and verify. No database/schema/secret/feature-flag/protection change; no enabled-user Custom rollback is implied. If provider refuses or latest promotion cannot be guaranteed, record exact refusal and retain known-good deployment. Both baseline and candidate must be healthy before starting.

## Phase 3 all requested PRs merged
- #480 main CI 39715365169 SUCCESS; production dpl_GKWwnACyi6BzMpfS87e76Tg6b2Ho READY on 814fee122e2f519a7bd53fa4cf9e7f444751a618. Exact deployment /, Archive, Classic, Results 200; /create and valid-shaped Custom v2 page 404. Deployment error/fatal scan empty.
- #483 merged through normal expected-head GitHub API as 7c3b031ba27b3517d36a557335c9ff7e4aad80fe; final main CI/production pending.
- No production runtime implementation, schema, credential, feature flag or firewall modification was made. All three reviewed changes are documentation/QA/CI. #434 remains deferred, #482 remains closed. #484 is a scoped follow-up issue, not an implemented fix.


## Phase 4 continuation — October 21, 2026, approximately 23:33 ET

### Definitive merge/production verification
- #479 merged `5a45d16c2771e21462edbd18d5571bff60362a10`, after independent bounded review on the prior handoff.
- #480 merged `814fee122e2f519a7bd53fa4cf9e7f444751a618`; exact main CI `39715365169` SUCCESS and production deployment `dpl_GKWwnACyi6BzMpfS87e76Tg6b2Ho` READY.
- #483 merged `7c3b031ba27b3517d36a557335c9ff7e4aad80fe`. Main CI `39715714165` **SUCCESS**, current production `dpl_vccFJFNeYyEJgtLsHfqyhgL5GGkJ` **READY**, exact commit and alias. Earlier #483 postmerge pending checks are resolved.
- Only deferred #434 and newly opened diagnostics #485 remain open. #482 remains closed without merging. No public Custom activation.
- Vercel production error/fatal logs in the 30 minutes ending approximately 2026-10-22T03:20:49Z returned **no entries**, not a comprehensive guarantee of gameplay health.
- Exact read-only database counts (not pg_stat estimates): production `dwreeiydvwikpamlokji` 0 issued, 0 attempts, 0 completed, 0 at-bats, 0 creation budgets; isolated QA `iklbnlicgsxxhaoiscor` 12 issued, 12 attempts, 12 completed, 57 at-bats, 0 budgets. Both ACTIVE_HEALTHY at inspection. No DB mutation.
- Vercel active firewall read still returned 404 `Seawall Config not found`; cannot verify an active rule or actual enforcement. Project route-rules API returned zero routes, which is **not** a substitute for WAF. Do not infer that IP rate limiting is present or absent.

### Isolated corrective PR #485 — diagnostics for unexpected gameplay 503s
- Existing issue #484 was confirmed against `apps/web/app/serverCustomLineupV2GameplayHttp.ts`: unexpected failure returns sanitized `session_unavailable`/503 with no structured application event. Normal, expected 400s are already handled.
- Branch `fix/custom-gameplay-safe-503-diagnostics-20261021` from exact main `7c3b031ba27b3517d36a557335c9ff7e4aad80fe`; open [PR #485](https://github.com/kastnerjon/initial-baseball/pull/485), exact head `3901697d845f1b1ff87cdd4d976b7b85ffcf2517`.
- Only web HTTP adapter and its colocated test changed: add one JSON log containing exactly `event`, allowlisted `action`, and `status:503`, without secret-bearing error/request/credential/answer material. Preserve existing status, sanitized response, cookie semantics, no logging for expected 400s.
- Local sandbox `sbx_Ph9hP6cjGFogGZPo1Xk2ST0cJDGz` (ephemeral, no persistent snapshots), git checkout exact base. Built four prerequisite domain packages. Focused Vitest 11/11 PASS; web typecheck PASS; full workspace `pnpm test`, `pnpm lint`, documentation-impact tests, and file-size checks all completed successfully (combined command exit 0). `git diff --check` PASS.
- Exact uploaded Git blob hashes match locally tested `git hash-object`: HTTP `ac712d57e082b1816d1b662b3577291ec509bc40`, test `a07eae574e011dd978d1cfdf67d64bfc78c7a4fe`. Unrelated generated baseball-data files changed locally during prerequisite builds and **were not pushed**.
- #485 is **not merged**. Requires exact-head GitHub CI, READY Preview and a genuinely independent review. Do not self-approve or bypass protections. No production configuration or runtime mutation made.

### Architecture and release verdict
- No confirmed P0/P1 vulnerability in the bounded review. Current shared/engine/data and server-authoritative immutable Custom boundaries remain structurally sound for staged private launch, but not a general security certification. Do not replace with speculative service/framework abstractions.
- Keep P2 first-bootstrap concurrent cookie race #470, client async stale response #472, potential historical ID removal, and P3 lost creation-response recovery #471 as distinct unverified/known concerns. #485 only improves telemetry.
- Production remains **NOT LAUNCH READY** until real isolated-QA creator-to-friend credential-backed HTTP acceptance, provider-level WAF configuration/enforcement with reversal, physical iOS Safari/Android Chrome acceptance, and reversible production rollback/controlled feature activation. Never mistake synthetic headers, SQL RPC, unit tests or viewport simulation for these gates.
- No new QA keys, WAF changes, feature flags, schema changes or release were performed during this phase.

### Next three actions
1. Verify PR #485 exact-head GitHub Actions CI and exact-commit Vercel Preview READY, request truly independent fresh-eyes review and fix in-scope findings. Merge only after requirements satisfied; then verify main, production, routes and runtime errors.
2. Progress hosted launch evidence with **QA-only** credentials (currently inaccessible via connector/browser session) and real route-scoped Hobby fixed-window WAF dashboard/enforcement test (the API still returns 404). Do not enable production flags or weaken SSO protection.
3. Complete guarded real-device acceptance and a reversible production rollback drill only after verifying both deploy targets/aliases, read-only smoke and promotion recovery; preserve both flags OFF until all gates pass.

### Immediate resume
Read this file on `docs/astra-custom-launch-review-20261021`, read `AGENTS.md`, fetch latest main and PR #485, then inspect exact-head CI and Vercel Preview. Leave deferred PR #434 untouched. Use git connector if local CLI has no authenticated push. Do not confuse the code-review allowance restriction with test/preview success.


### Phase 4 post-PR smoke and exact-head Preview
- Current production alias `https://initial-baseball-web.vercel.app`: GET routes `/`, `/archive`, `/classic`, `/results` returned HTTP 200; `/create` returned 404 as intended with public Custom off. This was a real HTTP smoke through the public Vercel alias using an ephemeral isolated sandbox, not authenticated creator/friend acceptance.
- #485 exact head `3901697d845f1b1ff87cdd4d976b7b85ffcf2517`: Vercel Preview `dpl_zPPLdVQVhL2NerFaaLaRLHVZa2qT` **READY** on that SHA, verified from deployment list. GitHub Actions run [39717483332](https://github.com/kastnerjon/initial-baseball/actions/runs/39717483332) was still **in_progress** at last poll; do not claim CI success before a fresh read. No independent review yet and no merge.


### Phase 4 production reversal probe and PR #485 CI correction
- Provider `request_rollback` to previous reviewed READY deployment `dpl_GKWwnACyi6BzMpfS87e76Tg6b2Ho` returned success (`result:null`), immediately followed by `request_promote` to current reviewed READY deployment `dpl_vccFJFNeYyEJgtLsHfqyhgL5GGkJ`, also accepted. Post-restore `list_promote_aliases` shows production alias `initial-baseball-web.vercel.app` **completed**; `list_deployment_aliases` and `get_deployment` confirm the alias is attached to current exact-main SHA `7c3b031b` in READY state. Public route retest `/`, `/archive`, `/classic`, `/results` HTTP 200, `/create` 404; 15-minute error/fatal runtime scan empty.
- **Evidence limit:** provider returned `result:null` for both mutation requests and immediate restore was performed, so no separate intermediate alias observation confirmed that the rollback target actually served traffic. This is a successful provider acceptance/restore test, **not** yet a fully evidenced switch-and-back/rollback drill. Keep completion unchecked until intermediate target alias/requests and precise recovery are independently witnessed. No flags, databases or WAF were changed.
- #485 initial exact-head `3901697d845f1b1ff87cdd4d976b7b85ffcf2517`: GitHub Actions `39717483332` test job SUCCESS, docs-impact job FAILURE because original PR body lacked exact `## Documentation impact` heading. A retry of only the failed job reused the original event PR body and predictably failed again; this was **not a code/test failure**.
- Corrective #485 follow-up: added a correctly named `## Documentation impact` PR section and updated canonical `tasks/todo.md` to reconcile merged #483 / staged #485, resulting in new head `07bc62f8b32e362e226cd68ae739eef06cb5423f`. Updated PR body to reflect three files and canonical-doc impact. Fresh exact-head CI and Preview **must be rechecked**, and independent review is still missing. Initial exact-head Preview for earlier `3901697d` was READY; it does not qualify the new head. Do not merge before latest gates.


### PR #485 corrected-head release checks (live follow-up)
- Head `07bc62f8b32e362e226cd68ae739eef06cb5423f`: exact-head Vercel Preview `dpl_EwJbDnACnRZPpuxKhjp2tX7wu6z6` **READY**.
- Fresh GitHub Actions run [39718198236](https://github.com/kastnerjon/initial-baseball/actions/runs/39718198236): `documentation-impact` job **SUCCESS**; full `test` job **still in_progress** at last check. This fixed the initial run's missing documentation-section failure. Do not say CI is green until the test job finishes successfully.
- No fresh independent review or merge. Production remains main `7c3b031b`; Public Custom flags not enabled.


## Phase 5 — verified continuation checkpoint, October 22, 2026 (New York)

### Re-verified source-of-truth state
- Main production remains `7c3b031ba27b3517d36a557335c9ff7e4aad80fe`, Vercel production `dpl_vccFJFNeYyEJgtLsHfqyhgL5GGkJ` READY. #479/#480/#483 were merged; #482 closed without merge. Deferred #434 and diagnostics #485 are the only open PRs at this read.
- #485 current head `07bc62f8b32e362e226cd68ae739eef06cb5423f`: [GitHub Actions run 39718198236](https://github.com/kastnerjon/initial-baseball/actions/runs/39718198236) **COMPLETED SUCCESS**, including documentation-impact and test jobs. Exact-head Vercel Preview `dpl_EwJbDnACnRZPpuxKhjp2tX7wu6z6` READY. Live GitHub review list returned **zero reviews**. **Do not self-review or merge without genuine independent review.**
- #485 diff is only `apps/web/app/serverCustomLineupV2GameplayHttp.ts`, its test, and `tasks/todo.md` reconciliation. The HTTP catch now logs exactly static event `custom_lineup_gameplay_unavailable`, typed action, status 503; no exception/body/cookies/IDs. The new test exercises all four actions and no expected-invalid-request logging. No code security blocking finding identified during prior bounded author verification; it still needs different-reviewer scrutiny.
- Production route smoke/DB/rollback evidence from Phase 4 stands. No public Custom flag activation or provider WAF change occurred.

### High-leverage handoff priorities for next two models
1. **Sol Low preflight / cheap execution:** verify live state; independently review #485 exact diff and checks and, **only if genuinely independent**, merge with expected head SHA and verify exact-main CI/production; reconcile docs; obtain authenticated access to Vercel Firewall and isolated Supabase QA service-role key via authorized browser/cloud computer without displaying secrets or touching production keys. Prepare disposable environment with QA-only server secrets and ten valid canonical fixture IDs. If not possible, document precise single user authentication action rather than spending Astra time discovering it. Ensure two public production flags remain OFF. Save a new committed checkpoint.
2. **Astra Medium main task:** investigate the **most consequential unverified game-integrity continuity risk**, particularly #470 cookie-less concurrent first bootstraps and #472 stale client response lifetime. Reproduce under controlled delayed requests and genuine browser/cookie ordering if supported. Decide whether the bug is real and release-blocking, choose the smallest existing-layer fix, implement one bounded PR with tests, obtain independent review and merge only if gates permit. Use previously provisioned QA-only credentials for the actual no-sign-in creator → friend HTTP 1–10 and quota test. Check provider-level WAF only if dashboard access is ready; don't spend limited tokens on login loops or unrelated features.
3. **Release posture:** no Custom activation without credential-backed hosted proof, verified WAF enforcement/reversal, physical iOS Safari/Android Chrome and a witnessed intermediate-deployment rollback-and-restore drill. Do not claim that the earlier accepted request+restore alone met rollback gate.

### Credential/setup exact requirements (no secret contents in documents or chat)
- QA Supabase ref `iklbnlicgsxxhaoiscor`; forbidden production ref `dwreeiydvwikpamlokji`.
- Hosted runner `apps/web/scripts/qa-custom-v2-hosted.mjs`; scope `tasks/plans/custom-v2-public-creator-hosted-qa.md` and `tasks/plans/custom-v2-creation-quota-hosted-qa.md`.
- Required **QA-only** env keys: `CUSTOM_V2_QA_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_PROGRESSION_SECRET`, `CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED=true`, ten comma-delimited `CUSTOM_V2_QA_PLAYER_IDS`.
- For public creator QA only, additional `CUSTOM_V2_QA_PUBLIC_CREATION=true`, `CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED=true`, `CUSTOM_V2_QA_SIMULATED_VERCEL_INGRESS=true`, and independent `CUSTOM_LINEUP_CREATION_BUDGET_SECRET` (>=32 characters). These flags go to disposable localhost QA child **only**, not production Vercel.
- Runner rejects hard-coded production project, validates URL and loopback binding, and uses synthetic forwarded IPs; successful localhost HTTP acceptance is **not** production Vercel ingress or WAF evidence.
- Vercel team `team_J5imVDEIZiEnBIfog39RsrL6`, web project `prj_qRI3hNsJN8OI6POV2TF0R6YyBYuo`. Latest API `get_firewall_config(active)` 404 Seawall Config not found; dashboard login may need the user's authorized browser. Hobby fixed-window WAF rule entitlement described in `tasks/plans/custom-v2-live-vercel-ingress-evidence.md`, but actual enforcement remains unverified. No production protection settings may be weakened.

### Context budget rule
Astra Medium should read this phase and only the relevant source/PR/QA contracts; Sol should have already done GitHub status, CI, deployment, secrets/auth setup and trivial #485 review. Save findings as a new GitHub commit before any long test or uncertain browser operation. Work is incomplete unless objective evidence has been recorded.


### Phase 5 final live read-only evidence (2026-10-22 00:43 ET)
- Production deployment `dpl_vccFJFNeYyEJgtLsHfqyhgL5GGkJ` still READY on `7c3b031ba27b3517d36a557335c9ff7e4aad80fe`, with all three expected Vercel aliases attached.
- Bounded production error/fatal runtime logs for approximately 04:23–04:43 UTC returned no entries. This does not prove absence of HTTP 5xx events (see #484/#485).
- Exact read-only five-table Custom counts: production `0/0/0/0/0` (issued/attempts/completions/at-bats/budgets), isolated QA `12/12/12/57/0`. No DB changes.
- #485 CI run `39718198236` verified **SUCCESS** on exact head `07bc62f8`; its Preview READY; GitHub review list empty, remains unmerged.
