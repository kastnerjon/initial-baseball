# Setup Guide

## 1. Create GitHub repo

Create one repository:

```text
initial-baseball
```

Push this scaffold to that repo.

Do not create separate repos for iOS, Android, backend, or web.

## 2. Connect coding agent

Connect Codex/Cursor/Claude Code to the GitHub repo.

Tell the coding agent:

> Read `AGENTS.md`, then follow `tasks/todo.md`. Do not touch production credentials. Work in small branches and add tests.

## 3. Create Supabase projects

Create three projects:

- `initial-baseball-dev`
- `initial-baseball-staging`
- `initial-baseball-prod`

Apply migrations in this order:

1. dev
2. staging
3. production

## 4. Secrets

Use environment variables.

Mobile public variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_ENV`

Server-only variables:

- `SUPABASE_SERVICE_ROLE_KEY`

Never commit `.env`.

## 5. First engineering task

Start with Phase 1 in `tasks/todo.md`:

- shared types
- settings validation
- stats field labels
- engine tests

Do not start by styling screens.
