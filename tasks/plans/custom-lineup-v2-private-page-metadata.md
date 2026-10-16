# Custom Lineup v2 — unlisted challenge metadata privacy

Status: scoped page-only release hardening; gameplay remains **default disabled**.

## Scope contract
- **Goal:** prevent ordinary indexing/link-following and referrer propagation of private/unlisted Custom Lineup v2 challenge URLs when future separately approved gameplay activation occurs.
- **Owning layer:** `apps/web/app/custom/[puzzleId]` Next.js route metadata.
- **In scope:** static, generic title/description, `robots` noindex/nofollow/nocache and `referrer` no-referrer; focused route metadata tests; concise canonical state updates.
- **Out of scope:** HTTP security headers, authenticated creator ownership, public publishing/discovery, social-sharing design, private result visibility, schema, gameplay, engine, Daily Nine, Classic/Archive/admin changes and all environment/feature flags.
- **Acceptance:** metadata contains no challenge-specific IDs, player answers or frozen hint information; generic instructions prevent indexing irrespective of N=1–10; existing 404 disabled gate and canonical routes unchanged; exact-head CI, READY Vercel Preview, bounded independent review and main production checks pass.
- **Stop conditions:** changes to global SEO policy, cookies/authentication or published directory metadata require a new scoped PR/decision.

## Limits
Search-engine noindex is advisory and does not secure an unlisted URL or guarantee removal from search caches. Access control, creator authorization, rate limiting, abuse monitoring, isolated hosted Supabase/browser QA and explicit feature activation remain separate release gates. This page-only safeguard does not make Custom Lineup publicly playable.
