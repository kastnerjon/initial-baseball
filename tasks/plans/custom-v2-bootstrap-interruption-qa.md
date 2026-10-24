# Custom bootstrap document-interruption QA — #470

## Scope contract
- Goal: determine whether terminating a document holding the native bootstrap lock can let its delayed HTTP Set-Cookie replace the credential used by a surviving tab.
- Owner: apps/web QA harness; browser transport is the existing product code under test.
- In scope: a repeatable loopback-only HTTP fixture, actual browser transport bundle, native Web Locks and HttpOnly cookies, delayed headers/body, close/navigation/React-generation-style invalidation, progress/completed resume, and a no-lock positive control.
- Out of scope: no product identity/protocol, server/database schema, scoring, public flags, credentials, WAF or production operations. Fixture state is explicitly simulated, not hosted acceptance.
- Acceptance: bounded Chromium run for representative N=1 and N=10; control must demonstrate competing credentials; locked scenarios must resume the surviving attempt; focused existing transport/controller checks; file-size/doc checks and normal PR CI.
- Stop: if an interruption causes competing usable credentials or silent reset, record precise evidence before choosing any fix. Changes to identity, persistence, authority or compatibility require a separate decision.

## Architecture
Browser coordination belongs in apps/web. Reuse the actual Custom browser transport and existing Daily request controller; do not duplicate the locking implementation. QA may use existing TypeScript/Vite test tooling and an externally provided Playwright installation, following the existing creator-browser QA pattern. Domain packages remain unchanged. This adds acceptance evidence, not a product or API contract.

## Evidence
Execution results are recorded below. Native-browser cookie scheduling is distinct from server-service mocks. A local simulated endpoint cannot prove signed database CAS, creator exclusion, deployed Vercel behavior, physical Safari/Android or hosted completion admission.

## Executed October 22 — actual browser, simulated endpoint

Product source baseline: `411d5ac4786d8039254664c189348fdba014c8c4` (#488 merged). The harness bundles **unaltered** `customLineupV2BrowserTransport.ts`, its real payload codecs/engine normalization, and `dailyGameplayRequestController.ts`. It uses Playwright with Chromium **153.0.8010.0**, native `navigator.locks`, real loopback HTTP responses and path-scoped HttpOnly/SameSite=Strict cookies. Playwright permits requests only to the ephemeral loopback origin; it never fulfills a simulated fetch response in the browser. The server-side ledger and progression strings are synthetic, not signed application state.

Final harness run: **14/14 PASS**, seven scenarios for each N=1 and N=10:

| Scenario | Observed result |
| --- | --- |
| Unlocked positive control | Two distinct cookies/ledger entries; delayed first response replaces the cookie used by progressed second tab; reopening appears reset. Required control reproduces the fault. |
| Two live tabs, exclusive lock | Only one request reaches the server while first response is held; waiting request carries first cookie; one ledger entry. |
| Close lock-holder before headers | Browser closes first response connection; survivor gets second credential. Two fixture entries exist, first is orphaned. Late attempted response does not replace survivor cookie. |
| Navigate lock-holder before headers | Same connection cancellation and survivor continuity as close. |
| Close after headers, before body | First cookie is already applied; survivor resumes it after lock release; one entry. |
| Malformed first response body | First transport rejects `invalid_response`; lock releases; waiting request reuses already-applied cookie. |
| Invalidate request generation while bootstrap held | Actual request controller suppresses obsolete callback; native lock holds until first request settles; only new generation paints, with one entry. This is controller integration, not a mounted React test. |

All locked scenarios then reload the surviving document, reopen fixture progress (one strike), mark the fixture completed, reload again and recover exactly N terminal facts without a live progression token. The interrupted-document tests explicitly await the first server response's `close` event **before** releasing its delayed output, so connection cancellation is observed rather than inferred from the final cookie alone.

**Conclusion:** no late-cookie overwrite or progress reset was reproduced with the merged lock under these controlled Chromium schedules. No product fix is justified by this evidence. Two server reservations after a pre-header cancellation are possible; the test proves only one credential remains in the tested cookie jar. It does not prove one attempt per human or absence of every timing race.

## Reproduce

Use an installed workspace and a separate QA-only Playwright installation with Chromium:

```sh
CUSTOM_BOOTSTRAP_QA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node apps/web/scripts/qa-custom-bootstrap-browser.mjs
```

Optional `CUSTOM_BOOTSTRAP_QA_CHROMIUM_EXECUTABLE` selects an absolute local browser binary. Optional `CUSTOM_BOOTSTRAP_QA_ESBUILD_MODULE` selects an absolute existing esbuild module; normally esbuild is resolved from the installed Vitest/Vite toolchain. No dependency or lockfile is added to the product. No server URL, database ref or secret is accepted by the harness.

This Work environment's ordinary Playwright browser download returned a truncated archive. The successful run used Chromium bundled in the QA-only `@sparticuz/chromium@153.0.0` package, outside the repository, with its binary extracted locally. Workspace install with pnpm 9.15.0 stopped on a registry 403 for `cacache-18.0.4`; this is not a source/test failure. The native run used the already-fetched esbuild 0.21.5 and actual source aliases without a full dependency pipeline. Full CI remains a reviewer gate.

## Still unverified

The fixture does not exercise the actual Next HTTP handler, signed-cookie codec, creator marker, immutable issued DB rows, SQL CAS/completion admission, real creator/friend separation or hosted quota. A simulated progress/completion update is not evidence those services work. Physical iOS Safari/Android, alternate browser versions, Vercel WAF enforcement/reversal and production rollback remain release gates. QA dashboard authentication is available in Sol's handoff, but its server key was not provisioned in this session. Both public flags remain OFF, and #470 stays open.

## Focused validation

- Final native harness: 14/14 scenarios PASS after adding explicit canceled-connection observation.
- Existing transport/controller Vitest tests: **26/26 PASS** using Vitest 2.1.9, the two unchanged source test files and source aliases for engine/shared. Temporary tooling/config stayed outside the repository.
- Both new scripts pass `node --check`; documentation-impact unit tests 4/4 PASS; file-size and whitespace checks PASS.
- No product source, dependency manifest, lockfile, production setting or database changed. Independent review and complete PR CI remain pending.

## Exact-head CI gate follow-up — October 22

At original PR head `e1a9ab1c283a2aa984f6ba23c51e874756f20647`, GitHub Actions CI run `39835204374` completed: full `test` job SUCCESS; `documentation-impact` job FAILURE solely because the PR body used `## Architecture and documentation impact` rather than the exact CI-required `## Documentation impact` section. All documentation-impact unit tests passed; failure was in the PR-body heading assertion. The separate exact-head Vercel Preview `dpl_8LyiV5cMGR18kJxNTKgCuN8PxFCw` was READY. The PR body was corrected with the exact heading. This documentation-only commit is intended to trigger a fresh pull-request CI event; do not merge before the replacement head has successful required CI and READY Preview. The independent agent's reviewed product/QA code has not changed.


## October 23 — staged native browser + signed QA database continuity (not executed)

An optional, **unexecuted** cross-tab integration path now bridges native Chromium
Web Locks/HttpOnly cookies to the actual local Next production server and the
hard-pinned isolated QA Supabase database. It reuses the existing public creator
and server-owned signed gameplay behavior without mocking HTTP responses.

With the existing `CUSTOM_V2_QA_PUBLIC_CREATION=true` QA-only preflight, built
Next server and designated isolated project credentials, set
`CUSTOM_V2_QA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs`.
The external QA-only Chromium binary may be set through
`CUSTOM_V2_QA_CHROMIUM_EXECUTABLE`. The optional mode creates one additional
challenge for N=1 and N=10, concurrently bootstraps two same-context tabs,
checks exactly two real bootstrap requests (one cookie-less and one carrying
the challenge-specific HttpOnly cookie), checks identical signed tokens,
progresses one hint, resumes from the other tab, completes and submits, and
reopens the completed attempt. Token equality alone is not proof of one
reservation: independent first opens can share an identical initial signed
progression token. The browser request-cookie assertion guards that false positive
without logging secret cookie values. If passed, it
adds two issued challenges, two attempts, two completions and eleven at-bats.
Fixture retention must be accounted for after the run.

Four fail-closed origin/module preflight tests pass locally, and the helper
passes `node --check`. **No signed browser/database acceptance result is
claimed**: QA-only credentials and the development sandbox are unavailable
in this conversation (Vercel Hobby Sandbox limit resets November 1). This
does not control deliberately delayed responses or prove physical Safari/
Android, actual Vercel WAF, production compatibility or cookie uniqueness
across profiles. Preserve issue #470 and the launch gates until the signed
browser run and distinct physical-device checks are documented.

## Fail-closed native QA mode configuration

A configured but empty Playwright module path or a requested native run without `CUSTOM_V2_QA_PUBLIC_CREATION=true` is rejected at the runner's initial, side-effect-free preflight rather than silently passing the HTTP-only suite. Two dummy-credential child-process tests check this refusal before any fixture is created or contacted.

This protects the evidentiary distinction between HTTP-only acceptance and actual signed native-browser execution; the latter is still **not performed**.

## Staged signed-browser continuity extension — October 24

PR #499's optional signed Chromium runner now includes a real server-committed resolve whose response is deliberately aborted at the browser boundary, followed by navigation, refresh, reopening in a new tab, completion, and first-result/replay admission checks. The request is forwarded to the local Next server backed only by the pinned isolated QA project; its 200 response is observed before the browser receives an `internetdisconnected` abort. These assertions are staged coverage only. The run has **not** occurred because QA service credentials are not provisioned in the current workspace, and Vercel Preview is confirmed to point at production. No Preview or production signed test was run. Do not count this extension or its simulated response loss as actual hosted-browser acceptance until the credential-backed run passes.

The product and architecture specifications need no update: this PR adds QA evidence for the already-required signed attempt continuity and does not change runtime behavior or product rules. This plan records the new acceptance scenarios and preserves the distinction between a staged test and a passed hosted-browser run.

## Staged native-browser creator response drop — October 24

The existing hosted Node check receives the first HTTP 201 response and then discards its data before an explicit retry; it is simulated client-side loss, not a network interruption. The optional native Chromium path now drives the actual `/create` creator screen. It uses a deterministic suggestion response for a QA-valid fixture player, then forwards the real `POST /api/custom-lineup/create` to the local QA-backed Next server, observes the successful issuance response, and aborts delivery with `internetdisconnected` before the page receives it. The creator UI must show its truthful uncertainty message, preserve the title/player selection, and make only one request until the user explicitly retries. That click must issue a distinct challenge and owner capability, which the UI displays separately from the share link. Owner-code values are checked only through boolean assertions and are not written to logs.

This extension is staged only. It has not run against isolated QA because the required QA-only process credentials and Playwright module are unavailable in the current workspace. It does not change the approved #471 manual-retry behavior, add issuance idempotency, or prove any production behavior. Keep #471 and #470 open until the credential-backed run and their separate acceptance criteria pass.
