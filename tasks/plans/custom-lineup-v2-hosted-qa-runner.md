# Custom Lineup v2 — isolated hosted gameplay acceptance runner

Status: Real isolated application HTTP-to-hosted-Supabase acceptance PASSED October 18, 2026, after the runner-only loopback origin correction. Public activation remains OFF. Evidence: `custom-v2-hosted-origin-alignment.md`.

## Goal and scope

The runner exercises real HTTP through its own localhost Next.js process to the isolated hosted Supabase Custom v2 database, without writing to production. It does not change game rules, schemas, public flags or authorization.

The repository's isolated QA project is standalone on the Supabase Free plan, NOT a database branch. Database branching requires Pro. Project ref: iklbnlicgsxxhaoiscor; production ref: dwreeiydvwikpamlokji (hard-denied in source). The standalone QA project was restored for the successful October 18 run and pause was requested afterward. Its existing Custom migrations were reused. The temporary QA-only server credential copy was removed; future runs must securely provision their own authorized QA environment again. Hosted application acceptance now supplements the earlier rollback-only SQL matrix.

## Safety preflight

1. Verify the target is a disposable, isolated hosted project through the Supabase console/connector. Check its project ref, active status, Custom tables and grants. Never use production or a production credential. Restore the paused QA project only when ready to execute.
2. Provision a **QA-project-specific** service-role or compatible server secret using Supabase's approved secret settings; supply it through a private environment mechanism in the local QA sandbox, not Git, logs, CLI arguments, a public client variable or this chat. The connected Supabase tools cannot currently retrieve these privileged keys.
3. Set CUSTOM_V2_QA_PROJECT_REF to the verified QA project ref. Set SUPABASE_URL to the matching canonical https://PROJECT_REF.supabase.co endpoint. The runner rejects the production ref, HTTP, wrong host, path/query additions and malformed URLs.
4. Supply SUPABASE_SERVICE_ROLE_KEY, a nonproduction DAILY_PROGRESSION_SECRET at least 32 characters, isolated DAILY_ADMIN_USERNAME and DAILY_ADMIN_PASSWORD, CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED=true **only within the runner-owned local environment**, and CUSTOM_V2_QA_PLAYER_IDS containing 10 unique, supported canonical ibp_ IDs with complete frozen clue data. Do not enable the public Vercel flag. Do not use a remotely running production-configured Next.js server.
5. Build the reviewed web commit with its canonical baseball-data runtime and dependencies. Run the no-network guard smoke suite first:

    node --test apps/web/scripts/qa-custom-v2-hosted*.test.mjs

6. Run the real staged acceptance once with the explicit private environment:

    node apps/web/scripts/qa-custom-v2-hosted.mjs

   The script launches and stops its own loopback Next.js process on an ephemeral port and uses the validated nonproduction database connection. It exercises all 10 lineup lengths N=1,2,3,4,5,6,7,8,9,10 and two additional one-batter endings (third strike and give-up). It validates issuer redaction, creator-exclusion, first reservation/restoration, hints, wrong guesses, authoritative signed correct progression, forged/replayed tokens, cross-origin refusal, terminal scores, first-only completed-result admission and idempotent replays. The runner produces no production fixture inserts.
7. On successful execution, verify the isolated QA project has exactly 12 newly issued challenges, 12 completed noncreator attempts, 12 accepted completions and 57 per-AB result rows, assuming the four tables were empty at the start. If a test fails, record actual counts rather than inventing success and investigate only in that isolated project.
8. Inspect any logged error for leakage; do not paste secrets or raw answer identities in evidence. Conduct actual mobile/browser QA (including historical v1) separately. Pause or destroy the isolated QA project when finished and reconfirm production remains unchanged.

## Evidence boundaries

Node guard tests only establish preflight; mocked HTTP and hosted SQL rollback fixtures alone do not establish end-to-end gameplay. The October 18 actual runner execution passed for all N=1–10 and both alternate endings. Request URLs use localhost to match NextRequest normalization; the server still binds only to 127.0.0.1. All application origin checks remain unchanged. Even a successful run does not authorize public activation, public creation, publication/discovery or competitions; those require separate abuse/privacy controls and a release decision.
