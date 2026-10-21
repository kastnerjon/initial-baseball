# Local browser acceptance for staged Custom Lineup creator

## Scope contract

- **Goal:** Make the agreed nine-default, 1–10-player Custom creator repeatably testable at mobile and desktop widths before public activation.
- **Owning layer:** `apps/web/scripts`, QA harness only.
- **In scope:** Disposable localhost Next.js server, browser-mocked player search and create POST, default nine slots, all lengths 1–10, canonical ID ordering, playing years and teams, duplicate prevention, two-tap swaps, keyboard Escape, issued lock, separate owner credential, and no horizontal overflow from 320–1280px before or after issuance (including the private owner code/share URL); a mocked HTTP 429 followed by retry preserves the same draft.
- **Out of scope:** Production code paths, live issuance, Supabase, genuine Vercel trusted ingress, WAF, physical mobile/Safari, real creator-to-friend gameplay, feature flag activation, new runtime packages or product rules.
- **Acceptance:** Standalone browser script passes all ten lengths and six widths with no browser errors; existing focused web tests, startup guards, typecheck, size checks, exact-head CI and READY Preview; independent review.
- **Stop:** Fail closed on missing browser binaries. If genuine backend or security changes are needed, open a separate bounded task rather than changing the production runtime in this PR.

## Running the optional browser QA

Build the existing workspace and install dependencies. In a disposable QA sandbox, install Playwright **1.64.1** and its Chromium binary using:

```sh
npm exec --yes --package=playwright@1.64.1 -- playwright install chromium
```

Minimal Linux images may also require `playwright install-deps chromium`. Locate the installed `playwright/index.mjs`, set `CUSTOM_CREATOR_BROWSER_QA_PLAYWRIGHT_MODULE` to its **absolute path**, and run:

```sh
node apps/web/scripts/qa-custom-creator-browser.mjs
```

The test starts a short-lived Next.js server bound to `127.0.0.1`. It enables the two Custom feature gates only in the child process and deliberately clears Supabase server credentials and Vercel provenance. Chromium intercepts **only** canonical player search and public issue POST, returning test-only identities and a synthetic owner code. It stops the browser and child server even when assertions fail.

## Evidence and release boundaries

October 21, 2026: in a disposable Chromium sandbox, the full 1–10 flow passed at six widths both before and after issuance. A first-request mocked HTTP 429 kept the creator selection intact and a retry succeeded with HTTP 201; all 10 successes kept the separate owner code out of the friend share URL. These are simulated HTTP responses, not proof of live quota enforcement. The browser test proves local interaction and responsive rendering. Mocked issuance is **not** proof of real Supabase persistence, signed friend gameplay, quota enforcement, actual Vercel forwarding-header authentication, WAF effectiveness, or physical Safari/Chrome acceptance. Hosted QA remains in `tasks/plans/custom-v2-public-creator-hosted-qa.md` and requires isolated QA service credentials and explicit later approval. Keep production public creation **OFF**.

## Documentation impact

Records the QA procedure and its evidence boundary; no production product, data contract, security or release settings are changed.
