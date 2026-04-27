# Conventions

Read this at the start of every session. These are the standards for all code in the repo.

---

## File size limits

- No code file > 300 lines. Split if approaching.
- No React component > 150 lines. Extract subcomponents.
- No function > 50 lines. Decompose.

If you hit a limit, it's telling you to split. Don't fight it.

---

## TypeScript

- Strict mode on. No `any` unless absolutely necessary; prefer `unknown` + narrowing.
- Prefer type aliases over interfaces (consistency; interfaces only for declaration merging).
- Use `readonly` on object properties and arrays where possible.
- Avoid `enum` — use const assertions or string literal unions instead.
- Shared types live in `packages/types/`. Both `apps/mobile` and `backend/functions` import from there.

---

## React Native

- Function components only. No class components.
- Hooks-based state. No Redux.
- Zustand for global state (`stores/gameStore.ts`, `stores/authStore.ts`, etc.).
- StyleSheet.create for styles, not inline objects.
- Use `expo-router`-style file-based routing OR React Navigation stack — pick one, document the choice here, stick with it.
- Colors, spacing, fonts go in `src/theme.ts`. No magic numbers in components.

---

## Engine

See `docs/spec/engine.md` for the engine rules. Additionally:
- Pure functions only. If you're tempted to import anything networky, stop.
- Every exported function has a test.
- State changes happen via `{ ...state, field: newValue }` — no mutation.
- Engine imports from `packages/types`, nowhere else.

---

## Backend (Supabase edge functions)

- Each function is single-purpose. No "god functions" that handle multiple actions.
- Always validate JWT first; derive `user_id` from JWT, never trust client input for identity.
- Return JSON with consistent error shape (see `docs/spec/api.md`).
- Run engine logic server-side for every resolving action (guess submission, outcome application). Client-side engine is for optimistic UI only.

---

## Tests

- Jest for engine and backend unit tests.
- Test file colocated with source: `gameRules.ts` → `gameRules.test.ts` in the same folder.
- Use `describe` blocks per function, `it` blocks per case.
- Test names read as sentences: `it("returns triple when hint count is 1")`.
- Every PR / task completion must pass all tests before being marked done.

---

## Commits

- Small commits, one concern per commit.
- Conventional commits prefix: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
- First line ≤ 72 chars. Body wrapped at 72.

---

## When editing specs

If a change to the code requires a change to a spec, edit the spec **first**, then write the code to match. Keeping specs ahead of code is what makes this LLM-friendly long-term.

---

## When hitting ambiguity

If a spec doesn't cover a case:
1. Look for analogous cases in the same spec.
2. If no analog, stop and ask the user before implementing.
3. After the user answers, update the spec to codify the decision.

Never silently make a design decision that isn't in a spec.

---

## Dependencies

- Add new dependencies only when necessary. Every added dep is an audit burden.
- Prefer the Expo-supported dep over alternatives (e.g., `expo-apple-authentication` over `react-native-apple-auth`).
- Never add a dep that only works in a bare RN workflow without confirming it works in Expo managed.

---

## LLM-friendly authoring patterns

When writing code that will be edited by an LLM later:

- Name functions descriptively; no single-letter parameters except in obviously trivial contexts.
- Prefer explicit types over inference in function signatures (easier for LLMs to read).
- Comment the *why*, not the *what*. Reserve comments for non-obvious tradeoffs.
- Prefer many small pure functions over one big impure one.
- Don't cleverly combine multiple concerns into one expression. Write it out.
