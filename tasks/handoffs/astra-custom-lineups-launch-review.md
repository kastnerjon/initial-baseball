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
