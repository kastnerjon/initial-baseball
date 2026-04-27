# Edge Functions

Each function should do one thing.

Rules:

- Authenticate caller.
- Validate input.
- Use transactions/row locks for game mutations.
- Write `game_events` for meaningful actions.
- Never leak hidden answer data to hitter.
- Return sanitized responses.

## Practice

- `start-practice-round`: selects a random player for solo Practice Mode.


## Daily Inning

- `get-daily-puzzle`: returns today's spoiler-safe puzzle payload.
- `start-daily-attempt`: creates anonymous/authenticated attempt.
- `submit-daily-pitch-result`: records one pitch result.
- `complete-daily-attempt`: finalizes line score/share result.
- `claim-anonymous-history`: attaches anonymous attempts to an authenticated user.
