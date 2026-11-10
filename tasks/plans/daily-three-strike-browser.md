# Real three-strike Daily Chromium acceptance

## Scope contract

- **Goal:** Extend the real first-batter incorrect-guess recovery of #645 to
  verify the second incorrect guess, signed third-strike K and durable next-batter
  result, without changing runtime behavior or authority.
- **Owning layer:** Existing default-OFF \`apps/web/scripts\` QA only.
- **In scope:** Public canonical search of two additional distinct players,
  server-signed nonterminal and terminal assertions, hint/strike privacy,
  ordered completion fact in saved browser progress, next-batter reset,
  retention of all nine completed at-bats and mobile/desktop Chromium views.
- **Out of scope:** Correct-answer submissions, hidden identity inspection,
  forged resolve responses, server-scored leaderboard evidence, Auth, Custom,
  secondary Daily releases, production flags and physical-device acceptance.
- **Dependencies:** Explicit stack on #645's first-strike and reload path.
- **Acceptance:** Source syntax and isolation checks, existing native Chromium
  smoke against a production build, full CI and Preview on the exact head,
  independent final-head review before integration.
- **Stop conditions:** Any public candidate not uniquely searchable or an
  answer-privacy violation; do not use private fixtures to force a strikeout.

## Verification boundary

All search choices are selected from Babe Ruth, Hank Aaron, Derek Jeter and
Willie Mays, filtered by the *rendered* current initials and previous guessed
name. Public names are input only; response assertions inspect result type,
strike count, K outcome and terminal reveal presence, **never** identity,
hidden hints, token values, browser credential values or private state dumps.

This is a local real-server HTTP/Chromium regression when executed in CI; it
does not establish hosted Supabase, competitive admission, Google/Apple Auth,
physical Safari/Android or production release. No source runtime, package
boundary, database schema, public API or product rule changes.
