# Custom Lineup v2 — strict resolve action field validation

Status: bounded Web gameplay transport correctness hardening; **flag stays disabled**.

## Scope contract
- **Goal:** reject any Custom v2 resolve request whose second JSON property is not exactly `giveUp` or `submittedPlayerId`, before invoking signed atomic attempt CAS.
- **Owning layer:** `apps/web` server-side HTTP adapter.
- **In scope:** `resolveBody` strict own-key action discriminator and targeted v2 HTTP handler regression cases (unknown, mixed, extra action fields), plus canonical handoff update.
- **Out of scope:** v1 Custom Nine, Daily/Classic rules, clues, scoring, transport switching, runtime environment flags, rate limiting, authentication, client UI, database or issuance migrations, community publication and public activation.
- **Acceptance:** only exact two-field `{progressionToken, giveUp:true}` and `{progressionToken, submittedPlayerId:validId}` reach the existing atomic v2 attempt service; malformed/mixed/unknown fields return sanitized HTTP 400 without service calls; existing terminal give-up and guesses still work; exact-head CI and READY Vercel Preview, bounded independent review, postmerge main CI/production/routes/logs/Supabase/open-PR verification.
- **Stop conditions:** any broader request threat model, new persistence or rate-limit mechanism, auth/identity change or activation requires a separately scoped PR and explicit design decision.

## Architecture and compatibility
The existing v2 HTTP adapter already requires a two-property record but does not validate the *name* of its action property in the `giveUp` branch. Reusing `Object.keys` in the same validator closes that gap without new helpers, dependencies, rules or interface changes. The portable engine and database services remain unaware of HTTP request shape. Valid v2 gameplay and legacy v1 are unchanged. No public Custom activation is authorized by this PR.

## Remaining release gates
Supabase currently has zero hosted v2 issued, attempt, completed and AB records: no real hosted gameplay E2E was performed. Full N=1/5/9/10 hosted staging gameplay, mobile visual QA, privacy/abuse controls and rate limiting remain prerequisites to any public release.
