# No-sign-in Custom Lineup creator → friend hosted QA (staged)

## Scope contract
- **Goal:** Extend the already-tested isolated-DB, localhost Next.js v2 HTTP acceptance runner to exercise the real anonymous creator POST and page, private owner-code response and creator-versus-friend behavior for all N=1–10, including third strike and Give Up.
- **Owning layer:** `apps/web/scripts/qa-custom-v2-hosted.mjs` test harness.
- **In scope:** Explicit optional public QA mode, aggressive nonproduction/credential preflight, local simulated Vercel header tests, named public issuance, separate one-time ownership code, same existing friend gameplay and signed-attempt checks, guard tests.
- **Out of scope:** Public feature activation, new production database state, edge/WAF configuration, runtime game/business logic, new source packages, actual mobile browser testing, publishing/Discover, My Results.
- **Stop:** Any need to weaken Vercel production trust checking, substitute production DB/secrets, or claim synthetic header tests establish real ingress authenticity requires a separate security decision.

## How to run only in isolated QA
The existing `qa-custom-v2-hosted.mjs` remains **admin mode by default**. Its normal environment validation and nine-player v1 compatibility are unchanged. To exercise anonymous issuance, opt in to ALL three staging-only controls:

- `CUSTOM_V2_QA_PUBLIC_CREATION=true`
- `CUSTOM_LINEUP_PUBLIC_CREATION_ENABLED=true`
- `CUSTOM_V2_QA_SIMULATED_VERCEL_INGRESS=true`

Also supply an independent (at least 32-character) **QA-only** `CUSTOM_LINEUP_CREATION_BUDGET_SECRET`; the existing QA project ref/HTTPS URL/service-role key, QA signing secret, gameplay flag and ten distinct fixture canonical IDs remain required. No administrator credential is required in the no-sign-in mode. Never use production DB/service-role secrets. The script refuses the hard-coded production Supabase ref and binds Next only to local loopback.

Only the Next child process is set to simulated `VERCEL=1, VERCEL_ENV=preview`. Twelve fixture issuances each use a distinct reserved TEST-NET IPv4 address (`192.0.2.0/24`) to avoid exhausting the same ten/ten-minute per-IP budget. This simulation tests our *application* boundary on local HTTP. **It does not prove that Vercel actually overwrites the ingress header**, that firewall thresholds work, or that the application behaves on iOS/Android.

## Assertions and release boundaries
The opt-in variant:
1. Loads the guarded `/create` page; creates named N=1–10 unlisted challenges using `POST /api/custom-lineup/create` without Basic auth.
2. Verifies one-time, 43-character base64url owner code is returned separately from the challenge URL and not in response headers/creator-page HTML; requires an HttpOnly creator-exclusion cookie.
3. Refuses cross-origin creation (403) and missing trusted-ingress creation (503) without successful issuing.
4. Reuses the tested private link, zero-answer HTML/bootstrap, creator preview exclusion, friend first-play continuity, earned hints, signed CAS resolve, all lengths, alternate terminal paths and accepted first-only completion results.
5. Preserves default admin QA behavior with no public flag or simulated trusted headers.

No command is executed against production and **no public rollout is authorized by this PR**. After this harness passes with **QA-only credentials**, release still requires actual browser/mobile origin-to-database acceptance under real Vercel ingress, WAF/privacy check, rollback/feature-gate inspection, exact-head CI/Preview and controlled promotion.

## Documentation impact
This plan and `tasks/todo.md` document the staged no-sign-in acceptance coverage and remain explicit that actual hosted QA execution, provider authenticity, mobile/WAF and activation have not passed.
