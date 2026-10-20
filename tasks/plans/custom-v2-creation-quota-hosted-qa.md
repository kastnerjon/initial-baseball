# Live QA-only anonymous creation quota acceptance

## Scope contract
- Goal: extend the existing anonymous Custom creator to friend hosted acceptance runner with an actual isolated-Supabase 10-per-IP budget threshold test.
- Owner: apps/web/scripts/qa-custom-v2-hosted.mjs (test harness only).
- In scope: one new opt-in QA scenario: malformed request does not spend quota, ten valid requests from one fresh client digest succeed, the eleventh receives HTTP 429 with Retry-After and no creator cookie, and a distinct IP remains permitted.
- Out of scope: production flags/secrets, WAF or real Vercel ingress authenticity, new quota rules, database migrations, public browser UI, service runtime, player hints or scoring.
- Acceptance: pre-existing default admin acceptance unchanged; the new scenario runs only with the pre-existing guarded QA public-creator opt-in and independently provisioned nonproduction Supabase service credentials. Exact-head CI, READY Preview and independent review required.
- Stop: do not run against production; actual WAF/mobile/genuine Vercel ingress and published activation still require separate security and release review.

## Design
Reuses the existing local browser/server runner and the live private database quota RPC. A fresh randomly generated reserved documentation IPv6 address in 2001:db8::/32 avoids consuming a prior fixture-run window; the same address is held stable across eleven requests. A second independently generated documentation address checks per-IP separation. The 1,000/day global QA allowance remains a shared staging capacity, not a bypass or proof of the production WAF.

The QA run creates up to eleven additional private challenge rows on success (ten for the first client and one for the second); these are disposable QA-only fixtures. No public player population, user data, browser cookies, production challenge IDs, or credentials are uploaded. The synthetic local ingress headers prove application behavior only, not that Vercel overwrites those headers in actual deployment.

## Documentation impact
Adds this scope and updates the existing hosted acceptance plan and current task list. All live feature flags remain OFF.
