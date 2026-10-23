# Initial Baseball — Current Work

Last reconciled against GitHub, Vercel and Supabase on October 23, 2026. This file tracks remaining, unchecked work; completed QA and rollback evidence belongs in `docs/START-HERE.md` and its linked plans.

Remaining Custom launch gates: real signed hosted-browser/cookie continuity (#470), genuine WAF enforcement and reversal, physical iOS/Android acceptance, and controlled enabled-feature rollout with a new rollback assessment. The response-loss product/security decision (#471) is required before that rollout. **Both production Custom flags remain OFF.**

## 1. Complete Custom Lineups Phase 1 launch gates

The post-generation canonical-to-Custom issuance regression guard **merged in PR #483**; exhaustive real-data QA covered 13,620/13,620 canonical searchable identities (main CI 39715714165, production READY at `7c3b031b`). This is **data/issuer compatibility evidence only**, not creator-to-friend HTTP, WAF, physical-mobile or rollback acceptance. PR #485's secret-safe action/status diagnostics for unexpected gameplay HTTP 503s merged after independent review as `81f896c`. Issue #472's browser request-lifetime repair merged in PR #486 (984006f). Issue #470's cookie-less race was also reproduced in a local Chromium dual-tab/delayed-cookie diagnostic: late cookie replacement hid progressed attempt state. The scoped browser-lock repair merged in PR #488 (scope/evidence: tasks/plans/custom-v2-cross-tab-bootstrap-lock.md); isolated-QA and physical-device acceptance remain required.

PR #488 merged as `411d5ac` after independent agent review; #487 was closed as duplicate. The repeatable native Chromium interruption harness in `apps/web/scripts/qa-custom-bootstrap-browser.mjs` exercises the actual browser transport and request controller against a **simulated loopback ledger**. Its controlled cookie/lock results are recorded in `tasks/plans/custom-v2-bootstrap-interruption-qa.md`; they do not establish signed hosted creator/friend or physical-device acceptance. #470 remains open.

Public creation, unlisted sharing and signed 1–10 gameplay are staged behind server-side flags. Production `/create` currently returns 404; leave both Custom flags OFF until every launch gate below passes.

- [ ] Complete the real native-browser, signed isolated-QA first-open/cookie-continuity acceptance for two tabs (#470), including cookie ordering, resumed progression and completion. The local Next + real isolated Supabase creator/friend HTTP and creation-quota suite already passed and is recorded in `docs/START-HERE.md`; it does not prove this distinct browser gate. Draft PR #499 stages a Chromium integration runner, but its signed-browser execution has not occurred; do not treat CI or simulated browser fixtures as acceptance.
- [ ] Complete Vercel WAF entitlement and enforcement verification. Project API metadata shows SSO protection enabled for non-custom domains; password protection and trusted IP protection are disabled. Active firewall-config lookup returns 404. Authenticated Vercel Git deployment context confirms a Hobby team; current docs permit one fixed-window WAF rate-limit rule on Hobby (token bucket requires Enterprise). Active/staging firewall reads return 404 and the authenticated dashboard remains inaccessible, so an installed rule and its enforcement are unverified. Inspect the existing configuration before editing; stage a log-only route-scoped rule for `POST /api/custom-lineup/create`, verify actual controlled enforcement, and document disable/publish rollback. If unavailable, retain the independent server-side creation quota and keep public creation OFF. Do not weaken deployment protection. See `tasks/plans/custom-v2-live-vercel-ingress-evidence.md`.
- [ ] Complete creator and friend gameplay acceptance on real iOS Safari and Android Chrome, including keyboard/autocomplete, two-tap swap, sharing, owner-code separation, results and navigation. Chromium viewport coverage is simulated mobile testing, not physical-device acceptance.
- [ ] After hosted signed-browser continuity, genuine WAF enforcement/reversal, physical-device acceptance **and the #471 response-loss product/security decision** are complete, perform a controlled production Custom flag rollout with enabled issuance, gameplay/scoring, logs, database state, and a new enabled-feature rollback assessment. The disabled-feature drill does **not** certify enabled-feature recovery.

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
