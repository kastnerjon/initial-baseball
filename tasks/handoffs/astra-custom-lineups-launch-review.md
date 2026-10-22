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
