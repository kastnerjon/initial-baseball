# Custom v2 — isolated hosted PostgreSQL all-length regression

Status: Test-only bounded PR. No application behavior or database migration changes.

## Scope contract

- **Goal:** Preserve the completed, isolated hosted-Postgres v2 regression evidence in repeatable rollback-only SQL tests for every N=1–10, including legacy Custom Nine compatibility.
- **Owning layer:** `supabase/tests` PostgreSQL validation fixtures.
- **In scope:** Expand the five existing Custom v2 test fixtures from N=1/5/9/10 to all N=1–10; adjust only deterministic expected insert counts; reconcile current canonical checkpoint documentation.
- **Out of scope:** Next.js/server/HTTP/browser integration, creating/activating public lineups, credentials, auth, RLS changes, schema migrations, production data, mobile QA, publication/discovery/leaderboards, or billing upgrade.
- **Acceptance:** All five SQL fixtures execute successfully on an independently created, empty hosted Supabase QA project with full Custom v1/v2 schema; they each ROLLBACK; the existing legacy v1 bucket test also passes; both QA and production Custom row counts remain zero; exact-head CI and READY Vercel Preview; one independent fresh-eyes review.
- **Stop conditions:** Any fixture unexpectedly persists rows or contacts external services; schema/privilege changes are required; hosted HTTP attempt needs unavailable staging-only server credentials; product logic needs modification. Log the larger issue separately.

## Verified hosted execution

On October 16, 2026, Supabase branching was unavailable because the owning organization is on the Free plan. A dedicated **$0/month standalone QA project** was created in the same organization, isolated from production (not a Supabase branch). Only the ten Custom Nine/v2 schema/RPC migration files were applied to it, deliberately excluding the production-pointing Daily ChatOps and cron integrations. The five updated N=1–10 SQL checks, and the unchanged legacy Custom Nine comparison check, succeeded in PostgreSQL. Fixture writes were transaction-rolled back. Confirmed the four Custom tables were all still at zero rows in both QA and production.

**Evidence classification:** These are real hosted PostgreSQL schema/RPC checks, NOT a browser-to-Next.js-to-Supabase test. PR #426's existing local app HTTP runner remains unexecuted against a hosted database. Supabase tools expose only public/anon keys for the staging project, not a staging-only secret/service-role key. Do not reuse production credentials or weaken permissions. The next isolated HTTP run needs a securely provisioned staging-only server secret and separately reviewed server configuration. Creator exclusion, signed HTTP progression, actual browser/mobile UX, and final activation remain unverified in a hosted application session.

No staging environment keys were committed. Production gameplay stays disabled.
