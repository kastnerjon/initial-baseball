# Default-disabled public Custom Lineup creation boundary

## Scope contract

- Goal: Provide the no-sign-in, quota-backed Web POST boundary for immutable 1–10 Custom Lineup issuance, without enabling public creation or adding a public page.
- Owning layer: apps/web (HTTP adapter and server-only abuse reservation).
- In scope: Strict same-origin JSON POST; verified Vercel IP and day-scoped keyed digest; private Supabase reserve RPC before materialization; reuse existing immutable issuer and signed creator marker; sanitized errors; focused tests; canonical status.
- Out of scope: UI/browser enablement, public gameplay activation, WAF/gameplay limits, durable accounts, user identity tracking, leaderboard/Discover, Daily Lineup, production fixtures.
- Acceptance: Unit tests 1–10 lengths, exact quota and failure behavior, provider/provenance refusals, full CI and exact-head READY Preview, independent bounded review.
- Stop conditions: An inability to authenticate the ingress header or a missing server key must fail closed, not add a fallback.

## Trust boundary

This route requires BOTH CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED=true and CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED=true. Both remain unset in production. It accepts no browser digest, and no auth cookie as a unique-human identity signal. Only when executed in Vercel production/preview (VERCEL=1, VERCEL_ENV), the Vercel-overwritten x-forwarded-for ingress header is considered trusted (https://vercel.com/docs/headers/request-headers). It must be one syntactically valid IPv4/IPv6 address, not a chain. If x-vercel-forwarded-for also appears it must agree. A non-Vercel test server or another proxy stack has no implicit trust. Changes to the ingress/provider model require a separate security review.

CUSTOM_LINEUP_CREATION_BUDGET_SECRET is a separate, strong, server-only key. HMAC-SHA256 domain + UTC date + IP produces 64 lowercase hex; no raw IP or secret leaves the server. Supabase's private service-role-only reserve RPC enforces 10 admissions/digest/10-minute window and 1,000 per UTC day atomically. Quota denials return sanitized 429 and Retry-After; missing trusted provenance/key/provider returns 503. Reservations are spent even if later issuance fails.

The authenticated administrator POST remains unchanged. Creator marker is preview/exclusion only, not user identification. Signed server-side gameplay and first-attempt continuity remain unchanged. Public UI must not be exposed until controlled end-to-end QA, WAF/privacy review, and mobile/v1 regression pass. Unlisted challenge IDs and metadata remain nonindexed. No cross-device or deleted-local-data recovery is promised.

## Operational checkpoint

Database #439 merged as 6cb676e. Production applied the exact reviewed additive source as hosted migration 20261018193404. Read-only verification: table/function exist; RLS on, SECURITY INVOKER, service-role-only function execute; zero counter rows. Isolated QA still inactive. The local PostgreSQL 18 concurrency test used 32 independent processes and a directly observed held transaction lock; no real UTC-midnight transition was exercised.
