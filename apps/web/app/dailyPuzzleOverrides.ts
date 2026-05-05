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
    { name: 'David Ortiz', playerId: 'chadwick:0fa4c972' },
    { name: 'Randy Johnson', playerId: 'chadwick:1b1083b5' },
    { name: 'Whitey Ford', playerId: 'chadwick:fca49b7c' },
    { name: 'Joe Mauer', playerId: 'chadwick:43c69595' },
    { name: 'Johan Santana', playerId: 'chadwick:3c6ad078' },
    { name: 'Dave Winfield', playerId: 'chadwick:98b82e8f' },
  ],
} as const satisfies Record<string, readonly DailyPuzzleOverrideEntry[]>;
