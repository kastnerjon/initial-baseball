# Creator account auth foundation — scope contract

Owner: `apps/web` server auth routes and session adapter, backed by Supabase Auth's stable `auth.users.id`. A publishable key is used only in this request-scoped client; the existing service-role puzzle repository remains separate.

Files: `serverCreatorAccountAuth.ts`, `/account`, `/auth/callback`, `/api/account/{session,auth/*}`, the pinned SSR dependency and tests. Server-only `CREATOR_AUTH_ENABLED` defaults OFF; `CREATOR_AUTH_SITE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, provider settings and redirect allowlist must be configured for each environment. Email template must show `{{ .Token }}`. Provider linking follows Supabase's verified-email linking behavior; there is no custom email-based merge or authorization by metadata.

Acceptance: same-origin POST, fixed callback destination, PKCE exchange, verified nonanonymous `getUser` identity, safe session refresh cookies, no-store responses, signout, disabled/misconfigured fail closed. Google/Apple/OTP require actual isolated-QA configuration and browser verification before claiming operational status. Existing Daily/Custom gameplay and anonymous issuance storage remain unchanged. The `/create` issuer must stay OFF and cannot be activated by this milestone.

Exclusions: no ownership schema, issuance authorization, draft transfer, legacy claim, My Creations, public profile, gameplay admission switch or production flag change. Stop if provider credentials or exact-head review/deployment are unavailable; leave this PR open with an accurate checkpoint.
