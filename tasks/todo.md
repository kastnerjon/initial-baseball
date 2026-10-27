# Initial Baseball — Current Work

Remaining tasks only; completed verification and production evidence are recorded in `docs/START-HERE.md`. Both production Custom flags remain OFF.

## 1. Account-gated Custom creation before private-sharing launch (October 26 decision)

**Implementation complete on main, NOT operational launch:** PRs #514–#517 merged after exact-head CI, Vercel Preview and resolved independent CodeRabbit findings. All public Custom and creator-auth production flags remain OFF. See the latest `docs/START-HERE.md` checkpoint.

- [x] Implement default-OFF Google/Apple PKCE + email OTP account foundation, verified/nonanonymous Supabase Auth UUID, CSRF/Host/session cookie boundaries and account page (#514). Real provider configuration and acceptance are separate below.
- [x] Bind every **new** v2 Custom issuance to a server-verified account UUID in the same immutable DB row; never trust a supplied account ID or mint a new anonymous owner code for verified owners (#515, #516). Isolated-QA schema migration validated; **production migration pending**.
- [x] Implement account-gated create POST, ordered guest draft builder, bounded same-tab draft restoration across login and guest friend-play preservation (#516). Hosted guest preview/user journey still requires QA.
- [x] Implement first read-only My Creations endpoint/page scoped to the verified account, returning only safe puzzle identity/title/issuance date (#517).
- [ ] Configure separate isolated-QA Auth provider/redirect/email templates and branch-scoped Vercel `CREATOR_AUTH_ENABLED`, `CREATOR_AUTH_SITE_URL`, `SUPABASE_PUBLISHABLE_KEY`; verify real Google, Apple and email OTP flows, session refresh/sign-out, account identity continuity and iPhone/Android browser behavior. Keep production flags OFF.
- [ ] Reconcile the QA managed migration version `20261026235720` with committed file version `20261026233000` before any automated `supabase db push`; then rehearse production-target schema/migration and rollback safely. The QA migration alone is not production deployment evidence.
- [ ] Validate hosted unsaved **preview** behavior and persistence across authenticating in the same tab, as well as single-owner atomic issuance → My Creations readback → unlisted guest play. Verify lost response, retries, cookies, account deletion and parallel openings against isolated QA.
- [ ] Add separately approved creator completion metrics, management authorization and publishing/unpublishing without altering immutable lineup/clue/score facts. Confirm product UX direction first.
- [ ] Preserve already-issued anonymous puzzles and one-time owner-code digests. Stage a separately reviewed, bounded, single-owner-claim flow requiring both authenticated session and original owner capability; share links/preview cookies are not ownership proof.
- [ ] Define a reversible **per-mode server play-admission policy**, initially guest-allowed for Custom and always guest-allowed for official Daily Nine. Any activation of other-mode authentication gates is a future owner decision, not authorized now; test in-progress guest attempts and rollback.
- [ ] Reassess private Custom launch QA and enabled-feature rollback under authenticated creation/guest play. Never treat historical anonymous QA issuance evidence as authenticated creator acceptance.

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
