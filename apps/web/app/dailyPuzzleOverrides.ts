import type { DailyPuzzleOverrideEntry } from '@initial-baseball/daily';

// Lightweight editorial overrides before Daily puzzles move to an admin UI or database.
// Daily resets at midnight Pacific Time. New dates should contain exactly 9 players.
// Six-player overrides remain accepted only for historical compatibility.
// Use simple names for unambiguous players: 'Ken Griffey Jr.'
// Use an object with a real player ID for ambiguous names; see the existing override below.
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
