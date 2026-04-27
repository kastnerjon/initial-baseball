# AI-Assisted Maintenance Workflow

The user is PM/product owner. AI/coding agents should do implementation work through small scoped tasks.

## Bug report flow

1. PM reports bug with screenshot/video/game ID if available.
2. Engineering lead classifies bug:
   - UI
   - engine/rules
   - backend function
   - database/schema/data
   - player data
   - native/store
3. Create GitHub issue.
4. Create branch.
5. Add failing test if possible.
6. Fix in the smallest relevant files.
7. Test in dev/staging.
8. Release via OTA/backend deploy/store build as appropriate.

## Bug report template

```md
## Bug
What happened?

## Expected
What should have happened?

## Platform
Android / iOS / both

## User/game
Username or game ID if available

## Media
Screenshot/video if available

## Severity
Blocking / annoying / cosmetic
```

## Agent prompting standard

Good:

> Fix Android layout bug on HitterTurnScreen. Do not touch engine logic. Add or update a UI regression test if available.

Bad:

> Improve the app.

## Maintenance principle

The codebase is designed so most changes are local:

- Game rule bug → `packages/engine` + tests.
- Settings validation bug → `packages/shared` + Edge Function validation.
- Chat bug → `features/chat` + message Edge Function.
- Data bug → `packages/baseball-data` or one migration/backfill.
