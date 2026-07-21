# Web App

This app is the first playable surface: **Daily Inning by Initial Baseball**.

## Product and architecture rules

- Mobile-first responsive web.
- No login required for the public Daily launch experience.
- Same portable engine and Daily packages remain available to a future client without making a native app current scope.
- No player names in share text.
- Results may reveal player names only after the applicable at-bat is resolved.
- Initial page props contain only the public Daily puzzle and an opaque signed progression token; answer IDs, names, hint values, and reveal records remain server-side.
- Player search uses the canonical index route. Hint and answer resolution use token-authorized Daily routes, and terminal results return the current canonical reveal record.
- Browser persistence stores public gameplay state plus the opaque progression token. Legacy saved IDs are accepted through canonical redirects.
- Do not put game-scoring rules in React components or routes. Use `packages/engine`; portable Daily behavior belongs in `packages/daily`.

## Daily progression secret

Preview and production deployments require a server-only environment variable:

```text
DAILY_PROGRESSION_SECRET=<at least 32 random characters>
```

Generate and store the value through the deployment provider or a password manager. A command such as `openssl rand -base64 48` is suitable for creating a new value.

Rules:

- Never prefix the variable with `NEXT_PUBLIC_`.
- Never place the value in source control, client props, logs, or browser storage.
- Local development uses an explicit development-only fallback when the variable is absent.
- Production fails closed when the variable is absent.
- CI supplies a fixed nonproduction-only value for the production build check.
- Rotating the secret invalidates unfinished saved progression tokens. Treat rotation as a deliberate deployment event and expect active anonymous games to restart.

The token contains only public progression fields and is intentionally stateless and replayable. There is no replay cache, Redis dependency, database write per action, durable anonymous server session, or Vercel-specific state. The accepted guarantees and limitations are documented in `docs/decisions/0001-daily-answer-integrity.md`.

## Daily administration boundary

The current single-editor administration method is HTTP Basic authentication at the Next.js server boundary. It is deliberately smaller than an account system and must be used only over HTTPS.

The server requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_ADMIN_USERNAME`, and `DAILY_ADMIN_PASSWORD`. The password must contain at least 32 characters.

Rules:

- Never prefix these variables with `NEXT_PUBLIC_` or pass them to client components, props, browser storage, logs, or responses.
- Future admin routes must authenticate the request before constructing the service-role Supabase client or repository.
- A rejected request returns HTTP `401` with the exported Basic authentication challenge; it must not instantiate the privileged client.
- The configured username is the stable actor ID supplied to portable Daily editorial services.
- The Supabase client disables browser-style session persistence and uses only the server URL plus service-role credential; it does not fall back to public variables.
- Row-level security remains enabled with no browser policies. The service role is reachable only through the authorized server composition boundary.
- This does not add public accounts, editor sessions, Supabase Auth, OAuth, password recovery, or multi-editor administration. Those require a separate decision if the product outgrows one editor.

The committed `daily_editorial_puzzles` migration and these deployment variables still need to be applied or configured before the administration workflow is hosted.

## Saved-game migration

Current browser saves use storage schema 3 and include the opaque token.

- Current saves restore normal refresh progress.
- Untouched pre-token starts may migrate to the new initial token.
- Completed pre-token games remain readable.
- Incomplete pre-token progress resets because the server cannot safely infer a later authorization token from browser state.
