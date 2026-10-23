# Initial Baseball — Current Work

Last reconciled against live GitHub, Vercel and Supabase evidence on October 23, 2026. `docs/START-HERE.md` records verified release evidence; completed work belongs in PRs and plans, not this active list.

October 23 release checkpoint: PR #498 merged on main `3dc1e0a1`; production is READY and public Custom flags remain OFF. The actual isolated-Supabase public creator/friend suite succeeded with local Next production HTTP, signed scoring, 1–10-player attempts, duplicate/replay rejection and quota concurrency. The negative-ingress simulation was corrected in #498. This **does not** verify real Vercel WAF, native browser-cookie continuity, physical devices, or rollback. Issue #471 still has no idempotent response-loss recovery. Draft PR #499 stages optional native Chromium + signed isolated-QA continuity but its real-browser database run has **not occurred**.

Remaining Custom launch gates are listed below; October 23 acceptance evidence and retained fixture accounting are recorded in `tasks/plans/custom-v2-qa-next-ingress-negative.md`. Production Custom flags remain OFF.

## 1. Complete Custom Lineups Phase 1 launch gates

The post-generation canonical-to-Custom issuance regression guard **merged in PR #483**; exhaustive real-data QA covered 13,620/13,620 canonical searchable identities (main CI 39715714165, production READY at `7c3b031b`). This is **data/issuer compatibility evidence only**, not creator-to-friend HTTP, WAF, physical-mobile or rollback acceptance. PR #485's secret-safe action/status diagnostics for unexpected gameplay HTTP 503s merged after independent review as `81f896c`. Issue #472's browser request-lifetime repair merged in PR #486 (984006f). Issue #470's cookie-less race was also reproduced in a local Chromium dual-tab/delayed-cookie diagnostic: late cookie replacement hid progressed attempt state. The scoped browser-lock repair merged in PR #488 (scope/evidence: tasks/plans/custom-v2-cross-tab-bootstrap-lock.md); isolated-QA and physical-device acceptance remain required.

PR #488 merged as `411d5ac` after independent agent review; #487 was closed as duplicate. The repeatable native Chromium interruption harness in `apps/web/scripts/qa-custom-bootstrap-browser.mjs` exercises the actual browser transport and request controller against a **simulated loopback ledger**. Its controlled cookie/lock results are recorded in `tasks/plans/custom-v2-bootstrap-interruption-qa.md`; they do not establish signed hosted creator/friend or physical-device acceptance. #470 remains open.

Public creation, unlisted sharing and signed 1–10 gameplay are staged behind server-side flags. Production `/create` currently returns 404; leave both Custom flags OFF until every launch gate below passes.

- [x] Complete the isolated-QA local Next public creator → owner code → friend signed gameplay acceptance for N=1–10, immutability, creator exclusion, replay/duplicate completion, quotas (10 accepted / 11th 429 with `Retry-After` / independent IP), concurrent quota reservations (10 accepted / 2 denied) and accounted retained fixtures. Evidence: `tasks/plans/custom-v2-qa-next-ingress-negative.md`. This checked item is **not** a claim of actual Vercel WAF, signed native-browser continuity, physical devices, or recovery of a committed but lost creation response.
- [ ] Complete Vercel WAF entitlement and enforcement verification. Project API metadata shows SSO protection enabled for non-custom domains; password protection and trusted IP protection are disabled. Active firewall-config lookup returns 404. Authenticated Vercel Git deployment context confirms a Hobby team; current docs permit one fixed-window WAF rate-limit rule on Hobby (token bucket requires Enterprise). Active/staging firewall reads return 404 and the authenticated dashboard remains inaccessible, so an installed rule and its enforcement are unverified. Inspect the existing configuration before editing; stage a log-only route-scoped rule for `POST /api/custom-lineup/create`, verify actual controlled enforcement, and document disable/publish rollback. If unavailable, retain the independent server-side creation quota and keep public creation OFF. Do not weaken deployment protection. See `tasks/plans/custom-v2-live-vercel-ingress-evidence.md`.
- [ ] Complete creator and friend gameplay acceptance on real iOS Safari and Android Chrome, including keyboard/autocomplete, two-tap swap, sharing, owner-code separation, results and navigation. Chromium viewport coverage is simulated mobile testing, not physical-device acceptance.
- [ ] Run a reversible production rollback drill without enabling public creation. After all previous gates pass, perform a controlled flag rollout and verify production routes, issuance, scoring, logs and database state before calling launch complete.

## 2. Gated creator navigation: implemented on main

The two-flag-gated `/create` entry in the Daily footer, the creator return link, narrow-screen wrapping, and focused static-render tests are already present on main (`54e559f`). Both production flags remain OFF. No additional navigation change is needed; the `tasks/plans/custom-creator-navigation.md` scope is satisfied by the shipped code.

## 3. After Custom Lineups launch

- [ ] Resume the deferred version-aware Daily editorial horizon inspection in draft PR #434 only after Custom launch; preserve Daily Nine, Archive and Classic behavior. Do not merge until its independent review is available.
- [ ] Continue the approved administrator-configurable Daily Lineup design and issuance stages. Freeze each lineup length into the issued contract; retain all historical nine-player Daily/Archive results and Classic.
- [ ] Consider public Custom publishing, Discover and leaderboards only after private sharing and first-attempt integrity are stable. They require separate moderation, ownership, privacy, abuse and activation decisions; see `tasks/plans/community-custom-lineups.md`.

## Deferred polish

- Native share-sheet support for the existing unlisted friend link is optional; preserve the tested Copy link/selectable URL fallback. Scope: `tasks/plans/custom-native-share.md`.

## 4. Required before broad launch

These are separate from the Custom Lineups Phase 1 gates above. Keep them active until each has production evidence; the canonical source of truth is `docs/product/daily-inning-blueprint.md`, under “Required before broad launch.”

- [ ] Complete full authenticated admin and public-runtime production QA.
- [ ] Complete real-browser gameplay and refresh QA on common iPhone/iPad sizes.
- [ ] Verify compact completed-result persistence and same-Daily/same-ruleset comparison.
- [ ] Decide the launch game, final launch rules, and launch date/numbering epoch before beginning permanent archive/history from Daily #1.
- [ ] Confirm calibrated recognizable lineups.
- [ ] Verify analytics and error monitoring.
- [ ] Complete privacy/terms, canonical domain, and social metadata.
