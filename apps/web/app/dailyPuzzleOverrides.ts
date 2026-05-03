// Lightweight editorial overrides before Daily puzzles move to an admin UI or database.
// If a date is absent here, the app falls back to deterministic generated selection.
export const DAILY_PUZZLE_OVERRIDES = {
  '2026-05-04': [
    'Ken Griffey Jr.',
    'David Wright',
    'CC Sabathia',
    'Albert Pujols',
    'Derek Jeter',
    'Ichiro Suzuki',
  ],
} as const satisfies Record<string, readonly string[]>;
