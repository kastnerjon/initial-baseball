# A4 exact-ID practice navigation — November 10, 2026

## Scope contract
**Goal:** Make already-published secondary official Daily editions navigable as guest **practice** from the single past-date Archive and today's chooser, reusing the exact-ID practice page already source-integrated in #608.

**Owner:** Next.js server-rendered Archive/chooser presentation and focused web SSR tests. Pure Daily/engine, scoring, issuer, Auth, Supabase schema and underlying exact-ID runtime remain unchanged.

**In scope:** Render a publication-validated, URL-encoded exact `daily-ed-v1-UUID` and Pacific date link from each secondary metadata row; label it practice-only and noncompetitive. Preserve legacy primary `puzzleId:null` entries as unlinked and maintain one date-grouped Archive, paging and beta. Confirm the already existing four Archive/choice switches and independent three destination gates, no private data reads when OFF.

**Out of scope:** Adding or relaxing flags, public launch, changing published content, score writes, A3 signed competition (#566), historical primary replay (#589), backend/session authority, new schema/credentials, tracking fields, Custom/Auth or an unrelated UI redesign.

## Verification and stop conditions
- Tests must prove exact immutable ID and date URL shape for different date groups, no URL for legacy primary, escaped user title, safe pagination and default-OFF 404/no provider I/O. The existing route tests must continue to reject malformed IDs/dates and nested answer payloads. Confirm no score, answer, token or account data in links.
- Require full exact-head CI, hidden-answer production build audit, file-size/typecheck/test checks, READY matching Vercel Preview, independent final-head reviews. After source merge, protected hosted isolated QA and physical iPhone Safari/Android Chrome acceptance with real published secondary fixtures and Pacific rollover before production activation.
- Stop at any private-answer disclosure, competing result admission, wrong-date link, premature schedule/future publication link, direct service-role browser access, or new authorizing policy. Do not turn on feature flags or deploy migrations in this PR.

## Documentation impact
This alters only the web UI navigation presentation behind existing strict server switches. Update the canonical API description, project handoff and active release gate; do not redefine the existing product, editor/publication, shared gameplay or scoring contracts.
