# Default-OFF Chromium smoke check

## Purpose

This is a low-privilege, non-destructive **real-browser smoke check** for the
production-built web app's currently public routes. It runs on normal PR CI
*after* the existing canonical data and production web build.

The runner is `apps/web/scripts/qa-default-off-browser.mjs`. CI pins
Playwright 1.56.1 in an external temporary directory; it does not add a
runtime dependency or make network calls from the web app to a baseball API.

## What it asserts

- The public Daily Nine home page loads at desktop and 390px mobile viewports.
- The default How to Play dialog is actionable and Daily gameplay mounts.
- A visitor can navigate to My Results and back.
- A disabled Custom creator (`/create`) and account page (`/account`) return
  HTTP 404, with no Create a Lineup advertisement.
- Disabled Classic Inning redirects to the public Daily route.
- A prospective Custom completion display GET and POST both return HTTP 404
  with the identity gate forced OFF, even if the app includes those source-only routes.
  No hosted Supabase, attempt credentials or name result are needed.
- Revealing the first signed Daily hint persists it in the browser; after a full
  reload the same at-bat/player and exact previously authorized hint are restored
  without duplication. The post-reload signed hint POST must succeed, and the
  next authorized hint must actually render (not merely increment to 2/4).
- A normal UI search selects one of two known public players whose initials differ
  from the visible active initials. Submitting that actual player receives a real
  signed nonterminal incorrect response with one strike and no answer reveal.
  The strike, exact one-item wrong-guess history and first hint persist through
  durable browser save/reload; the next hint remains usable and the next at-bat
  resets both strikes and wrong-guess history. Candidate choice never reads the
  hidden answer, private data or a test fixture.
- Two further distinct publicly searched wrong-player guesses complete the first at-bat as an actual signed three-strike K. The second guess must not reveal the answer; only the third receives a terminal reveal. Browser save retains the K and exactly three wrong guesses. The shared game then advances once to at-bat 2 with no inherited strikes or hints, and a second reload preserves the completed first at-bat. The runner never logs answers or signed tokens.
- A complete nine-at-bat local Daily is exercised with signed terminal give-up
  requests for every remaining at-bat, sequential advancement to the current Your Nine results panel showing nine of
  nine completed and all nine scorecard rows, and a reload confirming that
  the completed at-bats and exact final points total remain identical. No hidden answers, tokens or saved payloads are logged. This
  does not prove competitive server submission or successful hosted scoring.
- No uncaught browser JavaScript exceptions are observed during this flow.

No browser writes to Supabase. The isolated Next child process receives an
allowlisted environment, with no production or QA DB URLs/keys, CI tokens,
Vercel credentials, or inherited product-release settings. Before startup,
the runner also refuses local .env, .env.local, .env.production and
.env.production.local files in apps/web (including differently cased variants),
because Next.js could otherwise load those credentials on case-insensitive
filesystems independently of the allowlisted process environment. All
browser requests must stay on the runner's ephemeral loopback origin; browser
locator, action and navigation waits have bounded timeouts. The runner only
accepts a healthy HTTP response after its own spawned Next process emits
its startup readiness marker, preventing a recycled loopback port from
mistakenly passing against an unrelated process.
`qa-default-off-browser-safety.test.mjs` asserts these guardrails.

## Run locally

After `corepack pnpm install --frozen-lockfile`, build the full web app
using the repository's standard `corepack pnpm build:web` command with the
**same pinned nonproduction signing key** as the smoke child. A pre-rendered
Daily page signs its initial hint checkpoints during build; using a different
runtime key causes the restore API to reject those checkpoints. For this QA
workflow only, set `DAILY_PROGRESSION_SECRET=ci-only-daily-progression-secret-0123456789abcdef`
when running the build. Never use a production signing key. Then:

```sh
npm install --prefix /tmp/ib-default-off-smoke --no-package-lock playwright@1.56.1
/tmp/ib-default-off-smoke/node_modules/.bin/playwright install chromium
IB_DEFAULT_OFF_SMOKE_PLAYWRIGHT_MODULE=/tmp/ib-default-off-smoke/node_modules/playwright/index.mjs \
  node apps/web/scripts/qa-default-off-browser.mjs
```

If Chromium lacks system libraries, install the dependencies through the
Playwright CLI (`install --with-deps chromium`) as CI does.

## What it does **not** prove

This covers one real incorrect-player guess followed by a full nine-at-bat
**three-strike first at-bat plus eight give-ups** and local persistence, not complete guess-path gameplay
acceptance or an isolated hosted QA result. It verifies signed incorrect-strike
and local hint continuation, nine signed terminal/advance transitions and
completed-game reload, but does **not** verify correct player guesses, authoritative scoring, saved competitive submissions,
Supabase row policies/migrations, authenticated Custom creation, Custom completion-name write/read/identity recovery,
real-browser enabled-mode CSRF and name-entry flows, OAuth, Archive
catalogs, secondary official Daily editions, physical Safari, or Android.

Keep the existing credential-gated, isolated Supabase Chromium runners and
their protected GitHub Environments. Do not enable production feature flags,
move environment secrets to PR workflows, or treat this smoke check as a
substitute for the feature-specific release gates in `tasks/todo.md`.
