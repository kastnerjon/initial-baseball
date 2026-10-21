# Initial Baseball — Current Work

Last reconciled against GitHub, Vercel and both Supabase projects on October 21, 2026. `docs/START-HERE.md` records verified release evidence; completed work belongs in PRs and plans, not this active list.

## 1. Complete Custom Lineups Phase 1 launch gates

Public creation, unlisted sharing and signed 1–10 gameplay are staged behind server-side flags. Production `/create` currently returns 404; leave both Custom flags OFF until every launch gate below passes.

- [ ] Run the real public creator → separate owner capability → friend share-link acceptance suite against isolated QA only. Cover canonical ordered identities, immutable issued lineup/title, friend gameplay, signed completion/scoring, first-attempt continuity, duplicate/idempotent submissions, concurrency, failure recovery, and cleanup. Include the real HTTP quota boundary: malformed requests do not spend quota; ten same-IP creations pass; the eleventh is limited with `Retry-After`; another IP remains admissible. See `tasks/plans/custom-v2-public-creator-hosted-qa.md` and `tasks/plans/custom-v2-creation-quota-hosted-qa.md`.
- [ ] Securely provision/use QA-project-only server credentials through authenticated dashboard access; never use production credentials. Existing Oct 18 QA fixtures are retained and budget counters are empty. Recheck rows and permissions before and after any new run.
- [ ] Inspect Vercel project security and determine whether route-scoped rate limiting is available. If supported, implement a reversible rule, prove actual enforcement with controlled requests, and document rollback. Existing ingress spoof tests do not prove WAF enforcement; active firewall config lookup currently returns 404. See `tasks/plans/custom-v2-live-vercel-ingress-evidence.md`.
- [ ] Complete creator and friend gameplay acceptance on real iOS Safari and Android Chrome, including keyboard/autocomplete, two-tap swap, sharing, owner-code separation, results and navigation. Chromium viewport coverage is simulated mobile testing, not physical-device acceptance.
- [ ] Run a reversible production rollback drill without enabling public creation. After all previous gates pass, perform a controlled flag rollout and verify production routes, issuance, scoring, logs and database state before calling launch complete.

## 2. Finish launch-adjacent creator navigation

- [ ] Add the default-off, two-flag-gated Daily footer entry and a return-to-Daily link on `/create`, with narrow-screen wrapping. Do not change either production flag. Scope: `tasks/plans/custom-creator-navigation.md`.

## 3. After Custom Lineups launch

- [ ] Resume the deferred version-aware Daily editorial horizon inspection in draft PR #434 only after Custom launch; preserve Daily Nine, Archive and Classic behavior. Do not merge until its independent review is available.
- [ ] Continue the approved administrator-configurable Daily Lineup design and issuance stages. Freeze each lineup length into the issued contract; retain all historical nine-player Daily/Archive results and Classic.
- [ ] Consider public Custom publishing, Discover and leaderboards only after private sharing and first-attempt integrity are stable. They require separate moderation, ownership, privacy, abuse and activation decisions; see `tasks/plans/community-custom-lineups.md`.

## Deferred polish

- Native share-sheet support for the existing unlisted friend link is optional; preserve the tested Copy link/selectable URL fallback. Scope: `tasks/plans/custom-native-share.md`.
