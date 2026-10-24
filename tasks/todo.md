# Initial Baseball — Current Work

Last reconciled against exact production main `a5d0c44401ad6ce69f76e9a4433dde1d3accb933` (PR #506), successful CI, READY Vercel and read-only route smoke on October 24, 2026. Completed data correction #505 and scoped QA issues #470/#471 are documented in `docs/START-HERE.md`. Both production Custom flags remain OFF.

## 1. Finish private Custom Lineups release gates

- [x] Restore a dedicated hosted QA Preview and verify its isolated database destination. The protected `qa/private-custom` Preview is READY on `398d7dc`, with all five GET smoke routes passing and QA-only schema compatibility restored. Ordinary Preview branches may still use production Supabase; only the verified QA branch is an authorized destination for QA issuance.
- [ ] Verify signed creator-to-friend gameplay through the *deployed* protected QA origin; GitHub Actions signed Chromium evidence runs against a local Next server, not the live Vercel ingress. Do not treat GET smoke as this acceptance.
- [ ] Provide testers a current, expiring authenticated QA Preview share link at the time of physical acceptance. A temporary link was created October 24; it expires October 25 and must not be stored in Git. Vercel Sandbox browser automation remains blocked on Hobby through November 1; use physical QA or a separately reviewed credential-safe runner.
- [ ] Complete creator and friend gameplay on actual iPhone Safari and Android Chrome using the protected isolated-QA link: player search, hints, navigation, sharing, owner-code separation, scoring, results, refresh and usability. Chromium tests do not count as physical-device acceptance.
- [ ] After those gates pass, run the controlled production Custom flag rollout. Verify issuance, gameplay/scoring, completion admission, database integrity, runtime errors and a new enabled-feature rollback path. The disabled-feature rollback drill does not prove rollback safety after Custom is enabled. Preserve both flags OFF until the rollout criteria are met.

## 2. Product experience after safe private Custom readiness

- [ ] Review the complete Create → owner preview → share → independent friend play → results journey with the product owner. Agree on a design direction before substantial visual implementation. Refine screen hierarchy, labels, buttons, navigation, loading/errors, results, accessibility, responsive mobile layouts, typography, color and brand consistency while preserving gameplay, scoring and privacy contracts. Prior HTML/branding concepts were exploratory, not approved specifications.

## 3. Later roadmap

- [ ] Resume the version-aware Daily editorial horizon inspection in draft PR #434 after private Custom launch and UX refinement; preserve Daily Nine, Archive and Classic behavior.
- [ ] Continue the approved administrator-configurable Daily Lineup design and issuance stages. Freeze each lineup length into the issued contract; retain historical nine-player Daily/Archive results and Classic.
- [ ] Scope public Custom publishing, Discover, ratings, rankings, social comparisons and asynchronous Head-to-Head separately after private sharing and first-attempt integrity are stable. Resolve moderation, ownership, privacy, abuse and competitive rules before implementation. See `tasks/plans/community-custom-lineups.md`.

## 4. Required before broad launch

These gates are separate from Custom Lineups Phase 1. Keep them active until each has production evidence; the canonical source is `docs/product/daily-inning-blueprint.md`, under “Required before broad launch.”

- [ ] Complete full authenticated admin and public-runtime production QA.
- [ ] Complete real-browser gameplay and refresh QA on common iPhone/iPad sizes.
- [ ] Verify compact completed-result persistence and same-Daily/same-ruleset comparison.
- [ ] Decide the launch game, final rules, and launch date/numbering epoch before beginning permanent archive/history from Daily #1.
- [ ] Confirm calibrated recognizable lineups.
- [ ] Verify analytics and error monitoring.
- [ ] Complete privacy/terms, canonical domain, and social metadata.

## Independent security follow-up (not a Custom launch gate)

- [ ] Resume staged RLS helper EXECUTE hardening in draft PR #494 only after matched hosted Supabase staging verifies event-trigger and DDL behavior. Never apply the migration to production on local-only evidence.
