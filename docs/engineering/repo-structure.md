# Repository Structure

Use one monorepo for Daily Inning web, H2H mobile, shared packages, and Supabase.

```text
initial-baseball/
  apps/
    web/        Daily Inning by Initial Baseball, first playable surface
    mobile/     Initial Baseball H2H app, later milestone
  packages/
    engine/     pure game logic, daily sharing, aggregate helpers
    shared/     shared types, constants, validators
    baseball-data/
  supabase/
    migrations/
    functions/
  docs/
  tasks/
```

Rules:

- Do not duplicate game logic between web and mobile.
- Do not put scoring rules in React components.
- Do not create separate repositories until there is a real team/org reason.
- Keep files small and names explicit.
- Use source-map docs to guide LLM/code-agent edits.
