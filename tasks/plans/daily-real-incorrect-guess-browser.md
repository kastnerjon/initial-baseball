# Daily browser incorrect-guess acceptance

## Scope contract

- **Goal:** The default-OFF native Chromium smoke submits one real incorrect
  canonical-player guess, then proves its strike and authorized hint survive
  reload before the existing complete nine-at-bat flow continues.
- **Owning layer:** `apps/web/scripts` browser QA only.
- **In scope:** Choose between two publicly searchable, known players using only
  the visible initials; select the player through normal search UI; verify the
  real local resolve response, one strike, wrong-guess history, durable save,
  hint continuity and reset on the next at-bat at 390px and desktop widths.
  Update the existing QA contract documentation.
- **Out of scope:** Application/runtime changes, hidden answer lookup, simulated
  resolve responses, new credentials/dependencies/CI jobs, correct guesses,
  hosted scoring or release activation.
- **Acceptance:** Syntax and existing environment-isolation tests; full existing
  smoke with actual Chromium against the standard production build. Preserve
  all current hint, nine-terminal, completed-results and default-OFF assertions.
  Exact-head CI, Preview and independent reviews remain integration gates.
- **Stop conditions:** If public initials/search cannot safely select a reliable
  incorrect candidate, stop rather than inspect hidden data or broaden scope.

## Architecture

The runner uses the normal rendered input, public search and signed resolve
endpoint. It reads only incorrect-result metadata and redacts all saved state,
request credentials, response tokens and hints from output. Public known-player
names are test inputs, never derived from the answer or private data. No domain,
server authority, scoring, persistence or package dependency changes.

## Local verification

November 10: syntax, environment-isolation tests (3/3), file-size and whitespace
checks passed. The exact changed harness passed actual Playwright 1.56.1 / pinned
Chromium 141 at both 390px and 1280px against the standard production build of
unchanged main `f014d7f3`; its postbuild hidden-answer audit also passed. Both
viewports completed the real incorrect guess, one-strike/hint/wrong-guess
restoration, all nine terminal transitions, completed reload and existing
negative feature gates. No hosted backend or private credentials were supplied.
This is local browser evidence; exact-head CI/Preview and independent review
remain required before integration.
