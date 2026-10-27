# Verified account-owned Custom issuance storage — scope contract

Goal: support one atomic database row insert that freezes a new version-2 Custom puzzle and its server-verified creator UUID. This is the database/service foundation only; it does not change the public issuer or enable production.

Owning layer: Supabase private issued-challenge schema and `apps/web` private issuance repository/service.

In scope: nullable `creator_account_id` foreign key to `auth.users(id)`, additive version/owner-code exclusivity constraint, private list index, writer encoder, explicit `issueForAccount(payload,title,verifiedAccountId)`, and focused tests. The service requires a canonical UUID string as defense in depth; the future HTTP route must derive it exclusively from the verified Supabase Auth session.

Out of scope: UI, browser auth flow, modifying existing anonymous challenges, historical claim, publisher management, gameplay/admission, public table grants, any QA/production Supabase migration application or Custom feature activation.

Acceptance: legacy rows remain valid, new accounts use an atomic insert with an answer-free response, invalid account IDs fail before materialization/provider access, owner-capability codes are not minted for verified accounts, collisions remain fail-closed, exact-head full CI, independent review, and isolated-QA migration rehearsal before production application.

Stop: schema incompatibility in QA, unreviewed production DDL, authorizing from any client-submitted account ID, or pressure to activate the old anonymous creator route.
