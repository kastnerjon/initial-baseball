# Official Daily browser persistence isolation

The credential-free CI browser runner uses the actual Daily browser save/load/reset
adapters, saved-game codec and ownership coordinator with synthetic public
nine-slot puzzles. It creates two same-date secondary editions and a primary on
one ephemeral IPv4 loopback origin, in separate Chromium tabs at 390px and 1280px.
No Next server, Supabase, account, hidden player data or real signing secret is used.

The runner verifies distinct hint/strike snapshots after reload, same-tab switching
in both directions, one-edition reset preserving both other saves and legacy
namespaces, simultaneous owners for different IDs, an exact-ID follower waiting
on a real Web Lock, and durable save readback after the original owner closes.
Browser requests are limited to the exact loopback origin and the launched browser
receives only an allowlisted operating-system environment. Safety tests reject
external/malformed origins and prove inherited database/Auth/CI secrets are dropped.

Run with a QA-only Playwright installation:

```sh
DAILY_ISOLATION_QA_PLAYWRIGHT_MODULE=/absolute/path/node_modules/playwright/index.mjs node apps/web/scripts/qa-official-daily-isolation-browser.mjs
```

An optional absolute `DAILY_ISOLATION_QA_CHROMIUM_EXECUTABLE` selects an installed
Chromium binary. CI reuses the existing pinned Playwright/Chromium installation.
The runner fails if the browser cannot launch; it never substitutes a memory mock.

This is storage/lock adapter acceptance, **not** complete React gameplay, signed
HTTP hint progression, hosted database, competitive admission, Pacific-midnight
navigation, or physical Safari/Android acceptance. Those release gates remain.
Local execution in the current Work host was blocked before scenarios by Chromium's
`socket() failed: Operation not permitted`; real CI execution remains required.
