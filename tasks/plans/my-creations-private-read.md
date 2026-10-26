# My Creations private list — scope and boundary

Goal: signed-in creators can see their own unlisted new Custom Lineups and friend links without revealing frozen answers, clues, owner secrets or account email.

Owner: `apps/web` request-scoped auth/API, private projection/repository, and minimal read-only account UI. Depends on PRs #514 (Auth), #515 (creator FK), #516 (account-gated issuance).

In scope: server-verified session UUID, service-role-only query with exact projection `puzzle_id,display_title,issued_at`, UUID/schema filter, descending issued date, max 40, validation/sanitized failures, gated `/account/creations` and navigation. Database privileges unchanged; no public client data access.

Out of scope: pagination past initial 40, account claim, publish status, owner code recovery, stats/plays, moderation, analytics, editing, account historical results, or flags/migration/provider activation.

Acceptance: signed-out routes cannot query DB; no query account override; service-role read projects only spoiler-safe fields; malformed DB rows fail; no owner code, email, answer or future clue in response; tests + exact-head CI + independent review, hosted isolated-QA acceptance.

Stop: provider/session not verified, unreviewed DB schema activation or any result that leaks unrevealed answer-bearing columns.
