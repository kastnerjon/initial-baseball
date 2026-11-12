# Initial Baseball — Current Work

## Current source integration — November 10

- [ ] #639 source-only same-date browser-isolation QA: exact edition saves, reset boundaries, primary/secondary coexistence and Web Locks must pass native Chromium on the final commit. The synthetic fixture is documented in `docs/engineering/official-daily-browser-isolation-qa.md`; it does **not** establish signed hosted competitive scoring, real Supabase first attempts or Safari/Android acceptance. Require independent review and matching Preview before merge.
- [ ] Complete hosted isolated-QA verified-account My Creations pagination, account-switch and empty-page acceptance, and physical-device checks. #654 is merged with eight mounted Chromium cases; main push CI `42936744355` passed and matching production deployment is READY. Auth/Custom production activation remains OFF and requires explicit release approval.
- [ ] Resolve the final in-scope documentation findings and complete independent final-head review before integrating #606 unified official Archive. Exact-head CI `42945583941` passed and Vercel Preview is READY. No Archive flag, production migration or competition activation is authorized.

## Engineering workflow — native default-OFF smoke pilot (November 8)

- [ ] Consolidate the three local default-OFF Daily browser QA milestones #628/#634/#635 as one reviewable #635 source change on current main, without losing #633 disabled Custom identity GET/POST guards: first signed hint → browser save → reload/authorized hint replay → second hint; signed first terminal give-up → next-at-bat reload; remaining eight signed terminal transitions → final nine-row points scorecard → completed-game reload. Require **new exact-head** CI with native Chromium, READY Preview and independent reviews before merge. This verifies real Chromium local Daily progression, not real guesses, hosted competitive scoring, Auth, secondary editions or physical phones.
- [ ] After a successful pilot, compare CI runtime and false-failure rate. Keep the browser gate if it catches real route regressions without significant overhead; otherwise optimize its placement rather than weakening isolation. See \`docs/engineering/default-off-browser-qa.md\`.


## Security #531 — legacy signed browser QA environment cutover

- [ ] Configure GitHub Environment `qa-custom-signed-browser` with **main-only** deployment restrictions and isolated-QA-only secret `QA_CUSTOM_SIGNED_BROWSER_SUPABASE_SERVICE_ROLE_KEY`. Verify a successful trusted-main Chromium signed-guest run and rejected untrusted-branch invocation before deleting the legacy repository-wide `CUSTOM_V2_QA_SUPABASE_SERVICE_ROLE_KEY`. Source uses the existing localhost admin-fixture route, not obsolete anonymous Create. Consider QA-key rotation after cutover; no production secrets or migrations.

## Archive beta operational investigation (#615)

- [ ] Preserve accepted October 16 Daily #173 results and original `daily-2026-10-16` identity. Production has no matching editorial row or disposable Archive beta #13; do not fabricate an editorial puzzle. Source-stage bounded 503 diagnostic logging separately, then verify real production event classification and archival-history policy before any remediation.

## Official Daily editions — approved November 5

- [ ] Independently review clean-main unified official Archive #606: published primary metadata placeholder puzzleId:null (not falsely playable), exact-ID numbered secondary metadata unlinked until exact-ID enabled hosted acceptance, arbitrary same-date edition keyset, no hidden answer/score writes, original Archive beta retained with errors sanitized and four default-OFF flags. Require exact-head CI/Preview, CodeRabbit/Codex, protected hosted 120+-edition browser acceptance (121-edition rollback-only DB fixture passed), physical responsive Safari/Android and controlled release approval. Primary source issue #589 and A3 signed result admission #566 remain separate blockers.

- [ ] Complete isolated hosted signed-playback, hidden-answer bundle verification and physical Safari/Android acceptance for the merged, default-OFF exact-ID secondary practice source (#608). Preserve private progression, single-hint reveal, per-edition saves and personal-only results; competitive A3 #566 remains denied.

- [ ] A1: issuance identity, frozen nine-player content, service-only persistence and restricted editor action.
- [ ] A2–A4: exact-ID play and hint privacy, result isolation, share links, one Archive and device QA.

- [ ] **A3 signed score release gate — issue #566:** all reserved official daily-ed-* IDs now fail closed for browser collection and both server scoring submissions. Implement and independently verify exact-ID, ruleset, attempt and live-purpose binding before enabling scoring, especially for identical-roster editions; keep delayed legitimate live writes and historical primary results compatible.

- [ ] B: arbitrary-count editor workflow and primary selection. Complete independent review of the private draft preview API (#599) and read-only review page (#600), then link them to the date-scoped catalog/workbench (#574/#575). Require an explicit nine-player review/confirm plus current occurrence ID/revision before scheduling via the already-existing CAS endpoint; no one-click schedule from an unread catalog row. Run account-provider QA alongside Daily development. [Sequence and rollout](plans/multiple-official-dailies.md).

## Custom #528 — secure completion display identity (source policy staged)

- [ ] Review signed private readback adapter #626 after SQL #625. Verify exact challenge/browser cookie and creator-marker boundary, malformed provider rows, named UTF-16 text, Anonymous nullness, default-OFF gate and final-head CI/Preview. No public GET or production enablement without isolated SQL QA and device acceptance.

- [ ] Review private display readback SQL #625 after writer #620. Verify exact-browser, N-row and summary/awarded-point parity, creator exclusion, Anonymous null and least-privilege readback via transaction-rollback isolated QA. No production migration or public API is authorized.

- [ ] Preserve the main native Chromium default-OFF smoke gate for Custom completion-name GET/POST (identity flag forced false even when inherited true). This only verifies HTTP 404 without secrets; it is not signed browser acceptance or migration readiness.
- [ ] Source checkpoint: #620 immutable first-admitted Custom v2 name/Anonymous write SQL, #623 signed write port, #625 private SQL readback, #626 signed read port, and #629 default-OFF guarded HTTP transport. Confirm final exact-head CI/Preview and independent reviews, then isolated QA rollback rehearsal before any production migration. HTTP is still source-only; front-end UX, nickname linkage, rate/abuse, device QA and explicit release authorization remain undone.
- [ ] Stage a separate service-role-only first-write-wins name/privacy projection bound to the server-admitted Custom v2 submission (never to a caller-chosen submission ID). Use the portable `parseCompletionDisplayName` boundary, but retain the verified attempt-cookie/creator-exclusion and independent nickname authorization. This remains incomplete until reviewed additive QA-only database migration, endpoint and UI tests, real Safari QA and explicit release authorization.


## Custom #529 — remaining variable-strike integration and release gates

- [ ] Run isolated hosted QA of the source-wired, default-OFF creator 1/2/3 selector. Confirm its visibility follows only the trusted issuance-readiness flag; verify the old two-field/three-strike path when OFF and secure account-only 1/2/3 issuance when ON. Do not set production flags or trust client rule/owner identifiers.
- [ ] Revalidate previously issued 1/2/3-strike Custom challenges in isolated hosted QA after disabling new variable-strike issuance, including refresh, creator exclusion and historical three-strike compatibility.
- [ ] Complete isolated hosted QA for 1/2/3 strikes and 1–10 players: verified issuance, creator and friend play, hints, strikeouts, exact Give Up guesses, nine/ten-batter completion after three outs, refresh, lost-response retries, cross-tab CAS, noncompetitive owner exclusion, and authoritative stored results.
- [ ] Verify per-challenge comparisons remain keyed to immutable issued puzzle ID/cap; cross-challenge public leaderboards must stratify by strike limit, ruleset and roster length before launch.
- [ ] Complete real mobile Safari/Android acceptance, production-clone migration rehearsal, rollback/monitoring review and **explicit production release authorization**. Production Custom/Auth/variable-strike flags remain OFF, with creator/strike migrations unapplied; QA-only migration rehearsal is not production parity.

Remaining tasks only; completed verification and production evidence are recorded in `docs/START-HERE.md`. Both production Custom flags remain OFF.

## 1. Account-gated Custom creation before private-sharing launch (October 26 decision)

- [ ] Observe first restricted-environment scheduled/manual GitHub Actions **QA Custom account browser regression** on trusted main and establish reliable pass/fail. **One-time authorized setup required:** create GitHub Environment `qa-custom-account`, restrict deployments to `main`, set only its `QA_CUSTOM_ACCOUNT_SUPABASE_SERVICE_ROLE_KEY` secret from the isolated QA project. The workflow uses this Environment secret rather than the existing repository-wide QA secret, plus a public QA publishable key; never runs on PR changes or touches production. After confirmed green, schedule reduces repetitive human QA, including late guest-to-creator sign-in and sticky exclusion, but does not replace real OAuth/hosted ingress/iOS/Android. The new late-owner test must not be marked verified before its first isolated-QA execution. See `.github/workflows/custom-account-browser-qa.yml`.

**Release still gated:** production Custom/Auth flags remain OFF and the account-owner/creator-marker migrations are not applied in production. Completed source milestones are recorded in `docs/START-HERE.md`.

- [x] Implement default-OFF Google/Apple PKCE + email OTP account foundation, verified/nonanonymous Supabase Auth UUID, CSRF/Host/session cookie boundaries and account page (#514). Real provider configuration and acceptance are separate below.
- [x] Bind every **new** v2 Custom issuance to a server-verified account UUID in the same immutable DB row; never trust a supplied account ID or mint a new anonymous owner code for verified owners (#515, #516). Isolated-QA schema migration validated; **production migration pending**.
- [x] Implement account-gated create POST, ordered guest draft builder, bounded same-tab draft restoration across login and guest friend-play preservation (#516). Hosted guest preview/user journey still requires QA.
- [x] Implement first read-only My Creations endpoint/page scoped to the verified account, returning only safe puzzle identity/title/issuance date (#517).
- [ ] Finish isolated-QA Auth provider/redirect/email templates and real Google, Apple and email OTP session QA, including refresh/sign-out, provider identity continuity, and iPhone/Android browser behavior. QA branch-scoped site URL and publishable key are configured, but `CREATOR_AUTH_ENABLED=false` remains explicit until safe provider setup/acceptance. Keep production flags OFF.
- [ ] Complete a production-matched migration replay on an isolated clone, hosted-QA cross-session creator/admission concurrency acceptance, and a reviewed production-specific rollback plan before any production DDL. PR #526 adds a real two-connection PostgreSQL CI race regression using the exact creator migration sources on disposable structural fixtures; it verifies both lock orders with live `pg_stat_activity.wait_event_type='Lock'` evidence, but is not production-clone parity or hosted QA acceptance.
- [ ] **P1 hosted account-owner exclusion QA:** with real Auth sessions and isolated-QA schema, verify owner on another device/lost issuance response, pre-login guest attempt followed by sign-in and sign-out, different-account friend, tampered/expired session, atomic refusal, and safe cookie refresh on failed responses.
- [ ] **P1 provider identity policy:** real hosted Google/Apple/email OTP + Apple relay/same-email QA, refresh and account-switch tests. Explicit original-provider recovery limits unless separately proved linking exists; never merge accounts from email matches.
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

## 3. Next product milestone — shared Custom gameplay and completion design

- [ ] Review one shared Private/Unlisted and future Public Custom gameplay/completion journey in four contexts (guest friend, authenticated nonowner, creator preview, future Discover entrant). Review the complete Create → owner preview → share → independent friend play → results journey with the product owner. Agree on a design direction before substantial visual implementation. Refine screen hierarchy, labels, buttons, navigation, loading/errors, results, accessibility, responsive mobile layouts, typography, color and brand consistency while preserving gameplay, scoring and privacy contracts. Prior HTML/branding concepts were exploratory, not approved specifications.

- [ ] Before broad repeated-play expansion: measure per-puzzle cookie growth/eviction and reopened progress in real browsers; consider bounded credentials only after stress evidence, preserving legacy challenge-cookie precedence. Verify lifetime archive completeness for My Creations after the source-integrated #654 keyset pagination; hosted account-switch/empty-page and device acceptance remain outstanding.

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

## Official Daily publication storage

- [ ] Rehearse the additive official_daily_publications migration on an isolated production-shaped Daily database after review. The migration file and disposable PostgreSQL test alone do not enable publication. Verify service-only append/read privileges, same-date identical rosters, collision handling and old-reader compatibility before connecting the restricted admin writer. Preserve the existing primary and numbered archive.

## Official Daily exact-ID gameplay: frozen materializer (staged)

- [ ] Integrate the private exact-ID reader with the shared frozen-clue DailyPuzzle materializer under explicit server admission and date checks. This source-only adapter does not create public gameplay.
- [ ] Replace any bulk release of unrevealed hints in secondary edition bootstrap, resume, next-pitch and hint-bundle endpoints with single authorized reveal transport. Preserve the existing primary until parity checks.
- [ ] Verify edition-scoped progression, scores, share links, browser persistence and historical/archived practice before enabling public routes.

## Official Daily edition browser-save separation (staged)

- [ ] After public exact-ID gameplay is wired, exercise two same-date edition tabs plus the legacy primary: hints, wrong guesses, local saves, refresh, reset and switching must not read or delete another edition's state.
- [ ] Confirm the shared completed-result/at-bat journal stays scoped to immutable puzzle ID and ruleset; enforce authoritative per-edition score and first-attempt admission before rollout.

## Official Daily secondary-editorial transaction (source staged)

- [ ] Verify the source-staged `official_daily_editorial_drafts` table and atomic `issue_official_daily_editorial_draft` function against isolated QA. Retain the completed rollback-only rehearsal evidence; no production migration without explicit release approval.
- [ ] Integrate the default-OFF, authenticated secondary draft administration from #560 with the reviewed private issuer (#561) and exact-ID publication readback; preserve existing primary issuance, editorial revision checks and immutable retries. Public gameplay, competitive result admission and release still require their separate gates.
