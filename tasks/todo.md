# Initial Baseball — Current Work

Last reconciled against GitHub, Vercel and both Supabase projects on October 21, 2026. `docs/START-HERE.md` records verified release evidence; completed work belongs in PRs and plans, not this active list.

## 1. Complete Custom Lineups Phase 1 launch gates

Public creation, unlisted sharing and signed 1–10 gameplay are staged behind server-side flags. Production `/create` currently returns 404; leave both Custom flags OFF until every launch gate below passes.

- [ ] Run the real public creator → separate owner capability → friend share-link acceptance suite against isolated QA only. Cover canonical ordered identities, immutable issued lineup/title, friend gameplay, signed completion/scoring, first-attempt continuity, duplicate/idempotent submissions, concurrency, failure recovery, and cleanup. Include the real HTTP quota boundary: malformed requests do not spend quota; ten same-IP creations pass; the eleventh is limited with `Retry-After`; another IP remains admissible. See `tasks/plans/custom-v2-public-creator-hosted-qa.md` and `tasks/plans/custom-v2-creation-quota-hosted-qa.md`.
- [ ] Securely provision/use QA-project-only server credentials through authenticated dashboard access; never use production credentials. Existing Oct 18 QA fixtures are retained and budget counters are empty. Recheck rows and permissions before and after any new run.
- [ ] Complete Vercel WAF entitlement and enforcement verification. Project API metadata shows SSO protection enabled for non-custom domains; password protection and trusted IP protection are disabled. Active firewall-config lookup returns 404. Vercel documents custom firewall rules on all plans but WAF rate limiting as Enterprise-only; connected team metadata does not expose the current entitlement and the dashboard requires sign-in. Confirm entitlement in the authenticated dashboard. If available, stage a route-scoped rule for `POST /api/custom-lineup/create`, verify actual controlled enforcement, and document disable/publish rollback. If unavailable, retain the independent server-side creation quota and keep public creation OFF. Do not weaken deployment protection. See `tasks/plans/custom-v2-live-vercel-ingress-evidence.md`.
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
