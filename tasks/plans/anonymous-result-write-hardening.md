# Anonymous result-write hardening

Status: R8A is implemented and production-verified. R8B architecture is settled as a Vercel WAF control; log-only publication, observation, and later 429 enforcement remain operational steps. R8C remains separate.

## Goal

Reduce avoidable abuse cost and improve diagnosability on the anonymous Daily result-write boundaries without changing gameplay authority, scoring, comparison semantics, persistence schemas, or browser identity.

This work is defensive infrastructure, not proof of honest play. Anonymous callers can still manufacture syntactically valid identities and internally consistent results. The goal is to bound request cost and make handled failures visible, not to turn anonymous analytics into authenticated competition.

## Sequence

### R8A — bounded request bodies

Owning layer: apps/web route ingress.

Both POST /api/daily/at-bats and POST /api/daily/results use one concrete Daily-result body reader before server composition.

The reader:

- caps the actual UTF-8 request body at 16 KiB before JSON parsing;
- may use a trustworthy-looking Content-Length only for an early rejection, never as the sole enforcement mechanism;
- counts streamed bytes so a missing or understated Content-Length cannot bypass the limit;
- preserves malformed JSON as HTTP 400 invalid_submission;
- returns HTTP 413 invalid_submission for an oversized body;
- leaves existing private, no-store response behavior intact.

Current first-party payloads have wide headroom. A deliberately padded current schema-1 nine-at-bat completion with a 128-character submission ID serializes to roughly 1.3 KiB, while a similarly padded single-at-bat observation is roughly 0.4 KiB. The 16 KiB ceiling is therefore a transport guard, not a semantic schema maximum.

The current browser delivery clients already classify ordinary non-409 4xx responses as terminal rejection. A 413 therefore does not create a retry loop.

PR #218 merged as 3fb2b78a10403250672c9efc9c7071d8d9b99ff3. Push CI #794 passed end-to-end and production deployment dpl_HjQgGntpVSZbwskxCja3gdVcPr7B is READY on that exact SHA.

Out of scope: domain validation duplication, new persistence fields, rate limiting, identity, signed receipts, result-row changes, comparison changes, or provider changes.

### R8B — coarse platform rate admission

Owning layer: Vercel WAF configuration, not application code.

Do not add @vercel/firewall, an in-process counter, Supabase counters, Redis, or another persistence primitive for the current anonymous-IP use case. A platform custom rate-limit rule is simpler and rejects abusive traffic before it consumes application-function work.

Target rule:

- match HTTP method POST;
- match path in exactly /api/daily/at-bats or /api/daily/results;
- count by client IP;
- use the ordinary fixed-window algorithm;
- use a provisional 600-second window with 300 requests per IP;
- initially use the over-limit action log, not 429 enforcement.

The provisional threshold is intentionally generous. One normal Daily Nine completion can produce up to nine terminal-AB result writes plus one completed-result write. Three hundred requests therefore permits roughly thirty complete games per ten minutes from one egress before even logging an over-limit event, leaving broad room for bounded retries, multiple tabs, family/shared NAT, VPN, or mobile egress. This threshold is a rollout starting point, not a permanent product constant.

Rollout is deliberately staged:

1. Publish the rule with over-limit action log so production behavior is unchanged.
2. Review a representative traffic window for rule hits and false-positive risk, especially shared/NAT egress.
3. Test 429 enforcement against Preview before production.
4. Switch the over-limit action to rate_limit only after the observed traffic supports the threshold.
5. Verify production 429 behavior and continued ordinary result delivery, then keep the rule easy to relax or disable.

The existing result-delivery clients already classify 429 as retryable pending work. They do not spin an immediate tight retry loop: at-bat recovery remains bounded to owner acquisition/later terminal freezes, and completed-result delivery retries only through its existing lifecycle opportunities. No gameplay action waits on these writes.

Important limits:

- IP is a coarse cost-control bucket, not a player/person identity.
- Distributed callers can evade a per-IP threshold.
- Shared egress can aggregate legitimate users.
- Vercel rate counters are region-scoped, so a multi-region path can exceed a nominal global threshold.
- None of this proves honest play or makes anonymous comparison data tamper-proof.

Do not mark R8B complete until the active Vercel rule is observed and production 429 behavior is verified. The currently connected Vercel interface exposes deployment/log reads but not firewall mutation, so repository work can settle and document the design without falsely claiming the external control is live.

### R8C — sanitized diagnostics

Separate PR.

Record structured, low-cardinality failure categories for handled route/provider failures so a clean platform runtime-error scan is no longer mistaken for proof that no caught internal failures occurred.

Do not log request bodies, answer/hint data, credentials, raw Supabase errors, IP addresses, user agents, attempt IDs, submission IDs, or persistent browser identifiers.

Prefer route + coarse category + status/count semantics. Avoid success-per-write logging unless later evidence justifies the volume.

## Verification

R8A:

- exact 16 KiB JSON succeeds;
- 16 KiB + 1 fails;
- missing or understated Content-Length cannot bypass actual-byte enforcement;
- oversized input never reaches server composition;
- malformed JSON remains a 400;
- both public responses remain private, no-store;
- focused tests, typecheck, full tests, file-size checks, canonical baseball-data pipeline, production build/hidden-answer QA, exact-head Vercel preview, and fresh-eye diff review;
- exact merge production and push CI are green.

R8B:

- repository review confirms no app dependency or storage change is needed;
- the active WAF rule must match only the two result-write POST routes;
- log-only publication must show the intended rule hits before enforcement;
- Preview must demonstrate over-limit 429 behavior without affecting unrelated routes;
- production enforcement must return 429 when deliberately exceeded while normal result writes continue;
- ordinary gameplay latency and comparison reads remain outside the rate-admission path.

R8C requires its own scope contract and verification. Supabase migrations are not expected for R8B or R8C unless later evidence changes the design.
