export type DailyPuzzleOverrideEntry = string | {
  name?: string;
  playerId: string;
};

// Lightweight editorial overrides before Daily puzzles move to an admin UI or database.
// Daily resets at midnight Pacific Time. Each date must contain exactly 6 players.
// Use simple names for unambiguous players: 'Ken Griffey Jr.'
// Use playerId objects for ambiguous names: { name: 'David Ortiz', playerId: 'chadwick:...' }
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
} as const satisfies Record<string, readonly DailyPuzzleOverrideEntry[]>;
