# Custom Lineup v2 — responsive gated player screen

Status: PR #416 implementation scope (October 15, 2026). Still **not activated** publicly.

## Scope contract
- **Goal:** a responsive, accessible player-facing Custom Lineup screen at `/custom/{opaque-v2-id}`, for exactly 1–10 pre-issued players, with server-monotonic guesses, clues, saved restoration and final-result admission.
- **Owner:** `apps/web` Next.js server-gated page + React client presentation only.
- **In scope:** route guarded by same server-only, default-disabled `CUSTOM_LINEUP_V2_GAMEPLAY_TRANSPORT_ENABLED`; an ordered N-row scorecard; current initials/strikes; explicit search candidate selection; one signed server-owned hint; wrong guesses/correct/third-strike/give-up; player reveal and Next; read-only completed history and bodyless result submit, retry on failures; creator preview noncompetitive; responsive isolated CSS, accessibility/negative tests and canonical docs.
- **Out of scope:** enabling flag in any environment, public creator challenge issuance, self-service accounts/rate limiting, comparison/leaderboard or public Discover, changing Daily/Classic/Custom v1, new SQL or scoring rules, client-side reset/retry eligibility.
- **Acceptance:** N=1/5/9/10 scorecard/static tests, page 404 when feature off/malformed ID, no server answer in initial props, no preview/creator action, only terminal reveal after committed server transition, server-owned restore after refresh and conflicts, engine-derived points; accessible labels, mobile CSS breakpoints at 780/380px; exact-head CI, Vercel preview READY, bounded review. Visual QA requires approved isolated staging activation; this PR does not activate a public route.
- **Stop conditions:** if browser play exposes new data, needs new persistence/account model, changes game scoring or requires real public activation, defer to a separate PR/decision.

## Architecture
- Next page checks the preexisting server-only transport availability flag before reading the challenge ID or making any DB/service call. Until separately activated all Custom v2 URLs return 404.
- Client React component delegates all game actions to `customLineupV2BrowserTransport`. It does not read Supabase, construct signed tokens, calculate guesses or admit scores itself. A refresh or cross-tab conflict reboots from server authoritative first attempt. Any hints shown are returned by a successful CAS operation, not guessed locally.
- Pure scorecard uses `getDailyAtBatPoints` (already portably implemented) to present derived points from saved server terminal facts. React does not implement a baseball rule. Reuses the existing `PlayerRevealCard`; the fetched canonical search candidates are validated before selection. Search waits for a meaningful >=2-letter segment to avoid offering player matches from spaced initials alone.
- CSS is scoped to new Custom page; no green/cream generic styling, no changes to nine-only Daily or Classic components. Existing root layout and navigation are unchanged.

## Security / launch caveats
- No public v2 issuer is present and hosted v2 tables currently have zero real challenges. A scoped flag-enabled staging environment and explicit QA fixtures are necessary before user acceptance. Do not toggle global production or preview flags as a side effect of merging this PR.
- The creator marker identifies one browser, not a unique person or account. Public competition, rate limiting, moderation and sharing require a separate abuse/privacy review and launch decision.
- Existing comparison buckets and result admission are private and not exposed in this screen. The UI does not claim to compare against others until authorized reads are present.

## Verified predecessor
PR #415 staged a strict 1–10 browser protocol. After merge, verify exact main CI and Vercel before considering the screen complete.
