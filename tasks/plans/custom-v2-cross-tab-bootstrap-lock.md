# Custom Lineup browser bootstrap coordination — #470

## Scope contract

- Goal: When two same-origin tabs open the same private Custom Lineup concurrently with no attempt cookie, the second HTTP bootstrap must wait for the first response's cookie to be committed and then resume that first attempt.
- Owning layer: apps/web browser transport.
- In scope: Acquire a challenge-scoped, exclusive browser Web Lock around the complete bootstrap POST/response decoding; preserve locked failure behavior; show an actionable error on unsupported browsers; add deterministic concurrent-tab, delayed-response, malformed-response and unsupported-browser transport regressions; reconcile the work list.
- Out of scope: No server token, cookie format, database, attempt identity, scoring, signed progression, creator preview, other gameplay action, new dependency, public feature activation, QA data or WAF change.
- Acceptance: Focused transport and HTTP-contract tests; web typecheck; workspace tests, lint, file-size and documentation checks; reviewed PR with exact-head CI and READY Preview before merge; real browser recheck before issue closure or Custom activation.
- Stop: If ordinary browser locking proves insufficient or release requires support for Web-Locks-unsupported browsers, decide a separate protocol/security approach rather than adding client-controlled identity or database persistence in this repair.

## Why a browser lock belongs here

The server issues a random signed HttpOnly challenge cookie whenever the request carries no credential. Two cookie-less requests are indistinguishable as to whether they came from one browser, so independent parallel server issuance may create two legitimate ledger attempts. Server revision CAS only protects an attempt already selected by its credential. A previous Chromium diagnostic reproduced a late Set-Cookie overwriting a progressed attempt's cookie, causing refresh to reopen an apparently fresh attempt while the first attempt remained stored.

The existing Daily gameplay request controller stops overlapping actions within one mounted React lifetime, not across tabs or obsolete in-flight network requests. This change instead uses the standard same-origin Web Locks API directly in the browser transport: the lock key includes the validated challenge ID, so different challenges do not block each other. The lock holds through POST and response decoding. A second tab's fetch begins only after the first browser response's Set-Cookie has been processed. No extra request fields, new client-generated credential, localStorage identity or server trust are introduced.

The Web Locks API is available on modern Chrome, Firefox, Safari and current mobile browsers. An unavailable or rejected lock fails closed rather than silently triggering the known initialization race; the UI prompts browser updating where unsupported. This is a deliberate compatibility limit requiring physical-device validation.

## Security/architecture impact

No changes in portable shared, engine, daily or baseball-data packages. No new packages, APIs, external dependencies, persistent browser identifiers or altered database policies. Authenticated cookie inspection, creator marker exclusion, signed atomic attempt operations, immutable issued lineup, hidden-clue redaction and completion admission remain server-authoritative and unchanged.

Limits: Browser locks coordinate participating same-origin contexts within the same storage partition. They are not authentication or a guarantee of one attempt per unique human; cleared cookies, different profiles/devices, programmatic clients, nonparticipating old builds, aborted document lifetimes and separate storage partitions remain beyond this browser-only mitigation. The original issue's full hosted QA, iOS Safari, Android Chrome, completion and cookie-order rechecks remain release gates. Do not close #470 as comprehensively verified on deterministic unit tests alone.

## Evidence

- Previous uncommitted server-service diagnostic: simultaneous cookie-less calls produced distinct signed cookies and two mock attempt rows.
- Previous local Chromium dual-tab diagnostic: delayed cookie overwrote the credential used by progressed gameplay; refresh showed the other attempt; seven cases established the behavior, not hosted QA.
- This PR's Vitest regressions emulate two tab transports sharing one exclusive lock and cookie jar. They check one issuance, resumed signed progress after delayed response, failure release and unsupported browser fail-closed. These are controlled transport tests, not physical-device or real hosted Supabase evidence.

## Review disposition and portability

The existing per-React-generation controller is deliberately retained rather than duplicated. The sole additional coordination primitive is platform-specific and lives inside apps/web. One bounded independent review should assess lock lifetime, unsupported-browser behavior, and server authority before merge. New distributed identity, hosted evidence or compatibility requirements become follow-up decisions.
