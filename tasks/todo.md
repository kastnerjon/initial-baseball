# Initial Baseball — Current Work

Last reconciled against current GitHub `main`, CI, Vercel and read-only Supabase checks on October 24, 2026. Verified operational evidence and completed work are in `docs/START-HERE.md` and the linked plans. Both production Custom flags remain OFF.

## 1. Finish private Custom Lineups release gates

- [x] Execute signed isolated-QA Chromium friend continuity and actual creator response-loss/manual retry (#470/#471). Run `40111285611` passed on `27fa07745d`; PR #499 merged and production verified on `398d7dc`. Evidence and limits are in START-HERE and issue comments; issue closure still requires acceptance-evidence review.
- [ ] Provision hosted QA for physical devices with verified QA database destination. Existing Preview uses production Supabase; never use it for destructive QA.
- [ ] Once isolated QA links are ready, complete creator and friend gameplay on actual iPhone Safari and Android Chrome: player search, hints, navigation, sharing, owner-code separation, scoring, results, refresh and usability. Chromium tests do not count as physical-device acceptance.
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

## Reported data correctness

- [ ] Fix and audit missing season team metadata (#505), beginning with Kris Bryant 2025. Source authoritative team evidence; preserve stats and scoring.
