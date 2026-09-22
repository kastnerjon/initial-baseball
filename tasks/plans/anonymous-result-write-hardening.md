# Anonymous result-write hardening

Status: R8A implemented in this branch; R8B and R8C remain separate follow-ups.

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

Out of scope: domain validation duplication, new persistence fields, rate limiting, identity, signed receipts, result-row changes, comparison changes, or provider changes.

### R8B — coarse rate admission

Separate PR because this introduces a hosting-specific primitive and likely a new dependency/configuration surface.

Use a generous Vercel-level rule scoped only to the two anonymous result-write POST routes. Default client-IP bucketing is acceptable as coarse request-cost protection; caller-controlled attempt/submission IDs must not become the rate-limit identity.

Tune for legitimate Daily Nine behavior: up to nine terminal-AB writes, one completion write, normal retries, multiple tabs, and users sharing NAT/VPN/mobile egress. Rate admission must remain independent from comparison identity and honest-play claims.

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
- focused tests, typecheck, full tests, file-size checks, canonical baseball-data pipeline, production build/hidden-answer QA, exact-head Vercel preview, and fresh-eye diff review.

R8B and R8C each require their own scope contract and verification. Supabase migrations are not expected for any of these checkpoints unless later evidence changes the design.
