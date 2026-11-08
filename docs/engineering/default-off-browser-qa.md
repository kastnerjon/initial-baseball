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
using the repository's standard `corepack pnpm build:web` command and a
nonproduction `DAILY_PROGRESSION_SECRET`. Then:

```sh
npm install --prefix /tmp/ib-default-off-smoke --no-package-lock playwright@1.56.1
/tmp/ib-default-off-smoke/node_modules/.bin/playwright install chromium
IB_DEFAULT_OFF_SMOKE_PLAYWRIGHT_MODULE=/tmp/ib-default-off-smoke/node_modules/playwright/index.mjs \
  node apps/web/scripts/qa-default-off-browser.mjs
```

If Chromium lacks system libraries, install the dependencies through the
Playwright CLI (`install --with-deps chromium`) as CI does.

## What it does **not** prove

This is neither full gameplay acceptance nor an isolated hosted QA result.
It does **not** verify real guesses, scoring, saved competitive submissions,
Supabase row policies/migrations, authenticated Custom creation, OAuth, Archive
catalogs, secondary official Daily editions, physical Safari, or Android.

Keep the existing credential-gated, isolated Supabase Chromium runners and
their protected GitHub Environments. Do not enable production feature flags,
move environment secrets to PR workflows, or treat this smoke check as a
substitute for the feature-specific release gates in `tasks/todo.md`.
