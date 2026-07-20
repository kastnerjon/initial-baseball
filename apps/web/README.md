# Web App

This app is the first playable surface: **Daily Inning by Initial Baseball**.

Rules:

- Mobile-first responsive web.
- No login required for v0.
- Anonymous browser/device ID tracks attempts.
- Same shared engine as the future mobile app.
- No player names in share text.
- Results page may reveal player names only after the user completes the puzzle.
- Initial page props contain only the public Daily puzzle and a unique opaque progression token; answer IDs, names, hints, and reveal records remain server-side.
- Player search uses the canonical index route. Hint and answer resolution use guarded Daily routes, and terminal results return canonical reveal records.
- Daily action routes verify the current pitch, hint depth, strike count, and outs from the progression token rather than accepting those values from the browser.
- The web replay-store adapter consumes each progression token once, returns the saved response for an exact network retry, and rejects a different action that reuses a superseded token.
- Vercel Runtime Cache is the production replay-store adapter; local development and unit tests use the in-memory adapter behind the same interface.
- Browser persistence stores only the public puzzle contract, gameplay state, and opaque progression token. Unstarted legacy saves may migrate; partial legacy progress without verifiable state is discarded.
- Two-way reveal records preserve and render both canonical batting and pitching lines.

Do not put game-scoring rules in React components. Use `packages/engine`.
