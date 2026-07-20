# Web App

This app is the first playable surface: **Daily Inning by Initial Baseball**.

Rules:

- Mobile-first responsive web.
- No login required for v0.
- Anonymous browser/device ID tracks attempts.
- Same shared engine as the future mobile app.
- No player names in share text.
- Results page may reveal player names only after the user completes the puzzle.
- Initial page props contain only the public Daily puzzle; answer IDs, names, hints, and reveal records remain server-side.
- Player search uses the canonical index route. Hint and answer resolution use guarded Daily routes, and terminal results return canonical reveal records.
- Browser persistence stores only the public puzzle contract and gameplay state. Legacy saved IDs are accepted through canonical redirects.

Do not put game-scoring rules in React components. Use `packages/engine`.
