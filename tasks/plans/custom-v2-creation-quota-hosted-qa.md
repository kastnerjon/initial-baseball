# Live QA-only anonymous creation quota acceptance

## Scope contract
- Goal: extend the existing anonymous Custom creator to friend hosted acceptance runner with an actual isolated-Supabase 10-per-IP budget threshold test.
- Owner: apps/web/scripts/qa-custom-v2-hosted.mjs (test harness only).
- In scope: opt-in QA scenarios: malformed request does not spend quota, ten serial valid requests from one fresh client digest succeed, the eleventh receives HTTP 429 with Retry-After and no creator cookie, and a distinct IP remains permitted; plus a separate 12-request simultaneous burst from another fresh client digest, with ten accepted and two denied.
- Out of scope: production flags/secrets, WAF or real Vercel ingress authenticity, new quota rules, database migrations, public browser UI, service runtime, player hints or scoring.
- Acceptance: pre-existing default admin acceptance unchanged; the new scenario runs only with the pre-existing guarded QA public-creator opt-in and independently provisioned nonproduction Supabase service credentials. Exact-head CI, READY Preview and independent review required.
- Stop: do not run against production; actual WAF/mobile/genuine Vercel ingress and published activation still require separate security and release review.

## Design
Reuses the existing local browser/server runner and the live private database quota RPC. A fresh randomly generated reserved documentation IPv6 address in 2001:db8::/32 avoids consuming a prior fixture-run window; the same address is held stable across eleven requests. A second independently generated documentation address checks per-IP separation. The 1,000/day global QA allowance remains a shared staging capacity, not a bypass or proof of the production WAF.

The runner bounds the entire malformed/ten-success/eleventh-denial/different-IP sequence to one UTC-aligned, fixed 10-minute database bucket, with a 30-second boundary guard. If wall-clock observations cross that bucket, the attempt is discarded and retried with a fresh random address (up to three attempts). This is a safeguard against ambiguous test evidence, not an independent authoritative database-time proof.\n\nThe serial QA scenario creates up to eleven additional private challenge rows on success (ten for the first client and one for the second). The independent concurrent burst creates up to ten further immutable challenges on success, using twelve separate cookie jars with one synthetic source IP; the successful owner capabilities must be distinct and both denials must carry Retry-After without creator cookies. Both scenarios discard window-crossing evidence and retry with fresh synthetic IPs. These are disposable QA-only fixtures. No public player population, user data, browser cookies, production challenge IDs, or credentials are uploaded. The synthetic local ingress headers prove application behavior only, not that Vercel overwrites those headers in actual deployment.

## Documentation impact
Adds this scope and updates the existing hosted acceptance plan and current task list. All live feature flags remain OFF.

## Concurrent budget QA extension — October 21

The existing opt-in localhost Next.js + isolated Supabase runner now tests twelve simultaneous valid public-creation POSTs sharing one QA-only synthesized forwarded IPv6 address. It expects **exactly ten HTTP 201** responses with distinct issued challenge IDs and 43-character owner credentials, and **exactly two HTTP 429** responses without creator cookies and with bounded Retry-After. As in the serial test, results are only claimed if every response falls within one fixed UTC ten-minute bucket; a crossing triggers a fresh-address retry. The startup guards and default admin mode remain unchanged. This is a concurrency test of the application/database quota through synthetic local ingress, **not** validation of Vercel edge header authenticity or WAF, and requires actual isolated QA credentials before a successful hosted run can be reported. No production flags, database rules, or API contracts change.

## October 21 — live QA database reservation-concurrency evidence

Against the **isolated** Supabase QA project (not production), twelve parallel calls to the real `reserve_custom_lineup_creation_budget(text,text)` RPC with one common synthetic 64-hex client digest returned **10 admitted / 2 denied**, with no errors. The denied reservations returned positive `retry_after_seconds` values (506 and 504 seconds), and all calls agreed on the server UTC day 2026-10-21. The database's persisted client counter corroborated ten admissions in the fixed ten-minute window. A separate initial twelve-call probe left another ten-admission client counter, without preserved individual response evidence.

Both synthetic client counters and the associated 20-count global QA counter were inspected and transactionally cleared under the same reservation advisory lock with exact count/window preconditions; the final QA creation-budget row count was **zero**. No Custom puzzle, score or player record was created by these direct-RPC probes.

**Scope of proof:** these were genuine isolated-QA database calls initiated in parallel, exercising transaction locking and quota arithmetic. They were **not** HTTP `POST /api/custom-lineup/create` calls, did not use the QA-only service-role HTTP runner, did not validate trusted Vercel forwarding headers, and did not test WAF or creator-to-friend gameplay. The previously staged complete hosted creator/friend HTTP acceptance gate remains unchecked.
