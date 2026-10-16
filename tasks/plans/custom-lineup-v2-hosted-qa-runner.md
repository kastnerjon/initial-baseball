# Custom Lineup v2 — isolated hosted gameplay acceptance runner

Status: Bounded release-verification tooling; staged only. Hosted execution is NOT yet verified.

## Scope contract

- Goal: Provide one repeatable real HTTP to Next.js application to hosted Supabase test of signed Custom v2 issuance, gameplay and completed admission against a disposable database branch, without contaminating production.
- Owning layer: Web application QA tooling (apps/web/scripts/qa-custom-v2-hosted.mjs), plus focused tests for previously missing intermediate N lengths.
- In scope: Runner-owned localhost HTTP server with validated branch environment; explicit independent creator/player cookie contexts; 1/5/9/10 issued challenge matrix; signed hint/guess/restore/complete/submit paths; creator exclusion, forged/cross-origin attempts and replay, third strike and give-up; pinned production-project ref and strict environment guard; all N=1–10 in existing HTTP/mock issuer tests; small documentation checkpoint corrections.
- Out of scope: New product rules, database schema, hosted Supabase branch creation and billing approval, changing Vercel flags, activating any public Custom route, testing deployed-browser UI/mobile, public publication/discovery, rate limiting, private v1 fixtures, and unapproved production fixture inserts.
- Acceptance: Node syntax check; guard rejects missing environment before network calls; N=1–10 existing contract tests; full repository CI and Preview READY; independent bounded review. Hosted acceptance is complete only after an operator actually runs the script with a branch-backed server and inspects the branch results.
- Stop conditions: Branch creation requires unapproved cost; staging connection appears to target production; any uncontrolled Vercel/DB environment setting or source-code disclosure; test discovers runtime defect needing a new security or persistence architectural decision. File a bounded follow-up rather than weakening guards.

## Runbook (after cost authorization)

1. Create a disposable Supabase branch of initial-baseball-db and record its project ref. Verify installed migrations, RLS, private grants, and absence of production game rows. The branch incurs hourly billing and requires explicit approval.
2. Provide branch-specific server credentials through approved secret configuration only. Do not print keys or commit local env files.
3. Build the web app from the reviewed commit. Supply SUPABASE_URL=https://BRANCH_REF.supabase.co, the branch service role key, an isolated DAILY_PROGRESSION_SECRET, admin credentials and CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED=true to the QA runner. It starts and stops the localhost Next.js server itself with the exact validated environment. Do not separately start a server or use production credentials. Leave public Vercel flags OFF.
4. Set CUSTOM_V2_QA_BRANCH_REF and CUSTOM_V2_QA_PLAYER_IDS to ten distinct supported canonical ibp player IDs. The production project ref is pinned in reviewed source (dwreeiydvwikpamlokji), not operator-supplied. The runner chooses an ephemeral localhost port.
5. Execute node apps/web/scripts/qa-custom-v2-hosted.mjs once. The runner launches and owns the local web server, refusing the known production Supabase ref, mismatched branch API URL, and missing explicit flags. It issues six synthetic challenges and writes attempts/completions to the BRANCH ONLY. It does not delete rows; destroy the branch after evidence is captured.
6. Verify branch challenge, attempt, completed-result and per-AB counts against the four primary lengths and two N=1 terminations, immutable versioned IDs, 4 times N maximum and first-only admissions. Inspect HTML/API/logs for unauthorized answer disclosure and collect sanitized results only in the private QA artifact.
7. Run real mobile browser checks and legacy Custom Nine v1 verification separately; an HTTP script cannot establish visual quality. Keep public flags OFF. Destroy the disposable branch and confirm production Custom table counts unchanged.

The script starts the tested web process with its validated staging environment and rejects the pinned production project. It cannot independently prove that another remote project is a disposable branch when operator-supplied provenance is misleading. Branch creation approval, credential provenance, and teardown remain human-verified release gates.

Evidence labels: Mocked browser/HTTP coverage is not live branch-backed HTTP; live branch-backed HTTP is not mobile browser QA; none of these is public activation.
