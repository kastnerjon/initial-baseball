import { defineConfig } from 'vitest/config';

// Only the explicit post-runtime QA uses real generated canonical data.
// The ordinary web Vitest suite intentionally runs before that generation.
export default defineConfig({
  test: {
    include: ['app/customLineupCanonicalIssuability.qa.ts'],
    testTimeout: 45_000,
  },
});
