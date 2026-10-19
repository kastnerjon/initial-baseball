> Owner addendum, October 18, 2026 (GitHub #441): **all newly created private and public Custom Lineups require a name**; private issued puzzles can later be deliberately published or unpublished; public users can search by title or creator display alias; the Discover popularity tabs rank most-completed eligible puzzles. The anonymous creator needs a separate secret management capability for publish/unpublish, not the gameplay/preview cookie. These features follow the unlisted creator release in separately reviewed stages. Existing puzzle IDs and gameplay remain compatible.
>
> Priority correction, October 17, 2026: launch unlisted/private-link user-created Custom Lineups first. Public Discover, publishing and leaderboards described below remain deferred and must not block private sharing. Creator authorization and abuse protections still apply to public creation. See `custom-first-variable-daily-direction.md`.

# Community Lineups — public publishing, discovery, and per-lineup results

Status: **Approved product direction; implementation not yet begun** (2026-10-13)

## Owner intent and product

Any eligible player should eventually be able to create a **Custom Lineup with 1–10 ordered players**, privately share it, deliberately **publish** it to a searchable/discoverable public directory, and see challenge-specific results and leaderboards. A published listing has its own stable page and does not alter the issued challenge or scoring. The Custom first-play, hint, answer-secrecy and results integrity rules still apply.

The **Discover Lineups** page offers exactly these initial views:

| View | Eligibility and sort | Tie-break |
|---|---|---|
| **This Week** | Public approved challenges by count of eligible noncreator first-completion **admissions** with authoritative `custom_nine_completed_results.created_at` in the rolling 7 × 24 hours ending at the query's server UTC timestamp; count **descending** | All-time accepted completion count **descending**, first-publication timestamp **descending**, challenge ID **ascending** |
| **All Time** | Public approved challenges by total eligible noncreator first-completion admissions; count **descending**, based on all `custom_nine_completed_results.created_at` values | Rolling-seven-day accepted completion count **descending**, first-publication timestamp **descending**, challenge ID **ascending** |
| **New Today** | Public approved challenges with immutable first-publication timestamp `first_published_at` in the calendar day **00:00:00 UTC inclusive** through next midnight **exclusive**, sorted by `first_published_at` **descending** | Challenge ID **ascending** |

The canonical completion clock is the server/database-issued accepted result `created_at`, **not** the browser's attempt start, client-declared completion, or page-view time. The publication clock is the server-set immutable `first_published_at`; unpublish/re-publish must not reset it or allow gaming New Today. For stable cursor pagination, freeze a request's server UTC reference time across pages (e.g. encode an authenticated/signed cursor with that time) and carry the sort values and stable challenge-ID tie-breaker. These timestamp fields must be implemented and indexed/reviewed before activation.

"Plays" and popularity are **eligible accepted completed attempts**, not page views and not guaranteed unique humans: challenge-scoped anonymous browser credentials can be reset. No inflated counts from creator preview, replay, unadmitted/orphan/partial attempts or another challenge. Show sample sizes. Popularity may favor shorter challenges; always show lineup length and offer a length filter (1–3, 4–6, 7–10) when data warrants it. Re-evaluate ranking empirically after launch; no invented composite engagement score in v1. Empty popularity windows must produce honest empty states, not false scores.

## Public product experience

- **Create**: creator selects 1–10 distinct canonical player identities in order, using the future versioned Custom contract, and previews all authorized clues privately. Existing issued Custom Nine v1 stays nine and works with old IDs. The public creation UI is **not yet shipped**.
- **Keep private / share by link**: issuing a puzzle is separate from publishing; an unpublished challenge must never appear in browse/search or public metadata. Private links retain existing authorized, answer-redacted play semantics.
- **Publish**: a creator explicitly opts in with a **required name at creation for private and public lineups** (3–60 Unicode code points after NFC/whitespace normalization); publication additionally reviews that name, optional safe display name and a preview of how the directory card will appear. A creator can unpublish without deleting the frozen puzzle or scores. Public publishing is not the automatic default.
- **Discover**: a clean responsive page with This Week / All Time / New Today tabs, bounded search by public title or voluntary creator display alias, stable cursor pagination, required title, creator display alias if available, number of at-bats, eligible completed play count, mean completed score with denominator/maximum, and link to play. Ratings, scores and titles are not invented when no eligible results exist.
- **Lineup page**: public safe title/metadata and Play action. The answer identities, initials for future slots and unrevealed clues must not leak through directory cards, server HTML, RSC props, meta tags, public APIs, share previews, logs or results. Reveal answers only through existing signed gameplay progression.
- **Results for every published lineup**: isolated completed score histogram (0 to `4 × N` in 0.5 steps), average, per-at-bat histograms/percentiles, and an opt-in Top 10 if a leaderboard passes privacy and abuse gating. Zero accepted completions shows an explicit no-results state; no division by zero. After the visitor completes their own authorized attempt, reuse the exact existing score comparison and own-result exclusion. Creator attempts never contribute competitively.
- **Share**: stable published page URLs and spoiler-safe completed result sharing; no names, initials, answers, hint payloads or unrevealed player detail in public metadata.

## Identity, abuse and moderation requirements

- Current Custom creation is **admin-only**, with private signed attempt and creator-browser provenance, and Custom result submissions/comparisons remain **default disabled**. A visible directory is **not** a permission to turn any of them on.
- Before general public creation/publication, implement a separate stable **creator authorization** mechanism (private management capability independent of the shared play URL; optional accounts later), plus CSRF protection. Never accept client-submitted creator IDs or admin publication state. Anonymous cookie alone does not establish unique human identity or recover ownership across devices.
- Store publication state **separately from append-only issued challenge rows**. A proposed owned, moderated metadata record has exact foreign-keyed challenge identity, sanitized bounded title/display alias, state (private/pending/public/hidden), timestamps, audit/provenance, and appropriate uniqueness. It must never copy the ordered canonical identities, frozen hints or raw result facts.
- Public title/display-name review, per-creator publication limits, per-IP/credential throttling, abuse reporting, administrative hide/unpublish, duplicate/spam handling and anti-ranking-gaming checks are required before wide public exposure. Prefer initially gated/moderated publishing over an unprotected anonymous write endpoint.
- Public directory reads and per-challenge aggregate result reads are **server-only**, bounded/cursor paginated, no-store where user-specific, sanitized and keyed by the exact immutable challenge (including its version/length). Aggregate reads must not permit untrusted exclusion IDs, cross-challenge joins, creator influence, or public access to private issued records.
- Only publish aggregate leaderboard/display-name information with explicit opt-in; do not claim distinct human users from browser cookies. No new tracking/fingerprinting just to enforce rank.
- User-generated text is a separate trust boundary. No raw HTML, unreviewed links, arbitrary hints or other answer-bearing description fields in v1.

## Performance and analytics

Use existing accepted Custom result storage as the source of truth. Start with indexed bounded read aggregation, benchmark at real scale before introducing cached counters or rollups. Collect privacy-conscious aggregate funnel metrics: creator start → issued → publish; directory impression → play open → attempt start → completion → share; seven-day return and share-to-play conversion. Segment completion/engagement by lineup length (1–10), not just total plays.

## Ordered implementation dependencies — separate PRs

1. **Finish playable Custom UI and 1–10 versioned issuance/runtime:** exact-N signed attempt progression and immutable v1 compatibility, with separate hosted Custom SQL/RPC predecessor and validated client/score transport; keep submission disabled pending abuse checks.
2. **Creator rights and gated publication metadata:** decide recovery/authentication and moderation approach. Add isolated service-role-only publication metadata schema, state transition service, idempotent Publish/Unpublish authorized actions, and safe read DTOs. No public gallery activation in this PR.
3. **Bounded discovery and ranking read model:** exact challenge eligibility, first-accepted noncreator completed attempts, independent 7-day/all-time/day sorting with UTC boundary, tie stability and length filters; pagination, score range and leakage tests. Do not broaden read access to private challenge facts.
4. **Public Discover + detail pages:** responsive accessible three-tab directory and safe per-lineup detail/play links, empty states, search/filter only after safe indexing; no UI-supplied rank authority.
5. **Per-lineup results and optional leaderboard:** reuse the existing exact-challenge Custom comparison service and saved score distribution; enable guarded presentation only after admission, anti-abuse and privacy review. Empty and creator-exclusion cases tested.
6. **Explicit activation:** security/abuse validation, staging QA with 1/5/9/10 AB and historical v1 challenges, mobile checks, exact CI/READY Preview, feature-flag/canary rollback plan, hosted Supabase constraints and monitoring; only then turn on public creation, publication or competitive contribution.

Do not fold a public directory migration, viewer UI, result admission and creator authentication into one PR. Do not weaken the existing Custom competition gates. Configurable Daily Lineup follows private-link Custom launch; fixed-five Daily is superseded.

## Naming boundary staged

The portable `parseCustomLineupTitle` validator rejects invalid/unsafe input, NFC-normalizes and collapses whitespace, and constrains new private/public titles to 3–60 Unicode code points. This is **not yet a persistent name or runtime enforcement**. The creator API, storage migration, UI and historical fallback need separately scoped integration; do not enable anonymous creation until naming is enforced end to end.

## Final acceptance

A creator can issue an authorized 1–10 player challenge, choose private vs public publication, recover/retain ownership according to the approved policy, and later unpublish. Public viewers discover approved public lineups through the three tabs, play the exact frozen challenge and see accurate challenge-scoped results; unissued/private/hidden and legacy records remain isolated. No unexpected answer leak, forged ranked play, creator-score contribution or change to Universal Daily/Archive/Classic.

## Name persistence prerequisite (October 18)

A separate database-only migration adds nullable `display_title` to the service-role-only issued challenge table with a v2-only 3–60-code-point bounded constraint. NULL remains valid for historical v1/v2 rows and old fixture issuers. The new public creation API must require the existing shared Unicode title validator and persist the normalized title atomically with the issued roster in a following Web PR. The column is private, not public discoverability; publication, ownership and moderation metadata remain separate.

## Public creator page staged (October 18)

A bounded Web presentation change reuses `CustomNineCreatorView` player search/reorder/share-link behavior with an explicit `audience=public` mode, title input and the approved `POST /api/custom-lineup/create` boundary. The public route `/create` is server-side 404 unless **both** public creation and Custom v2 gameplay gates are enabled. Admin v1/v2 remain unchanged and no public feature activation occurs. The page only creates unlisted/private links; later publication/ownership/search/leaderboard scope remains issue #441.

## Private challenge display name (October 18)

A separately scoped Web presentation/metadata-only reader displays a valid private v2 puzzle title in the play-page heading to a holder of the unlisted link, while the browser-facing metadata remains a generic noindex/no-referrer description. It reads only the `display_title` column using a server-only client after the v2 game gate and puzzle ID checks; NULL, rejected text, a missing row or metadata lookup failure falls back to `Custom Lineup` without altering the signed first-play attempt. It does not publish, index, or enumerate puzzles, and does not read or surface frozen answer IDs or clues.

## Anonymous owner management credential prerequisite (October 18)

A private additive schema migration stages nullable `owner_capability_digest` on issued v2 challenges, checked to 64 lower-case hexadecimal characters and never granted to browsers. The later issuer will mint 32 cryptographically random bytes and store their SHA-256 digest in the same immutable row INSERT, returning the secret **only to the creator** for a separate management link (never as part of the shareable play URL or preview cookie). Publication/unpublication later requires a server-side secret check against this digest, rate limiting and safe credential transport. Old v1/v2 issued challenges retain NULL. This is only persistence groundwork, not a public creator launch or owner-authorization endpoint.
