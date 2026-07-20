# Web App

This app is the first playable surface: **Daily Inning by Initial Baseball**.

## Product and architecture rules

- Mobile-first responsive web.
- No login required for launch.
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

## Saved-game migration

Current browser saves use storage schema 3 and include the opaque token.

- Current saves restore normal refresh progress.
- Untouched pre-token starts may migrate to the new initial token.
- Completed pre-token games remain readable.
- Incomplete pre-token progress resets because the server cannot safely infer a later authorization token from browser state.
