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

## Additional QA-only quota evidence

When public-creator QA is opted in, the runner now also uses one fresh reserved-documentation IPv6 address for 11 consecutive valid create calls (10 accepted, 11th 429 with Retry-After) and checks that a malformed selection does not spend quota. A separate randomized address remains independently admissible. The acceptance run creates 11 additional disposable challenge rows; it does not alter the API's quota semantics or prove real Vercel ingress/WAF behavior. This live QA scenario **still requires separately provisioned QA-only credentials** and is not run by the default CI startup-guard tests. Details: `tasks/plans/custom-v2-creation-quota-hosted-qa.md`.

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

## October 22 — committed response-loss diagnostic (#471)

**Scope contract:** Test-only documentation of the existing anonymous issuance
retry behavior, owned by `apps/web` creator-service tests and the opt-in QA
HTTP runner. This does not choose or implement an idempotency/persistence
contract, recover an owner secret, alter quota or enable public creation.
Production flags remain OFF. Any attempt at server-side replay recovery or
reuse of owner credentials is a distinct design/architecture decision.

A focused mocked-repository unit test now exercises a successful private
creation-service insert followed by an intentionally undelivered response and
the same anonymous creation again. It expects a second distinct puzzle ID and
owner capability, with only digests in the repository calls. This is an
executable check of current service behavior, not a true network interruption.

In the **opt-in isolated QA** runner, one 201 response is deliberately
ignored by a simulated creator before retrying an identical name and ordered
two-player selection from the same QA-only synthetic ingress address. The
expected results are two successful, distinct challenges and owner codes;
both consume their own issuance and quota reservation. The test does **not**
cut a live TCP stream, prove any real hosted Vercel ingress/WAF behavior, or
allow reconstruction of the first lost owner capability. It creates two
additional disposable QA challenges (35 total on the full successful public
QA path, versus 33 previously). No credential-backed run is claimed until
that guarded mode actually executes against isolated QA.

**Pending product decision (#471):** For Phase 1, either accept and clearly
disclose irrecoverability after an ambiguous creation failure, or design
server-authoritative idempotent issuance with secret-safe recovery and
concurrent retry semantics as a separate persistence-contract change.
Do not silently interpret a retry as recovery.
The current public creator client does not automatically retry a failed create request; after an ambiguous response failure, a manual retry is a separate creation under the present API. A challenge-specific creator-preview cookie is not a recoverable management capability. These constraints require explicit product acceptance or a separately reviewed contract change before claims of response-loss recovery.

## October 22 — ambiguous creation outcome feedback (issue #471)

**Scope:** In the existing `apps/web` anonymous creator, distinguish uncertain
issuance outcomes without claiming a failed response means no database commit.
Preserve the draft, do not automatically retry, and explain that retrying creates
another immutable challenge (and spends a creation attempt) without recovering
any lost owner code. No new server idempotency, owner capability readback,
schema, auth, WAF or activation is in scope.

Known rejection statuses (400, 422, 429) retain their specific responses.
For public creation only, unexpected 409/5xx, network exceptions and malformed
successful responses show the same conservative uncertainty warning. The admin
creator's behavior is unchanged. This is a communication safeguard, **not
recovery**; #471 remains open for a separate idempotency/product decision.

The optional local native Chromium suite simulates an HTTP 503 and an HTTP 201
with invalid JSON at N=2 and N=3. It verifies the warning, absence of falsely
issued links/owner codes, original ordered editable draft, no automatic second
request, and successful manual retry. The existing 429 retry and lengths 1–10
also remain covered. Tests use mocked creation HTTP and real browser/React;
they do not demonstrate a severed TCP response, live QA commits or WAF.

The browser QA runner can optionally take a sandbox-local Chromium executable
path through `CUSTOM_CREATOR_BROWSER_QA_CHROMIUM_EXE`. Its existing explicit
Playwright module requirement and loopback-only isolated process remain.
No new application/package dependency is introduced.
