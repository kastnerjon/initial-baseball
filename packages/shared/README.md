# @initial-baseball/shared

Shared types, constants, and validators used by mobile app, engine, and backend functions.

Schema-1 completed-result submission, normalized result, and validation-result types are exported from `types/dailyCompletedResult.ts`. Only `points-v3` and `classic-inning-v1` are accepted initially. Game validation/derivation belongs to the engine; repository/service/API integration is subsequent work.

Rules:

- No React imports.
- No Supabase client imports.
- No platform-specific APIs.
- Keep validation logic deterministic and tested.
