# Initial Baseball — Current Work

Remaining tasks only; completed verification and production evidence are recorded in `docs/START-HERE.md`. Both production Custom flags remain OFF.

## 1. Account-gated Custom creation before private-sharing launch (October 26 decision)

- [ ] Stage secure Google/Apple/email-OTP sign-in, account and verified session model with stable internal user IDs, CSRF/session protection, tested identity-linking rules, RLS grants and QA/production provider configuration. Accounts are mandatory only for issuing/managing new Custom creations, **not for Custom friend play**.
- [ ] Permit anonymous **unsaved draft creation/preview**, preserve an in-progress draft across OAuth/email sign-in safely, and fail closed if the session is not verified when submitting a new immutable challenge. The existing no-account `POST /api/custom-lineup/create` MUST NOT be activated in production unchanged.
- [ ] Persist server-authoritative account ownership at issuance, build authenticated **My Creations** with private share link, completion metrics and management authorization. Keep immutable players/clues and historical scores; allow only explicitly approved mutable title, publication and deactivation metadata.
- [ ] Preserve already-issued anonymous puzzles and one-time owner-code digests. Stage a separately reviewed, bounded, single-owner-claim flow requiring both an authenticated session and the original owner capability; the share link and preview cookie do not confer ownership.
- [ ] Define a reversible **per-mode server play-admission policy**, initially guest-allowed for Custom and always guest-allowed for the editor-published Daily Nine. Other-mode authentication gates are a future opt-in decision; keep scoring, immutable attempts and answer secrecy independent, and test in-progress guest attempts across policy changes.
- [ ] Reassess the private Custom launch QA plan and rollback under the new authenticated-creation/guest-play model. Do not declare the prior anonymous issuance tests equivalent to authenticated creator acceptance.

## 2. Remaining private Custom Lineups release gates

- [ ] Verify signed creator-to-friend gameplay through the *deployed* protected QA origin; GitHub Actions signed Chromium evidence runs against a local Next server, not the live Vercel ingress. Do not treat GET smoke as this acceptance.
- [ ] Provide testers a current, expiring authenticated isolated-QA Preview share link at the time of physical acceptance; never commit bearer links to Git. Vercel Sandbox Chromium automation remains blocked on Hobby through November 1; use physical QA or a separately reviewed credential-safe runner.
- [ ] Complete creator and friend gameplay on actual iPhone Safari and Android Chrome using the protected isolated-QA link: player search, hints, navigation, sharing, owner-code separation, scoring, results, refresh and usability. Chromium tests do not count as physical-device acceptance.
- [ ] After the authenticated creator, guest friend-play and other gates pass, run the controlled production Custom flag rollout. Verify issuance, gameplay/scoring, completion admission, database integrity, runtime errors and a new enabled-feature rollback path. The disabled-feature rollback drill does not prove rollback safety after Custom is enabled. Preserve both flags OFF until the rollout criteria are met.

## 3. Product experience after safe private Custom readiness

- [ ] Review the complete Create → owner preview → share → independent friend play → results journey with the product owner. Agree on a design direction before substantial visual implementation. Refine screen hierarchy, labels, buttons, navigation, loading/errors, results, accessibility, responsive mobile layouts, typography, color and brand consistency while preserving gameplay, scoring and privacy contracts. Prior HTML/branding concepts were exploratory, not approved specifications.

## 4. Later roadmap

- [ ] Resume the version-aware Daily editorial horizon inspection in draft PR #434 after private Custom launch and UX refinement; preserve Daily Nine, Archive and Classic behavior.
- [ ] Continue the approved administrator-configurable Daily Lineup design and issuance stages. Freeze each lineup length into the issued contract; retain historical nine-player Daily/Archive results and Classic.
- [ ] Scope public Custom publishing, Discover, ratings, rankings, social comparisons and asynchronous Head-to-Head separately after private sharing and first-attempt integrity are stable. Resolve moderation, ownership, privacy, abuse and competitive rules before implementation. See `tasks/plans/community-custom-lineups.md`.

## 5. Required before broad launch

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
